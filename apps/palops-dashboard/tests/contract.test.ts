import { describe, expect, test } from "bun:test";
import { matchOperation, readOperations } from "../src/contract";

const document = await Bun.file(new URL("../../../contracts/palops/openapi.json", import.meta.url)).json();
const operations = readOperations(document);

describe("OpenAPI proxy registry", () => {
  test("contains all version 1 operations", () => expect(operations).toHaveLength(41));
  test("matches resource identifiers without broad prefixes", () => {
    expect(matchOperation(operations, "GET", "/v1/players/p-123")?.operationId).toBe("getPlayer");
    expect(matchOperation(operations, "GET", "/v1/players/online")?.operationId).toBe("listOnlinePlayers");
    expect(matchOperation(operations, "POST", "/v1/players/ops/kick")?.operationId).toBe("kickPlayer");
    expect(matchOperation(operations, "PUT", "/v1/config")?.operationId).toBe("updateConfig");
    expect(matchOperation(operations, "GET", "/v1/players/p-123/extra")).toBeNull();
    expect(matchOperation(operations, "DELETE", "/v1/players/p-123")).toBeNull();
  });
  test("marks only durable operations as mutations", () => expect(operations.filter((item) => item.mutation)).toHaveLength(18));
});
