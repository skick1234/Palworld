import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, test, vi } from "vitest";
import { ModeInspector } from "../src/ui/ModeInspector";

describe("ModeInspector", () => {
  test("reports a normalized mode name intent", async () => {
    const change = vi.fn();
    render(() => <ModeInspector mode={{ id: "safe", name: "Safe", color: "#22C55E", minimumLevel: null, actions: { build: true }, combat: {} }} messages={{ enabled: true, actionNames: {} }} resolvedMessages={{}} onChange={change} />);
    const name = screen.getByLabelText("Name");
    await fireEvent.change(name, { target: { value: "  Peaceful  " } });
    expect(change).toHaveBeenCalledWith({ type: "set-name", value: "Peaceful" });
  });
});
