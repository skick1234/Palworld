import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, test, vi } from "vitest";
import { WorkspaceViewNav } from "../src/ui/WorkspaceViewNav";

describe("WorkspaceViewNav", () => {
  test("offers Regions and Map workspace views for the Regions section", async () => {
    const select = vi.fn();
    render(() => <WorkspaceViewNav section="regions" view="list" onSelect={select} />);

    expect(screen.getByRole("button", { name: "Regions" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Map" })).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Map" }));
    expect(select).toHaveBeenCalledWith("map");
  });
});
