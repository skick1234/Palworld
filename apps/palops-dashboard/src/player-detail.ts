export type PassiveContribution = Record<string, unknown> & {
  effect_type?: unknown;
  effect_value?: unknown;
  points?: unknown;
  applied_to_core?: unknown;
};

const coreEffects = new Map([
  ["MaxHP", 0],
  ["ShotAttack", 1],
  ["Defense", 2],
]);

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function effectLabel(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  const spaced = raw
    .replaceAll("_", " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return "Unknown effect";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function scoredPassiveContributions(
  records: PassiveContribution[],
): PassiveContribution[] {
  return records
    .filter((record) => {
      const type = typeof record.effect_type === "string" ? record.effect_type : "";
      return record.applied_to_core === true ||
        coreEffects.has(type) ||
        Math.abs(numeric(record.points)) > 0.0001;
    })
    .sort((left, right) => {
      const leftType = typeof left.effect_type === "string" ? left.effect_type : "";
      const rightType = typeof right.effect_type === "string" ? right.effect_type : "";
      const leftCore = coreEffects.get(leftType);
      const rightCore = coreEffects.get(rightType);
      if (leftCore !== undefined || rightCore !== undefined) {
        if (leftCore === undefined) return 1;
        if (rightCore === undefined) return -1;
        return leftCore - rightCore;
      }
      return Math.abs(numeric(right.points)) - Math.abs(numeric(left.points)) ||
        effectLabel(leftType).localeCompare(effectLabel(rightType));
    });
}

export function nonZeroRelics(
  relics: Record<string, unknown>,
): Array<{ relic_type: string; count: number }> {
  return Object.entries(relics)
    .filter(([, count]) => numeric(count) > 0)
    .map(([type, count]) => ({ relic_type: effectLabel(type), count: numeric(count) }));
}

export function roundedCombatPower(value: unknown): unknown {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (value && typeof value === "object" &&
      typeof (value as { value?: unknown }).value === "number" &&
      Number.isFinite((value as { value: number }).value)) {
    return {
      ...value,
      value: Math.round((value as { value: number }).value),
    };
  }
  return value;
}
