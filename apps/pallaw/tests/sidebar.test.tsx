import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, test, vi } from "vitest";
import { RegionSidebar } from "../src/ui/Sidebar";

describe("RegionSidebar", () => {
  test("filters regions and reports selection through intent callbacks", async () => {
    const select = vi.fn();
    render(() => (
      <RegionSidebar
        wilderness={{ name: "Wilderness", mode: "safe" }}
        regions={[{ name: "North", mode: "safe", map: "world" }, { name: "South", mode: "pvp", map: "world" }]}
        modes={[{ id: "safe", name: "Safe", color: "#22c55e" }, { id: "pvp", name: "PvP", color: "#f43f5e" }]}
        selectedIndex={0}
        onSelect={select}
        onOpenWilderness={() => undefined}
        onOpenRegion={() => undefined}
        onMove={() => undefined}
        onDuplicate={() => undefined}
        onDelete={() => undefined}
      />
    ));

    await fireEvent.input(screen.getByRole("searchbox"), { target: { value: "south" } });
    expect(screen.queryByLabelText("Select North")).toBeNull();
    await fireEvent.click(screen.getByLabelText("Select South"));
    expect(select).toHaveBeenCalledWith(1);
  });
});
