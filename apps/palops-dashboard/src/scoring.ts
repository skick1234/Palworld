export type PassiveEffectObservation = {
  effect_type: string;
  effect_value: number;
  granted_by_another_pal: boolean;
  partner_skill: boolean;
};

export type PartyPalRankingInput = {
  pal_id: string;
  owner_player_id: string;
  owner_display_name: string;
  guild_id: string | null;
  guild_name: string | null;
  species: string;
  display_name: string;
  level: number;
  condenser_rank: number;
  max_hp: number;
  shot_attack: number;
  defense: number;
  passives: PassiveEffectObservation[];
  observed_at: string;
  stale: boolean;
};

export type PlayerRankingInput = {
  player_id: string;
  display_name: string;
  guild_id: string | null;
  guild_name: string | null;
  level: number;
  party_pal_ids: string[];
  counts: {
    owned_pals: number;
    party_pals: number;
    inventory_items: number;
    unlocked_technologies: number;
  };
  observed_at: string;
  stale: boolean;
  complete: boolean;
};

export type GuildRankingInput = {
  guild_id: string;
  name: string;
  member_player_ids: string[];
  observed_at: string;
  stale: boolean;
  complete: boolean;
};

export type Score = {
  value: number;
  formula: string;
  policy_version: number | null;
  observed_at: string;
  complete: boolean;
};

export type CombatContribution = {
  effect_type: string;
  effect_value: number;
  weight: number;
  points: number;
  applied_to_core: boolean;
};

export type CombatPower = {
  value: number;
  contributions: CombatContribution[];
};

const coreEffects = new Set(["MaxHP", "ShotAttack", "Defense"]);

function checkedNonNegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number`);
  }
  return value;
}

export function calculatePalFirepower(
  pal: Pick<
    PartyPalRankingInput,
    "max_hp" | "shot_attack" | "defense" | "condenser_rank"
  >,
): number {
  const hp = checkedNonNegative(pal.max_hp, "max_hp");
  const attack = checkedNonNegative(pal.shot_attack, "shot_attack");
  const defense = checkedNonNegative(pal.defense, "defense");
  if (!Number.isInteger(pal.condenser_rank) ||
      pal.condenser_rank < 0 ||
      pal.condenser_rank > 4) {
    throw new RangeError("condenser_rank must be an integer from 0 through 4");
  }
  const rank = pal.condenser_rank + 1;
  return Math.floor((Math.floor(hp / 5) + attack + defense) * rank * rank);
}

export function calculatePalCombatPower(
  pal: Pick<
    PartyPalRankingInput,
    "max_hp" | "shot_attack" | "defense" | "passives"
  >,
  weights: Record<string, number>,
): CombatPower {
  const hp = checkedNonNegative(pal.max_hp, "max_hp");
  const attack = checkedNonNegative(pal.shot_attack, "shot_attack");
  const defense = checkedNonNegative(pal.defense, "defense");
  const contributions: CombatContribution[] = [];
  let hpPercent = 0;
  let attackPercent = 0;
  let defensePercent = 0;

  for (const effect of pal.passives) {
    if (effect.granted_by_another_pal || effect.partner_skill) continue;
    const appliedToCore = coreEffects.has(effect.effect_type);
    const weight = appliedToCore ? 0 : (weights[effect.effect_type] ?? 0);
    const points = appliedToCore ? 0 : effect.effect_value * weight;
    contributions.push({
      effect_type: effect.effect_type,
      effect_value: effect.effect_value,
      weight,
      points,
      applied_to_core: appliedToCore,
    });
    if (effect.effect_type === "MaxHP") hpPercent += effect.effect_value;
    else if (effect.effect_type === "ShotAttack") {
      attackPercent += effect.effect_value;
    } else if (effect.effect_type === "Defense") {
      defensePercent += effect.effect_value;
    }
  }

  const adjust = (base: number, percent: number) =>
    Math.floor(base * Math.max(0, 1 + percent / 100));
  const core =
    Math.floor(adjust(hp, hpPercent) / 5) +
    adjust(attack, attackPercent) +
    adjust(defense, defensePercent);
  const additive = contributions.reduce(
    (total, contribution) => total + contribution.points,
    0,
  );
  return {
    value: Math.max(0, core + additive),
    contributions,
  };
}

function score(
  value: number,
  formula: string,
  policyVersion: number | null,
  observedAt: string,
  complete: boolean,
): Score {
  return {
    value,
    formula,
    policy_version: policyVersion,
    observed_at: observedAt,
    complete,
  };
}

export function buildRankings(
  players: PlayerRankingInput[],
  pals: PartyPalRankingInput[],
  guilds: GuildRankingInput[],
  weights: Record<string, number>,
  policyVersion: number,
) {
  const scoredPals = pals.map((pal) => {
    const combat = calculatePalCombatPower(pal, weights);
    return {
      ...pal,
      firepower: score(
        calculatePalFirepower(pal),
        "paldb-v1",
        null,
        pal.observed_at,
        true,
      ),
      combat_power: score(
        combat.value,
        "palops-v1",
        policyVersion,
        pal.observed_at,
        true,
      ),
      contributions: combat.contributions,
    };
  });
  const palsById = new Map(scoredPals.map((pal) => [pal.pal_id, pal]));
  const scoredPlayers = players.map((player) => {
    const party = player.party_pal_ids
      .map((id) => palsById.get(id))
      .filter((pal): pal is (typeof scoredPals)[number] => pal !== undefined);
    const complete =
      player.complete && party.length === player.party_pal_ids.length;
    return {
      ...player,
      team_firepower: score(
        party.reduce((total, pal) => total + pal.firepower.value, 0),
        "paldb-v1",
        null,
        player.observed_at,
        complete,
      ),
      team_combat_power: score(
        party.reduce((total, pal) => total + pal.combat_power.value, 0),
        "palops-v1",
        policyVersion,
        player.observed_at,
        complete,
      ),
    };
  });
  const playersById = new Map(
    scoredPlayers.map((player) => [player.player_id, player]),
  );
  const scoredGuilds = guilds.map((guild) => {
    const members = guild.member_player_ids
      .map((id) => playersById.get(id))
      .filter((player): player is (typeof scoredPlayers)[number] =>
        player !== undefined
      );
    const complete =
      guild.complete &&
      members.length === guild.member_player_ids.length &&
      members.every((member) => member.team_combat_power.complete);
    return {
      ...guild,
      member_count: guild.member_player_ids.length,
      contributing_member_count: members.length,
      firepower: score(
        members.reduce(
          (total, member) => total + member.team_firepower.value,
          0,
        ),
        "paldb-v1",
        null,
        guild.observed_at,
        complete,
      ),
      combat_power: score(
        members.reduce(
          (total, member) => total + member.team_combat_power.value,
          0,
        ),
        "palops-v1",
        policyVersion,
        guild.observed_at,
        complete,
      ),
    };
  });

  scoredPals.sort((left, right) =>
    right.combat_power.value - left.combat_power.value
  );
  scoredPlayers.sort((left, right) =>
    right.team_combat_power.value - left.team_combat_power.value
  );
  scoredGuilds.sort((left, right) =>
    right.combat_power.value - left.combat_power.value
  );
  return {
    players: scoredPlayers,
    pals: scoredPals,
    guilds: scoredGuilds,
  };
}
