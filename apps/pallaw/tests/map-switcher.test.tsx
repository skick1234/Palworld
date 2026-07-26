import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, test, vi } from "vitest";
import { MapSwitcher } from "../src/ui/MapSwitcher";

describe("MapSwitcher", () => {
  test("marks the active map and reports a new map selection", async () => {
    const select = vi.fn();
    render(() => <MapSwitcher maps={[{ id: "world", label: "World" }, { id: "tree", label: "World Tree" }]} activeId="world" onSelect={select} />);
    expect(screen.getByRole("button", { name: "World" }).getAttribute("aria-pressed")).toBe("true");
    await fireEvent.click(screen.getByRole("button", { name: "World Tree" }));
    expect(select).toHaveBeenCalledWith("tree");
  });
});
