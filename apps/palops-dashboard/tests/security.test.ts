import { describe, expect, test } from "bun:test";
import { credentialsWereAccepted } from "../src/security";

describe("dashboard authentication policy", () => {
  test("does not turn upstream authentication backoff into a session", () => {
    expect(credentialsWereAccepted(401)).toBe(false);
    expect(credentialsWereAccepted(429)).toBe(false);
    expect(credentialsWereAccepted(200)).toBe(true);
    expect(credentialsWereAccepted(503)).toBe(true);
  });
});
