import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { RegionSidebar } from "../src/ui/Sidebar";

describe("RegionSidebar", () => {
  afterEach(cleanup);

  test("keeps wilderness and stage descriptions in the footer row", () => {
    render(() => (
      <RegionSidebar
        wilderness={{ name: "Wilderness", mode: "safe" }}
        stageAreas={{ name: "Stage Areas", mode: "safe" }}
        regions={[]}
        modes={[{ id: "safe", name: "Safe", color: "#22c55e" }]}
        selectedIndex={null}
        onSelect={() => undefined}
        onOpenWilderness={() => undefined}
        onOpenStageAreas={() => undefined}
        onOpenRegion={() => undefined}
        onMove={() => undefined}
        onDuplicate={() => undefined}
        onDelete={() => undefined}
      />
    ));

    const wilderness = document.querySelector("[data-wilderness]");
    const stageAreas = document.querySelector("[data-stage-areas]");
    expect(wilderness?.querySelector(".sidebar-card-detail")).toBeNull();
    expect(wilderness?.querySelector(".sidebar-card-footer")?.firstElementChild?.textContent).toBe("Outside region");
    expect(stageAreas?.querySelector(".sidebar-card-detail")).toBeNull();
    expect(stageAreas?.querySelector(".sidebar-card-footer")?.firstElementChild?.textContent).toBe("Fixed stage priority");
  });

  test("filters regions and reports selection through intent callbacks", async () => {
    const select = vi.fn();
    render(() => (
      <RegionSidebar
        wilderness={{ name: "Wilderness", mode: "safe" }}
        stageAreas={{ name: "Stage Areas", mode: "safe" }}
        regions={[{ name: "North", mode: "safe", map: "world" }, { name: "South", mode: "pvp", map: "world" }]}
        modes={[{ id: "safe", name: "Safe", color: "#22c55e" }, { id: "pvp", name: "PvP", color: "#f43f5e" }]}
        selectedIndex={0}
        onSelect={select}
        onOpenWilderness={() => undefined}
        onOpenStageAreas={() => undefined}
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
