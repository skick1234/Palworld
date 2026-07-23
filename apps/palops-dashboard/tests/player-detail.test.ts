import { describe, expect, test } from "bun:test";
import {
  effectLabel,
  nonZeroRelics,
  roundedCombatPower,
  scoredPassiveContributions,
} from "../src/player-detail";

describe("player detail presentation", () => {
  test("keeps only effects that change combat power", () => {
    const effects = scoredPassiveContributions([
      { effect_type: "MoveSpeed", effect_value: 20, weight: 0, points: 0, applied_to_core: false },
      { effect_type: "ShotAttack", effect_value: 30, weight: 0, points: 0, applied_to_core: true },
      { effect_type: "LifeSteal", effect_value: 4, weight: 0.75, points: 3, applied_to_core: false },
      { effect_type: "no", effect_value: 0, weight: 0, points: 0, applied_to_core: false },
    ]);

    expect(effects.map((effect) => effect.effect_type)).toEqual(["ShotAttack", "LifeSteal"]);
  });

  test("removes zero-value relics and humanizes effect names", () => {
    expect(nonZeroRelics({ CapturePower: 4, ClimbSpeed: 0, StatusAilmentResist: 2 })).toEqual([
      { relic_type: "Capture power", count: 4 },
      { relic_type: "Status ailment resist", count: 2 },
    ]);
    expect(effectLabel("ActiveSkillCoolTime_Decrease")).toBe("Active skill cool time decrease");
  });

  test("rounds plain and structured Combat Power values to integers", () => {
    expect(roundedCombatPower(26105.2499958277)).toBe(26105);
    expect(roundedCombatPower({ value: 3598.75, complete: true })).toEqual({
      value: 3599,
      complete: true,
    });
  });
});
