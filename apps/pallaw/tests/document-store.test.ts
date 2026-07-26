import { describe, expect, test } from "vitest";
import { createDocumentStore } from "../src/document-store.js";

describe("document store", () => {
  test("undoes one accepted mutation through its public interface", () => {
    const store = createDocumentStore({
      initialValue: { enabled: false },
      hydrate: (value: { enabled: boolean }) => ({ ...value }),
      serialize: JSON.stringify
    });

    expect(store.mutate((value: { enabled: boolean }) => { value.enabled = true; })).toBe(true);
    expect(store.value.enabled).toBe(true);
    expect(store.undo()).toBe(true);
    expect(store.value.enabled).toBe(false);
  });
});
