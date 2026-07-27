import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { App } from "../src/ui/App";
import { createPalLawDocument } from "../src/document/create-pallaw-document";
import { createMemoryDraftAdapter } from "../src/document/local-draft-adapter";

describe("PalLaw application", () => {
  afterEach(cleanup);
  test("owns navigation and document history through one Solid root", async () => {
    const editorDocument = createPalLawDocument(createMemoryDraftAdapter());
    render(() => <App editorDocument={editorDocument} createMap={() => ({ update: vi.fn(), dispatch: vi.fn(), dispose: vi.fn() })} />);

    expect(screen.getByText(/Not affiliated with Pocketpair/)).toBeTruthy();
    expect(screen.getByLabelText("Region map editor").hasAttribute("hidden")).toBe(false);
    await fireEvent.click(screen.getByRole("button", { name: "Runtime" }));
    const hotReload = screen.getByRole("checkbox", { name: "Hot reload" });
    await fireEvent.click(hotReload);

    expect(editorDocument.read().config.settings.hotReload).toBe(false);
    expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(false);

    await fireEvent.click(screen.getByRole("button", { name: "New" }));
    expect(screen.getByText("Create a new configuration")).toBeTruthy();
    await fireEvent.click(screen.getByText("Create", { selector: "button" }));
    expect(editorDocument.read().config.settings.hotReload).toBe(true);
    expect(editorDocument.read().dirty).toBe(true);
  });

  test("deletes an in-use mode with the replacement selected in the Solid dialog", async () => {
    const editorDocument = createPalLawDocument(createMemoryDraftAdapter());
    render(() => <App editorDocument={editorDocument} createMap={() => ({ update: vi.fn(), dispatch: vi.fn(), dispose: vi.fn() })} />);
    await fireEvent.click(screen.getByRole("button", { name: "Modes" }));
    await fireEvent.click(screen.getByRole("button", { name: "Delete PvE" }));
    const replacement = screen.getByLabelText("Replacement mode");
    await fireEvent.change(replacement, { target: { value: "pvp" } });
    await fireEvent.click(screen.getByText("Confirm", { selector: "button" }));

    expect(editorDocument.read().config.wilderness.mode).toBe("pvp");
    expect(editorDocument.read().config.modes.some((mode) => mode.id === "pve")).toBe(false);
    expect(editorDocument.read().canUndo).toBe(true);
  });

  test("edits the fixed Stage Areas policy through the shared area dialog", async () => {
    const editorDocument = createPalLawDocument(createMemoryDraftAdapter());
    render(() => <App editorDocument={editorDocument} createMap={() => ({ update: vi.fn(), dispatch: vi.fn(), dispose: vi.fn() })} />);

    await fireEvent.click(screen.getByLabelText("Edit Stage Areas Stage Areas"));
    expect(screen.getByText("Stage Areas settings")).toBeTruthy();
    expect(screen.getByText(/Dungeon, Boss Battle, Arena, Room, and Raid Boss/)).toBeTruthy();
    await fireEvent.click(screen.getByRole("radio", { name: /Safe/, hidden: true }));

    expect(editorDocument.read().config.stageAreas.mode).toBe("safe");
  });
});
