import { describe, expect, test } from "vitest";
import { createEditorDocument } from "../src/document/create-editor-document";

type Config = { enabled: boolean };

describe("EditorDocument", () => {
  test("applies one command and publishes one validated snapshot", () => {
    const persisted: string[] = [];
    let notifications = 0;
    const document = createEditorDocument<Config>({
      initialValue: { enabled: false },
      hydrate: (input) => ({ enabled: (input as Config).enabled }),
      serialize: JSON.stringify,
      validate: () => ({ valid: true, errors: [] }),
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
  });
});
