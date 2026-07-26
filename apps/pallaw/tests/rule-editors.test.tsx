import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, test, vi } from "vitest";
import { ActionsEditor } from "../src/ui/RuleEditors";

describe("ActionsEditor", () => {
  test("cycles an inherited boolean action to an explicit allow intent", async () => {
    const change = vi.fn();
    render(() => <ActionsEditor actions={{}} effective={{ build: false }} isMode={false} onChange={change} />);

    await fireEvent.click(screen.getByRole("button", { name: /Build: Default, effective Deny/ }));
    expect(change).toHaveBeenCalledWith("build", true);
  });
});
