import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { matchOperation, readOperations, type ContractOperation } from "./contract";
import { credentialsWereAccepted } from "./security";
import { SnapshotResponseCache } from "./snapshot-cache";

type Access = { mode: "public" | "operator" | "disabled"; fixed: boolean; allowed_modes: string[] };
type Capabilities = { endpoints: Record<string, Access> };
type Session = { password: string; expiresAt: number };

const sourceDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(sourceDir, "..");
const publicDir = join(appDir, "public");
const appSourcePath = join(sourceDir, "app.ts");
const repoDir = resolve(appDir, "../..");
const contractPath = join(repoDir, "contracts/palops/openapi.json");
const mapAssetsDir = join(repoDir, "site/pallaw/assets/paldb-map");
const apiBase = (process.env.PALOPS_API_BASE ?? "http://127.0.0.1:8222").replace(/\/$/, "");
const host = process.env.PALOPS_DASHBOARD_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.PALOPS_DASHBOARD_PORT ?? "8230", 10);
const sessionHours = Number.parseFloat(process.env.PALOPS_SESSION_HOURS ?? "8");
const sessionTtlMs = Math.max(0.25, Math.min(sessionHours, 24)) * 60 * 60 * 1000;
const sessions = new Map<string, Session>();
const maximumSessions = 256;
const maximumProxyBodyBytes = 1024 * 1024;
const operations = readOperations(await Bun.file(contractPath).json()) as ContractOperation[];
let capabilityCache: { value: Capabilities; expiresAt: number } | null = null;
const snapshotCache = new SnapshotResponseCache();
const snapshotOperations = new Set([
  "listPlayers",
  "listPlayerLeaderboard",
  "listPalLeaderboard",
  "listGuilds",
  "listGuildLeaderboard",
  "listOnlinePlayers",
  "getWorldMap",
]);

const mime: Record<string, string> = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".webp": "image/webp",
};

function json(status: number, value: unknown, headers: HeadersInit = {}): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function cookieValue(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function sessionFor(request: Request): Session | null {
  const token = cookieValue(request, "palops_session");
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function pruneSessions(now = Date.now()): void {
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
  while (sessions.size >= maximumSessions) {
    const oldest = sessions.keys().next().value as string | undefined;
    if (!oldest) break;
    sessions.delete(oldest);
  }
}

async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumProxyBodyBytes) {
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

async function capabilities(force = false): Promise<Capabilities> {
  if (!force && capabilityCache && capabilityCache.expiresAt > Date.now()) return capabilityCache.value;
  const response = await fetch(`${apiBase}/v1/capabilities`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`PalOps capabilities returned ${response.status}`);
  const value = await response.json() as Capabilities;
  capabilityCache = { value, expiresAt: Date.now() + 2000 };
  return value;
}

function basic(password: string): string {
  return `Basic ${btoa(`admin:${password}`)}`;
}

async function verifyPassword(password: string): Promise<boolean> {
  const policy = await capabilities(true);
  const candidates = ["getServerStatus", "getServerSettings", "listOperations", "getConfig"];
  for (const operationId of candidates) {
    const access = policy.endpoints[operationId];
    const operation = operations.find((item) => item.operationId === operationId && !item.pathTemplate.includes("{"));
    if (access?.mode !== "operator" || !operation) continue;
    const response = await fetch(`${apiBase}${operation.pathTemplate}`, {
      headers: { Accept: "application/json", Authorization: basic(password) }, signal: AbortSignal.timeout(4000),
    });
    return credentialsWereAccepted(response.status);
  }
  throw new Error("No enabled authenticated query can verify Operator credentials.");
}

function secureCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `palops_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

async function handleSession(request: Request): Promise<Response> {
  if (request.method === "GET") {
    const session = sessionFor(request);
    return json(200, { authenticated: !!session, expires_at: session ? new Date(session.expiresAt).toISOString() : null });
  }
  if (request.method === "DELETE") {
    const token = cookieValue(request, "palops_session");
    if (token) sessions.delete(token);
    return json(200, { authenticated: false }, { "Set-Cookie": secureCookie(request) });
  }
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return json(413, { error: "Session request is too large." });
  const raw = await request.text();
  if (raw.length > 4096) return json(413, { error: "Session request is too large." });
  const body = (() => { try { return JSON.parse(raw) as { password?: unknown }; } catch { return null; } })();
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password || password.length > 256) return json(400, { error: "A valid password is required." });
  if (!await verifyPassword(password)) return json(401, { error: "Operator credentials were rejected." });
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + sessionTtlMs;
  pruneSessions();
  sessions.set(token, { password, expiresAt });
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return json(200, { authenticated: true, expires_at: new Date(expiresAt).toISOString() }, {
    "Set-Cookie": `palops_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(sessionTtlMs / 1000)}${secure}`,
  });
}

async function proxy(request: Request, upstreamPath: string): Promise<Response> {
  const operation = matchOperation(operations, request.method, upstreamPath);
  if (!operation) return json(404, { error: "Route is not present in the PalOps contract." });
  const policy = await capabilities();
  const access = policy.endpoints[operation.operationId];
  if (!access || access.mode === "disabled") return json(404, { error: "Endpoint is disabled.", operation_id: operation.operationId });
  const session = sessionFor(request);
  if (access.mode === "operator" && !session) return json(401, { error: "Operator login required.", operation_id: operation.operationId });
  const headers = new Headers({ Accept: "application/json" });
  if (session && access.mode === "operator") headers.set("Authorization", basic(session.password));
  for (const name of ["content-type", "idempotency-key", "if-match", "if-none-match", "x-correlation-id"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maximumProxyBodyBytes) return json(413, { error: "Proxy request is too large." });
  const hasBody = request.method === "POST" || request.method === "PUT";
  const body = hasBody ? await readBoundedBody(request) : undefined;
  if (hasBody && request.body && body === null) return json(413, { error: "Proxy request is too large." });
  const upstreamUrl = `${apiBase}${upstreamPath}${new URL(request.url).search}`;
  if (request.method === "GET" && snapshotOperations.has(operation.operationId)) {
    const cacheKey = `${access.mode}:${operation.operationId}:${upstreamPath}${new URL(request.url).search}`;
    const response = await snapshotCache.fetch(
      cacheKey,
      request.headers.get("if-none-match"),
      async (retainedEtag) => {
        const upstreamHeaders = new Headers(headers);
        upstreamHeaders.delete("If-None-Match");
        if (retainedEtag) upstreamHeaders.set("If-None-Match", retainedEtag);
        return await fetch(upstreamUrl, {
          method: "GET",
          headers: upstreamHeaders,
          redirect: "manual",
          signal: AbortSignal.timeout(8000),
        });
      },
      request.headers.get("cache-control")?.includes("no-cache") === true,
    );
    response.headers.set("Vary", "Cookie");
    return response;
  }
  const upstream = await fetch(upstreamUrl, {
    method: request.method, headers, body, redirect: "manual", signal: AbortSignal.timeout(8000),
  });
  if (operation.operationId === "updateConfig" && upstream.ok) capabilityCache = null;
  const responseHeaders = new Headers({ "Cache-Control": "no-store", "Content-Type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8" });
  for (const name of ["etag", "x-correlation-id", "www-authenticate"]) {
    const value = upstream.headers.get(name); if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

async function staticFile(root: string, requested: string): Promise<Response> {
  const relative = requested.replace(/^\/+/, "") || "index.html";
  const filePath = normalize(join(root, relative));
  const normalizedRoot = normalize(root);
  if (filePath !== normalizedRoot && !filePath.startsWith(`${normalizedRoot}${sep}`)) return new Response("Not found", { status: 404 });
  const file = Bun.file(filePath);
  if (!await file.exists()) return new Response("Not found", { status: 404 });
  return new Response(file, { headers: { "Content-Type": mime[extname(filePath)] ?? "application/octet-stream", "Cache-Control": relative === "index.html" ? "no-cache" : "public, max-age=3600" } });
}

const server = Bun.serve({
  hostname: host, port,
  async fetch(request) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/session") return await handleSession(request);
      if (url.pathname === "/api/contract") return json(200, { operations });
      if (url.pathname.startsWith("/api/palops/")) return await proxy(request, url.pathname.slice("/api/palops".length));
      if (url.pathname.startsWith("/map-assets/")) return await staticFile(mapAssetsDir, url.pathname.slice("/map-assets/".length));
      if (url.pathname === "/app.js") {
        const build = await Bun.build({
          entrypoints: [appSourcePath],
          target: "browser",
          format: "esm",
          write: false,
        });
        if (!build.success || !build.outputs[0]) throw new Error("Dashboard application build failed.");
        return new Response(build.outputs[0], { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache" } });
      }
      return await staticFile(publicDir, url.pathname);
    } catch (error) {
      return json(502, { error: error instanceof Error ? error.message : "Dashboard request failed." });
    }
  },
});

console.log(`PalOps dashboard listening on http://${server.hostname}:${server.port}`);
console.log(`PalOps API target: ${apiBase}`);
