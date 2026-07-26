import { describe, expect, test } from "bun:test";
import { SnapshotResponseCache } from "../src/snapshot-cache";

describe("snapshot response cache", () => {
  test("coalesces a burst into one upstream read and fans out immutable bytes", async () => {
    let reads = 0;
    const cache = new SnapshotResponseCache({ ttlMs: 1_000 });
    const load = async (): Promise<Response> => {
      reads += 1;
      await Bun.sleep(10);
      return new Response('[{"player_id":"player-1"}]', {
        headers: { ETag: '"players-1"', "Content-Type": "application/json" },
      });
    };

    const responses = await Promise.all(
      Array.from({ length: 12 }, () => cache.fetch("public:players", null, load)),
    );

    expect(reads).toBe(1);
    expect(await Promise.all(responses.map((response) => response.text()))).toEqual(
      Array.from({ length: 12 }, () => '[{"player_id":"player-1"}]'),
    );
  });

  test("revalidates with the retained ETag and honors the viewer condition", async () => {
    let now = 0;
    const seenConditions: Array<string | null> = [];
    const cache = new SnapshotResponseCache({ ttlMs: 10, now: () => now });
    const load = async (etag: string | null): Promise<Response> => {
      seenConditions.push(etag);
      if (etag === '"pals-7"') return new Response(null, { status: 304, headers: { ETag: etag } });
      return new Response('[{"pal_id":"pal-1"}]', {
        headers: { ETag: '"pals-7"', "Content-Type": "application/json" },
      });
    };

    expect((await cache.fetch("public:pals", null, load)).status).toBe(200);
    now = 20;
    expect((await cache.fetch("public:pals", '"pals-7"', load)).status).toBe(304);
    expect(seenConditions).toEqual([null, '"pals-7"']);
  });

  test("serves the retained body as stale when PalOps protects gameplay", async () => {
    let now = 0;
    const cache = new SnapshotResponseCache({ ttlMs: 10, now: () => now });
    await cache.fetch("public:guilds", null, async () =>
      new Response('[{"guild_id":"guild-1"}]', {
        headers: { ETag: '"guilds-3"', "Content-Type": "application/json" },
      }));
    now = 20;

    const response = await cache.fetch("public:guilds", null, async () =>
      new Response('{"code":"SERVER_BUSY"}', { status: 503 }));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-palops-cache")).toBe("stale");
    expect(await response.text()).toContain("guild-1");
  });

  test("cleans up rejected loads and enforces the response memory bound", async () => {
    const cache = new SnapshotResponseCache({ maximumBytes: 8 });
    expect(cache.fetch("public:error", null, async () => {
      throw new Error("upstream failed");
    })).rejects.toThrow("upstream failed");
    await Bun.sleep(0);

    const oversized = await cache.fetch("public:error", null, async () =>
      new Response("123456789", { headers: { ETag: '"large-1"' } }));
    expect(oversized.status).toBe(503);
    expect(oversized.headers.get("retry-after")).toBe("5");
  });
});
