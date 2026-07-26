import { describe, expect, test } from "bun:test";
import {
  buildRankings,
  calculatePalCombatPower,
  calculatePalFirepower,
} from "../src/scoring";

const observedAt = "2026-07-18T12:00:00Z";

const partyPals = [
  {
    pal_id: "pal-a",
    owner_player_id: "player-a",
    owner_display_name: "Alpha",
    guild_id: "guild-a",
    guild_name: "Builders",
    species: "SheepBall",
    display_name: "Alpha Pal",
    level: 30,
    condenser_rank: 1,
    max_hp: 500,
    shot_attack: 100,
    defense: 50,
    passives: [
      {
        effect_type: "ShotAttack",
        effect_value: 20,
        granted_by_another_pal: false,
        partner_skill: false,
      },
      {
        effect_type: "LifeSteal",
        effect_value: 4,
        granted_by_another_pal: false,
        partner_skill: false,
      },
    ],
    observed_at: observedAt,
    stale: false,
  },
  {
    pal_id: "pal-b",
    owner_player_id: "player-b",
    owner_display_name: "Beta",
    guild_id: "guild-a",
    guild_name: "Builders",
    species: "PinkCat",
    display_name: "Beta Pal",
    level: 20,
    condenser_rank: 0,
    max_hp: 300,
    shot_attack: 80,
    defense: 40,
    passives: [],
    observed_at: observedAt,
    stale: false,
  },
];

describe("Dashboard-owned PalOps scoring", () => {
  test("calculates checked Firepower and Combat Power examples from raw inputs", () => {
    expect(calculatePalFirepower(partyPals[0])).toBe(1000);
    expect(
      calculatePalCombatPower(partyPals[0], {
        LifeSteal: 0.5,
        ShotAttack: 0,
      }).value,
    ).toBe(272);
  });

  test("builds player, Party Pal, and guild rankings without server scores", () => {
    const rankings = buildRankings(
      [
        {
          player_id: "player-a",
          display_name: "Alpha",
          guild_id: "guild-a",
          guild_name: "Builders",
          level: 30,
          party_pal_ids: ["pal-a"],
          counts: { owned_pals: 1, party_pals: 1, inventory_items: 0, unlocked_technologies: 0 },
          observed_at: observedAt,
          stale: false,
          complete: true,
        },
        {
          player_id: "player-b",
          display_name: "Beta",
          guild_id: "guild-a",
          guild_name: "Builders",
          level: 20,
          party_pal_ids: ["pal-b"],
          counts: { owned_pals: 1, party_pals: 1, inventory_items: 0, unlocked_technologies: 0 },
          observed_at: observedAt,
          stale: false,
          complete: true,
        },
      ],
      partyPals,
      [
        {
          guild_id: "guild-a",
          name: "Builders",
          member_player_ids: ["player-a", "player-b"],
          observed_at: observedAt,
          stale: false,
          complete: true,
        },
      ],
      { LifeSteal: 0.5, ShotAttack: 0 },
      1,
    );

    expect(rankings.pals.map((entry) => entry.pal_id)).toEqual([
      "pal-a",
      "pal-b",
    ]);
    expect(rankings.players.map((entry) => entry.player_id)).toEqual([
      "player-a",
      "player-b",
    ]);
    expect(rankings.players[0].team_firepower.value).toBe(1000);
    expect(rankings.players[0].team_combat_power.value).toBe(272);
    expect(rankings.guilds[0].combat_power.value).toBe(452);
  });
});
