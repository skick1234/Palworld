import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SettingsInspector } from "../src/ui/SimpleInspectors";

describe("SettingsInspector", () => {
  afterEach(cleanup);

  test("reports a boolean setting change by setting identifier", async () => {
    const change = vi.fn();
    render(() => <SettingsInspector settings={{ hotReload: true, hotReloadSeconds: 1, worldRules: true, adminBypass: true, playerSweepSeconds: 0.25, mountGraceSeconds: 15, debugLogging: false }} regionalCombat={{ enabled: true }} onChange={change} />);

    await fireEvent.click(screen.getByLabelText("Hot reload"));
    expect(change).toHaveBeenCalledWith("settings", "hotReload", false);
  });

  test("reports a bounded numeric setting change by setting identifier", async () => {
    const change = vi.fn();
    render(() => <SettingsInspector settings={{ hotReload: true, hotReloadSeconds: 1, worldRules: true, adminBypass: true, playerSweepSeconds: 0.25, mountGraceSeconds: 15, debugLogging: false }} regionalCombat={{ enabled: true }} onChange={change} />);

    const input = screen.getByLabelText("Reload interval");
    await fireEvent.change(input, { target: { value: "2.5" } });
    expect(change).toHaveBeenCalledWith("settings", "hotReloadSeconds", 2.5);
  });
});
