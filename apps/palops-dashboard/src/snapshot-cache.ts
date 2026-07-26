type CacheOptions = {
  ttlMs?: number;
  maximumEntries?: number;
  maximumBytes?: number;
  now?: () => number;
};

type StoredResponse = {
  status: number;
  headers: Headers;
  body: Uint8Array;
  etag: string | null;
  storedAt: number;
  stale: boolean;
};

type Loader = (etag: string | null) => Promise<Response>;

export class SnapshotResponseCache {
  readonly #ttlMs: number;
  readonly #maximumEntries: number;
  readonly #maximumBytes: number;
  readonly #now: () => number;
  readonly #entries = new Map<string, StoredResponse>();
  readonly #inflight = new Map<string, Promise<StoredResponse>>();
  #retainedBytes = 0;

  constructor(options: CacheOptions = {}) {
    this.#ttlMs = Math.max(0, options.ttlMs ?? 1_000);
    this.#maximumEntries = Math.max(1, options.maximumEntries ?? 16);
    this.#maximumBytes = Math.max(1, options.maximumBytes ?? 64 * 1024 * 1024);
    this.#now = options.now ?? Date.now;
  }

  async fetch(
    key: string,
    viewerEtag: string | null,
    loader: Loader,
    forceRevalidate = false,
  ): Promise<Response> {
    const retained = this.#entries.get(key);
    if (!forceRevalidate && retained && this.#now() - retained.storedAt <= this.#ttlMs) {
      return this.#response(retained, viewerEtag);
    }

    let pending = this.#inflight.get(key);
    if (!pending) {
      pending = this.#load(key, retained, loader);
      this.#inflight.set(key, pending);
      void pending.then(
        () => this.#inflight.delete(key),
        () => this.#inflight.delete(key),
      );
    }
    return this.#response(await pending, viewerEtag);
  }

  async #load(key: string, retained: StoredResponse | undefined, loader: Loader): Promise<StoredResponse> {
    let response: Response;
    try {
      response = await loader(retained?.etag ?? null);
    } catch (error) {
      if (retained) return { ...retained, stale: true };
      throw error;
    }

    if (response.status === 304 && retained) {
      const refreshed = { ...retained, storedAt: this.#now(), stale: false };
      this.#retain(key, refreshed);
      return refreshed;
    }
    if ((response.status === 429 || response.status === 503) && retained) {
      const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "1", 10);
      return {
        ...retained,
        storedAt: this.#now() + Math.max(1, Number.isFinite(retryAfter) ? retryAfter : 1) * 1_000 - this.#ttlMs,
        stale: true,
      };
    }

    const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
    if (declaredLength > this.#maximumBytes) return this.#tooLarge();
    const body = await this.#readBounded(response);
    if (!body) return this.#tooLarge();
    const stored: StoredResponse = {
      status: response.status,
      headers: new Headers(response.headers),
      body,
      etag: response.headers.get("etag"),
      storedAt: this.#now(),
      stale: false,
    };
    if (response.ok && stored.etag && body.byteLength <= this.#maximumBytes) {
      this.#retain(key, stored);
    }
    return stored;
  }

  async #readBounded(response: Response): Promise<Uint8Array | null> {
    if (!response.body) return new Uint8Array();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > this.#maximumBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return body;
  }

  #tooLarge(): StoredResponse {
    const body = new TextEncoder().encode(
      '{"error":"The complete PalOps response exceeds the Dashboard safety limit."}',
    );
    return {
      status: 503,
      headers: new Headers({
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "Retry-After": "5",
      }),
      body,
      etag: null,
      storedAt: this.#now(),
      stale: false,
    };
  }

  #retain(key: string, response: StoredResponse): void {
    const previous = this.#entries.get(key);
    if (previous) this.#retainedBytes -= previous.body.byteLength;
    this.#entries.delete(key);
    this.#entries.set(key, response);
    this.#retainedBytes += response.body.byteLength;
    while (
      this.#entries.size > this.#maximumEntries ||
      this.#retainedBytes > this.#maximumBytes
    ) {
      const oldestKey = this.#entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      const oldest = this.#entries.get(oldestKey);
      this.#entries.delete(oldestKey);
      if (oldest) this.#retainedBytes -= oldest.body.byteLength;
    }
  }

  #response(stored: StoredResponse, viewerEtag: string | null): Response {
    const headers = new Headers(stored.headers);
    headers.set("Cache-Control", "private, no-cache");
    if (stored.stale) {
      headers.set("Warning", '110 - "PalOps response is stale"');
      headers.set("X-PalOps-Cache", "stale");
    } else {
      headers.set("X-PalOps-Cache", "hit");
    }
    if (viewerEtag && stored.etag === viewerEtag) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(stored.body, { status: stored.status, headers });
  }
}
