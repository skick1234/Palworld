import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ActionsEditor, CombatMatrix } from "../src/ui/RuleEditors";

afterEach(cleanup);

describe("ActionsEditor", () => {
  test("cycles an inherited boolean action to an explicit allow intent", async () => {
    const change = vi.fn();
    render(() => <ActionsEditor actions={{}} effective={{ build: false }} isMode={false} onChange={change} />);

    await fireEvent.click(screen.getByRole("button", { name: /Build: Default, effective Deny/ }));
    expect(change).toHaveBeenCalledWith("build", true);
  });
});

describe("CombatMatrix", () => {
  test("updates actor definitions when a matrix cell is hovered", async () => {
    render(() => <CombatMatrix matrix={{ player: { partnerPal: true } }} isMode={true} overrideFor={() => "allow"} onChange={vi.fn()} />);

    await fireEvent.mouseEnter(screen.getByRole("button", { name: /Player to Partner Pal/ }));

    const description = document.querySelector(".matrix-actor-description");
    expect(description?.textContent).toContain("Player to Partner Pal");
    expect(description?.textContent).toContain("A player character. A Pal currently partnered with and controlled by a player.");
  });
});
