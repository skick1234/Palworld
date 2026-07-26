import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, test, vi } from "vitest";
import { LocalizationInspector } from "../src/ui/LocalizationInspector";

describe("LocalizationInspector", () => {
  test("reports an action display name intent", async () => {
    const change = vi.fn();
    render(() => <LocalizationInspector names={{ build: "Building" }} onChange={change} />);
    await fireEvent.change(screen.getByLabelText("Build"), { target: { value: "Construction" } });
    expect(change).toHaveBeenCalledWith("build", "Construction");
  });
});
