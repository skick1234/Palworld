import { describe, expect, test } from "vitest";
import { createEditorDocument } from "../src/document/create-editor-document";
import { createEditorModel } from "../src/editor/create-editor-model";

type Config = { regions: Array<{ name: string }>; modes: Array<{ id: string }> };

describe("editor model", () => {
  test("reconciles selection after the document removes the selected region", () => {
    const document = createEditorDocument<Config>({
      initialValue: { regions: [{ name: "A" }, { name: "B" }], modes: [{ id: "safe" }] },
      hydrate: (input) => structuredClone(input as Config),
      serialize: JSON.stringify,
      validate: () => ({ valid: true, errors: [] })
    });
    const model = createEditorModel(document);
    model.selectRegion(1);

    document.dispatch({ type: "mutate", apply: (draft) => { draft.regions.splice(1, 1); } });

    expect(model.state.selectedRegionIndex).toBe(0);
    model.dispose();
  });
});
