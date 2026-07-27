import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AreaEditor } from "../src/ui/AreaEditor";

describe("AreaEditor", () => {
  afterEach(cleanup);

  test("reports a region availability change", async () => {
    const change = vi.fn();
    const area = { name: "North", mode: "safe", enabled: true, map: "world", minimumLevel: null, polygon: [[0, 0], [10, 0], [0, 10]] as [number, number][], actions: {}, combat: [], messages: {} };
    render(() => <AreaEditor area={area} kind="region" modes={[{ id: "safe", name: "Safe", color: "#22C55E" }]} maps={[{ id: "world", label: "World" }]} effectiveActions={{}} effectiveCombat={{}} modeName="Safe" messages={{ enabled: true, actionNames: {} }} resolvedMessages={{}} overrideFor={() => "default"} onChange={change} />);

    await fireEvent.click(screen.getByLabelText("Use this region"));
    expect(change).toHaveBeenCalledWith({ type: "set-enabled", value: false });
  });

  test("reports a region name change without mutating its input", async () => {
    const change = vi.fn();
    const area = { name: "North", mode: "safe", enabled: true, map: "world", minimumLevel: null, polygon: [[0, 0], [10, 0], [0, 10]] as [number, number][], actions: {}, combat: [], messages: {} };
    render(() => <AreaEditor area={area} kind="region" modes={[{ id: "safe", name: "Safe", color: "#22C55E" }]} maps={[{ id: "world", label: "World" }]} effectiveActions={{}} effectiveCombat={{}} modeName="Safe" messages={{ enabled: true, actionNames: {} }} resolvedMessages={{}} overrideFor={() => "default"} onChange={change} />);
    await fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  Northern Reach " } });
    expect(change).toHaveBeenCalledWith({ type: "set-name", value: "Northern Reach" });
    expect(area.name).toBe("North");
  });

  test("shows the current mode until its wrapping badge menu is opened", async () => {
    const change = vi.fn();
    const area = { name: "North", mode: "safe", enabled: true, map: "world", minimumLevel: null, polygon: [[0, 0], [10, 0], [0, 10]] as [number, number][], actions: {}, combat: [], messages: {} };
    render(() => <AreaEditor area={area} kind="region" modes={[{ id: "safe", name: "Safe", color: "#22C55E" }, { id: "pvp", name: "PvP", color: "#EF4444" }]} maps={[{ id: "world", label: "World" }]} effectiveActions={{}} effectiveCombat={{}} modeName="Safe" messages={{ enabled: true, actionNames: {} }} resolvedMessages={{}} overrideFor={() => "default"} onChange={change} />);

    const toggle = screen.getByLabelText("Current mode: Safe. Change mode");
    const disclosure = toggle.closest("details");
    expect(screen.queryByText("Changing mode preserves explicit overrides.")).toBeNull();
    expect(disclosure?.open).toBe(false);
    await fireEvent.click(toggle);
    expect(disclosure?.open).toBe(true);
    expect(screen.getByRole("radiogroup", { name: "Mode" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Safe/ }).getAttribute("aria-checked")).toBe("true");
    await fireEvent.click(screen.getByRole("radio", { name: /PvP/ }));
    expect(change).toHaveBeenCalledWith({ type: "set-mode", value: "pvp" });
    expect(disclosure?.open).toBe(false);
  });

  test("reports invalid polygon coordinates without throwing or dispatching", async () => {
    const change = vi.fn();
    const area = { name: "North", mode: "safe", enabled: true, map: "world", minimumLevel: null, polygon: [[0, 0], [10, 0], [0, 10]] as [number, number][], actions: {}, combat: [], messages: {} };
    render(() => <AreaEditor area={area} kind="region" modes={[{ id: "safe", name: "Safe", color: "#22C55E" }]} maps={[{ id: "world", label: "World" }]} effectiveActions={{}} effectiveCombat={{}} modeName="Safe" messages={{ enabled: true, actionNames: {} }} resolvedMessages={{}} overrideFor={() => "default"} onChange={change} />);
    await fireEvent.input(screen.getByLabelText("Runtime world coordinates"), { target: { value: "not json" } });
    await fireEvent.click(screen.getByRole("button", { name: "Apply coordinates" }));

    expect(screen.getByRole("alert").textContent).toContain("Polygon coordinates");
    expect(change).not.toHaveBeenCalled();
  });
});
