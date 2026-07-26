import { describe, expect, test, vi } from "vitest";
import { createEditorDocument } from "../src/document/create-editor-document";
import { createLocalDraftAdapter } from "../src/document/local-draft-adapter";

type Config = { enabled: boolean };

describe("EditorDocument", () => {
  test("applies one command and publishes one validated snapshot", () => {
    const persisted: string[] = [];
    let notifications = 0;
    let validations = 0;
    const document = createEditorDocument<Config>({
      initialValue: { enabled: false },
      hydrate: (input) => ({ enabled: (input as Config).enabled }),
      serialize: JSON.stringify,
      validate: () => { validations += 1; return { valid: true, errors: [] }; },
      persistence: { load: () => null, save: (value) => { persisted.push(value); } }
    });
    document.subscribe(() => { notifications += 1; });

    const result = document.dispatch({ type: "mutate", apply: (draft) => { draft.enabled = true; } });

    expect(result).toEqual({ accepted: true });
    expect(document.read().config).toEqual({ enabled: true });
    expect(document.read().validation.valid).toBe(true);
    expect(document.read().dirty).toBe(true);
    expect(persisted).toHaveLength(1);
    expect(notifications).toBe(1);
    expect(validations).toBe(2);
  });

  test("restores a persisted draft through the configured parser", () => {
    const parse = vi.fn(() => ({ enabled: true }));
    const document = createEditorDocument<Config>({
      initialValue: { enabled: false }, hydrate: (input) => input as Config,
      serialize: JSON.stringify, validate: () => ({ valid: true, errors: [] }), parse,
      persistence: { load: () => "legacy draft", save: vi.fn() }
    });

    expect(document.read().config.enabled).toBe(true);
    expect(parse).toHaveBeenCalledWith("legacy draft");
  });

  test("publishes deeply immutable configuration snapshots", () => {
    const document = createEditorDocument({
      initialValue: { nested: { count: 1 } }, hydrate: (input) => structuredClone(input as { nested: { count: number } }),
      serialize: JSON.stringify, validate: () => ({ valid: true, errors: [] })
    });

    expect(() => { document.read().config.nested.count = 2; }).toThrow();
    expect(document.read().config.nested.count).toBe(1);
  });
});

describe("local draft adapter", () => {
  test("uses the configured key without exposing storage to UI code", () => {
    const storage = { getItem: vi.fn(() => "saved"), setItem: vi.fn() };
    const adapter = createLocalDraftAdapter(storage, "pallaw.test");

    expect(adapter.load()).toBe("saved");
    adapter.save("next");
    expect(storage.setItem).toHaveBeenCalledWith("pallaw.test", "next");
  });
});
