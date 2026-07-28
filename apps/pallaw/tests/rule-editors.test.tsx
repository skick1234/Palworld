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
    const labels = [...description!.querySelectorAll(".matrix-definition-list > strong")].map((element) => element.textContent);
    const definitions = [...description!.querySelectorAll(".matrix-definition-list > span")].map((element) => element.textContent);
    expect(labels).toEqual(["Player", "Partner Pal"]);
    expect(definitions[0]).toBe("A player character.");
    expect(definitions[1]).toBe("A Pal currently partnered with and controlled by a player.");
  });

  test("shows a same-actor relationship definition only once", async () => {
    render(() => <CombatMatrix matrix={{ player: { player: true } }} isMode={true} overrideFor={() => "allow"} onChange={vi.fn()} />);

    await fireEvent.mouseEnter(screen.getByRole("button", { name: /^Player to Player:/ }));

    const description = document.querySelector(".matrix-actor-description");
    const labels = [...description!.querySelectorAll(".matrix-definition-list > strong")].map((element) => element.textContent);
    const definitions = [...description!.querySelectorAll(".matrix-definition-list > span")].map((element) => element.textContent);
    expect(labels).toEqual(["Player"]);
    expect(definitions).toEqual(["A player character."]);
  });
});
