import { afterAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";

const port = 38230;
const process = Bun.spawn(["bun", "src/server.ts"], {
  cwd: resolve(import.meta.dir, ".."),
  env: { ...Bun.env, PALOPS_DASHBOARD_PORT: String(port) },
  stdout: "ignore",
  stderr: "ignore",
});

afterAll(() => process.kill());

async function request(path: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { return await fetch(`http://127.0.0.1:${port}${path}`); }
    catch (error) { lastError = error; await Bun.sleep(50); }
  }
  throw lastError;
}

describe("dashboard server shell", () => {
  test("serves the application and contract-derived registry", async () => {
    const index = await request("/");
    expect(index.status).toBe(200);
    expect(await index.text()).toContain("PalOps Dashboard");

    const script = await request("/app.js");
    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toContain("text/javascript");

    const contract = await request("/api/contract");
    expect(contract.status).toBe(200);
    expect((await contract.json() as { operations: unknown[] }).operations).toHaveLength(41);
  });

  test("does not allow static path traversal", async () => {
    expect((await request("/%2e%2e/%2e%2e/contracts/palops/openapi.json")).status).toBe(404);
  });
});
