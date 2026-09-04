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
    render(() => <CombatMatrix matrix={{ player: { partnerPal: 1 } }} isMode={true} overrideFor={() => 1} onChange={vi.fn()} />);

    await fireEvent.mouseEnter(screen.getByRole("button", { name: /Player to Partner Pal/ }));

    const description = document.querySelector(".matrix-actor-description");
    const labels = [...description!.querySelectorAll(".matrix-definition-list > strong")].map((element) => element.textContent);
    const definitions = [...description!.querySelectorAll(".matrix-definition-list > span")].map((element) => element.textContent);
    expect(labels).toEqual(["Player", "Partner Pal"]);
    expect(definitions[0]).toBe("A player character.");
    expect(definitions[1]).toBe("A Pal currently partnered with and controlled by a player.");
  });

  test("shows a same-actor relationship definition only once", async () => {
    render(() => <CombatMatrix matrix={{ player: { player: 1 } }} isMode={true} overrideFor={() => 1} onChange={vi.fn()} />);

    await fireEvent.mouseEnter(screen.getByRole("button", { name: /^Player to Player:/ }));

    const description = document.querySelector(".matrix-actor-description");
    const labels = [...description!.querySelectorAll(".matrix-definition-list > strong")].map((element) => element.textContent);
    const definitions = [...description!.querySelectorAll(".matrix-definition-list > span")].map((element) => element.textContent);
    expect(labels).toEqual(["Player"]);
    expect(definitions).toEqual(["A player character."]);
  });
});

describe("CombatMatrix multipliers", () => {
  test("cycles an area cell Default, Allow, Deny, Default", async () => {
    const change = vi.fn();
    let override: number | null = null;
    render(() => <CombatMatrix matrix={{ player: { wildPal: 1 } }} isMode={false} modeName="Safe" overrideFor={() => override} onChange={change} />);

    await fireEvent.click(screen.getByRole("button", { name: /Player to Wild Pal: Default, effective 1×/ }));
    expect(change).toHaveBeenLastCalledWith("player", "wildPal", 1);
    override = 1;
    await fireEvent.click(screen.getByRole("button", { name: /Player to Wild Pal/ }));
    expect(change).toHaveBeenLastCalledWith("player", "wildPal", 0);
    override = 0;
    await fireEvent.click(screen.getByRole("button", { name: /Player to Wild Pal/ }));
    expect(change).toHaveBeenLastCalledWith("player", "wildPal", null);
  });

  test("toggles a mode cell between 1 and 0", async () => {
    const change = vi.fn();
    render(() => <CombatMatrix matrix={{ player: { wildPal: 0.5 } }} isMode={true} overrideFor={() => 0.5} onChange={change} />);

    const cell = screen.getByRole("button", { name: /Player to Wild Pal: 0.5×/ });
    expect(cell.classList.contains("scaled")).toBe(true);
    expect(cell.querySelector(".matrix-cell-primary")!.textContent).toBe("0.5×");
    await fireEvent.click(cell);
    expect(change).toHaveBeenCalledWith("player", "wildPal", 0);
  });

  test("writes a custom multiplier from the selected cell input and clears it back to default", async () => {
    const change = vi.fn();
    render(() => <CombatMatrix matrix={{ player: { wildPal: 0.5 } }} isMode={false} modeName="Safe" overrideFor={() => 0.5} onChange={change} />);

    expect(screen.queryByLabelText("Player to Wild Pal damage multiplier")).toBeNull();
    await fireEvent.focus(screen.getByRole("button", { name: /Player to Wild Pal: 0.5× override/ }));
    const input = screen.getByLabelText("Player to Wild Pal damage multiplier") as HTMLInputElement;
    expect(input.type).toBe("number");
    expect(input.getAttribute("max")).toBe("10");
    expect(input.value).toBe("0.5");

    await fireEvent.change(input, { target: { value: "2.5" } });
    expect(change).toHaveBeenLastCalledWith("player", "wildPal", 2.5);
    await fireEvent.change(input, { target: { value: "11" } });
    expect(change).toHaveBeenCalledTimes(1);
    await fireEvent.change(input, { target: { value: "" } });
    expect(change).toHaveBeenLastCalledWith("player", "wildPal", null);
  });
});
