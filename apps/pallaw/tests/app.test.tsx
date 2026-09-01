import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { App } from "../src/ui/App";
import { createPalLawDocument } from "../src/document/create-pallaw-document";
import { createMemoryDraftAdapter } from "../src/document/local-draft-adapter";

const styles = readFileSync(resolve(process.cwd(), "apps/pallaw/src/styles.css"), "utf8");

describe("PalLaw application", () => {
  afterEach(cleanup);
  test("owns navigation and document history through one Solid root", async () => {
    const editorDocument = createPalLawDocument(createMemoryDraftAdapter());
    render(() => <App editorDocument={editorDocument} createMap={() => ({ update: vi.fn(), dispatch: vi.fn(), dispose: vi.fn() })} />);

    expect(screen.getByText(/Not affiliated with Pocketpair/)).toBeTruthy();
    expect(screen.getByLabelText("Area map").hasAttribute("hidden")).toBe(false);
    await fireEvent.click(screen.getByRole("button", { name: "Settings" }));
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

  test("creates identity-free duplicate schedule notices through the schedules workspace", async () => {
    const editorDocument = createPalLawDocument(createMemoryDraftAdapter());
    render(() => <App editorDocument={editorDocument} createMap={() => ({ update: vi.fn(), dispatch: vi.fn(), dispose: vi.fn() })} />);

    await fireEvent.click(screen.getByRole("button", { name: /^Schedules/ }));
    await fireEvent.click(screen.getByRole("button", { name: "Add schedule" }));
    const noticesHeading = await screen.findByText("Broadcast notices");
    expect(noticesHeading.closest('[data-workspace-pane="list"]')).toBeNull();
    expect(noticesHeading.closest('[data-workspace-pane="edit"]')).toBeTruthy();
    const assignMode = screen.getByLabelText("Announcements only. Assign mode");
    expect(screen.getByLabelText("ID").closest(".schedule-id-mode-grid")).toBe(assignMode.closest(".schedule-id-mode-grid"));
    expect(screen.queryByText("Stable reference used by assigned Areas.")).toBeNull();
    const inputHeight = styles.match(/input, select, textarea \{[^}]*min-height:\s*([^;]+);/s)?.[1];
    const scheduleModeHeight = styles.match(/\.schedule-mode-select\s*\{[^}]*height:\s*([^;]+);/s)?.[1];
    expect(inputHeight).toBe("36px");
    expect(scheduleModeHeight).toBe(inputHeight);
    expect(document.querySelector(".announcement-channels, .announcement-channel")).toBeNull();

    const globalChat = screen.getByLabelText("Global chat message") as HTMLTextAreaElement;
    globalChat.focus();
    await fireEvent.input(globalChat, { target: { value: "Restart in {minutes} minutes." } });
    expect(document.activeElement).toBe(globalChat);
    expect(editorDocument.read().config.schedules[0]!.announcements[0]!.globalChat.text).toBe("Restart in {minutes} minutes.");

    await fireEvent.click(screen.getByRole("checkbox", { name: "Server notice" }));
    const serverNotice = screen.getByLabelText("Server notice message") as HTMLTextAreaElement;
    serverNotice.focus();
    await fireEvent.input(serverNotice, { target: { value: "Server restart soon." } });
    expect(document.activeElement).toBe(serverNotice);
    expect(editorDocument.read().config.schedules[0]!.announcements[0]!.serverNotice.text).toBe("Server restart soon.");

    await fireEvent.click(assignMode);
    await fireEvent.click(screen.getByRole("radio", { name: /PvE/ }));
    expect(screen.getByLabelText("Assigned mode: PvE. Change mode")).toBeTruthy();
    const wilderness = screen.getByRole("button", { name: /Wilderness/ });
    expect(wilderness.getAttribute("aria-pressed")).toBe("true");
    await fireEvent.click(wilderness);
    expect(wilderness.getAttribute("aria-pressed")).toBe("false");
    await fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    const notices = editorDocument.read().config.schedules[0]!.announcements;
    expect(notices).toHaveLength(2);
    expect(notices[0]).toEqual(notices[1]);
    expect(Object.hasOwn(notices[0]!, "id")).toBe(false);
  });

  test("restores an added schedule and its assigned mode after reload", async () => {
    const persistence = createMemoryDraftAdapter();
    const firstDocument = createPalLawDocument(persistence);
    const view = render(() => <App editorDocument={firstDocument} createMap={() => ({ update: vi.fn(), dispatch: vi.fn(), dispose: vi.fn() })} />);

    await fireEvent.click(screen.getByRole("button", { name: /^Schedules/ }));
    await fireEvent.click(screen.getByRole("button", { name: "Add schedule" }));
    await screen.findByText("Broadcast notices");
    await fireEvent.click(screen.getByLabelText("Announcements only. Assign mode"));
    await fireEvent.click(screen.getByRole("radio", { name: /PvE/ }));
    expect(firstDocument.read().config.schedules[0]?.mode).toBe("pve");

    view.unmount();
    const reloadedDocument = createPalLawDocument(persistence);
    expect(reloadedDocument.read().config.schedules).toHaveLength(1);
    expect(reloadedDocument.read().config.schedules[0]?.mode).toBe("pve");
  });

  test("orders schedules from the sidebar and keeps Add schedule above the list", async () => {
    const editorDocument = createPalLawDocument(createMemoryDraftAdapter());
    render(() => <App editorDocument={editorDocument} createMap={() => ({ update: vi.fn(), dispatch: vi.fn(), dispose: vi.fn() })} />);

    await fireEvent.click(screen.getByRole("button", { name: /^Schedules/ }));
    const add = screen.getByRole("button", { name: "Add schedule" });
    await fireEvent.click(add);
    await fireEvent.click(add);
    const list = add.closest(".schedule-list-actions")?.nextElementSibling;
    expect(list?.classList.contains("list-stack")).toBe(true);
    expect(document.querySelector(".wilderness-kind-label")).toBeNull();
    expect(screen.getAllByText(/Announcements only · 1 notice · 7 days · .* local/)).toHaveLength(2);

    await fireEvent.click(screen.getByRole("button", { name: "Move Announcement 1 later" }));
    expect(editorDocument.read().config.schedules.map((schedule) => schedule.name)).toEqual(["Announcement 2", "Announcement 1"]);
  });

  test("uses flat schedule fields and duplicates Area assignments", async () => {
    const editorDocument = createPalLawDocument(createMemoryDraftAdapter());
    render(() => <App editorDocument={editorDocument} createMap={() => ({ update: vi.fn(), dispatch: vi.fn(), dispose: vi.fn() })} />);

    await fireEvent.click(screen.getByRole("button", { name: /^Schedules/ }));
    await fireEvent.click(screen.getByRole("button", { name: "Add schedule" }));
    await screen.findByText("Broadcast notices");
    await fireEvent.click(screen.getByLabelText("Announcements only. Assign mode"));
    await fireEvent.click(screen.getByRole("radio", { name: /PvE/ }));

    const id = screen.getByLabelText("ID");
    const name = screen.getByLabelText("Name");
    expect(Boolean(id.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.getByText("Repeats on").closest(".schedule-repeat-field")).toBeTruthy();
    expect(screen.queryByLabelText("Priority")).toBeNull();

    await fireEvent.click(screen.getByRole("button", { name: "Duplicate Announcement 1" }));
    expect(editorDocument.read().config.schedules).toHaveLength(2);
    expect(editorDocument.read().config.wilderness.schedules).toEqual(["schedule-1", "schedule-1-copy"]);
  });

  test("restores an in-progress schedule draft with validation errors after reload", async () => {
    const persistence = createMemoryDraftAdapter();
    const firstDocument = createPalLawDocument(persistence);
    const view = render(() => <App editorDocument={firstDocument} createMap={() => ({ update: vi.fn(), dispatch: vi.fn(), dispose: vi.fn() })} />);

    await fireEvent.click(screen.getByRole("button", { name: /^Schedules/ }));
    await fireEvent.click(screen.getByRole("button", { name: "Add schedule" }));
    await screen.findByText("Broadcast notices");
    await fireEvent.click(screen.getByLabelText("Announcements only. Assign mode"));
    await fireEvent.click(screen.getByRole("radio", { name: /PvE/ }));
    await fireEvent.click(screen.getByRole("button", { name: /Wilderness/ }));
    expect(firstDocument.read().validation.valid).toBe(false);
    expect(persistence.read()).toContain('"schedules"');

    view.unmount();
    const reloadedDocument = createPalLawDocument(persistence);
    expect(reloadedDocument.read().config.schedules).toHaveLength(1);
    expect(reloadedDocument.read().config.schedules[0]?.mode).toBe("pve");
    expect(reloadedDocument.read().validation.valid).toBe(false);
  });

  test("deletes an in-use mode with the replacement selected in the Solid dialog", async () => {
    const editorDocument = createPalLawDocument(createMemoryDraftAdapter());
    render(() => <App editorDocument={editorDocument} createMap={() => ({ update: vi.fn(), dispatch: vi.fn(), dispose: vi.fn() })} />);
    await fireEvent.click(screen.getByRole("button", { name: /^Modes/ }));
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
    expect(await screen.findByText(/Dungeon, Boss Battle, Arena, Room, and Raid Boss/)).toBeTruthy();
    await fireEvent.click(screen.getByRole("radio", { name: /Safe/, hidden: true }));

    expect(editorDocument.read().config.stageAreas.mode).toBe("safe");
  });
});
