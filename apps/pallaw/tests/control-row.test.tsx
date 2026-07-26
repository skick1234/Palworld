import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ControlRow, ControlRowGroup } from "../src/ui/ControlRow";

describe("ControlRow", () => {
  afterEach(cleanup);

  test("renders a boolean control with the shared direct-child layout", async () => {
    const change = vi.fn();
    render(() => <ControlRowGroup><ControlRow kind="boolean" label="Hot reload" description="Watch the configuration file." checked={true} onChange={change} /></ControlRowGroup>);

    const row = screen.getByLabelText("Hot reload").closest(".control-row");
    expect(row?.querySelector(":scope > .control-row-copy")).not.toBeNull();
    expect(row?.querySelector(":scope > .switch")).not.toBeNull();
    expect(row?.children).toHaveLength(2);
    await fireEvent.click(screen.getByLabelText("Hot reload"));
    expect(change).toHaveBeenCalledWith(false);
  });

  test("renders and bounds a numeric control with the same row contract", async () => {
    const change = vi.fn();
    render(() => <ControlRow kind="number" label="Cooldown seconds" value={2} min={0} max={300} step={0.1} onChange={change} />);

    const input = screen.getByLabelText("Cooldown seconds");
    const row = input.closest(".control-row-number");
    expect(row?.querySelector(":scope > .control-row-copy")).not.toBeNull();
    expect(row?.children).toHaveLength(2);
    await fireEvent.change(input, { target: { value: "500" } });
    expect(change).toHaveBeenCalledWith(300);
  });

  test("supports the standalone page-row presentation", () => {
    render(() => <ControlRow kind="boolean" variant="standalone" label="Use this region" checked={true} onChange={() => undefined} />);

    expect(screen.getByLabelText("Use this region").closest(".toggle-row")).not.toBeNull();
  });
});
