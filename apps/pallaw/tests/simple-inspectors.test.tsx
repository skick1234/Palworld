import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SettingsInspector, type RuntimeSettings } from "../src/ui/SimpleInspectors";

const settings = {
  hotReload: true,
  hotReloadSeconds: 1,
  worldRules: true,
  adminBypass: true,
  playerSweepSeconds: 0.25,
  mountGraceSeconds: 15,
  refundDeniedSpheres: false,
  disableCaptureAim: false,
  debugLogging: false,
} satisfies RuntimeSettings;

describe("SettingsInspector", () => {
  afterEach(cleanup);

  test("reports a boolean setting change by setting identifier", async () => {
    const change = vi.fn();
    render(() => <SettingsInspector settings={settings} regionalCombat={{ enabled: true }} onChange={change} />);

    await fireEvent.click(screen.getByLabelText("Hot reload"));
    expect(change).toHaveBeenCalledWith("settings", "hotReload", false);
  });

  test("reports a bounded numeric setting change by setting identifier", async () => {
    const change = vi.fn();
    render(() => <SettingsInspector settings={settings} regionalCombat={{ enabled: true }} onChange={change} />);

    const input = screen.getByLabelText("Reload interval");
    await fireEvent.change(input, { target: { value: "2.5" } });
    expect(change).toHaveBeenCalledWith("settings", "hotReloadSeconds", 2.5);
  });
});
