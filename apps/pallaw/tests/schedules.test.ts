import { describe, expect, test } from "vitest";
import {
  createDefaultConfig,
  dueAnnouncements,
  hydrateConfig,
  nextOccurrence,
  occurrenceAt,
  serializeConfig,
  validateConfig
} from "../src/domain";
import type { ScheduleValue } from "../src/domain/types";

function schedule(overrides: Partial<ScheduleValue> = {}): ScheduleValue {
  return {
    id: "weekend-pvp",
    name: "Weekend PvP",
    enabled: true,
    days: ["fri", "sat"],
    startTime: "20:00",
    endTime: "23:00",
    mode: "pvp",
    announcements: [{
      enabled: true,
      relativeTo: "start",
      minutesBefore: 15,
      globalChat: { enabled: true, text: "{schedule} starts in {minutes} minutes." },
      serverNotice: { enabled: false, text: "" }
    }],
    ...overrides
  };
}

describe("PalLaw schedules", () => {
  test("hydrates and serializes the optional Version 4 contract", () => {
    const config = createDefaultConfig();
    config.schedules.push(schedule());
    config.wilderness.schedules.push("weekend-pvp");
    const validation = validateConfig(config);
    expect(validation.errors).toEqual([]);
    const serialized = serializeConfig(config);
    expect(serialized.schedules).toHaveLength(1);
    expect((serialized.wilderness as { schedules: string[] }).schedules).toEqual(["weekend-pvp"]);
    expect(hydrateConfig({ ...serialized, schedules: undefined }).schedules).toEqual([]);
    const withObsoletePriority = structuredClone(serialized) as Record<string, unknown>;
    (withObsoletePriority.schedules as Array<Record<string, unknown>>)[0]!.priority = 999;
    expect(validateConfig(withObsoletePriority).errors).toContain("schedules[0].priority is not supported.");
  });

  test("allows duplicate announcements and returns each due row in order", () => {
    const repeated = schedule({
      days: ["mon"],
      startTime: "12:00",
      endTime: null,
      mode: null
    });
    repeated.announcements.push(structuredClone(repeated.announcements[0]!));
    const due = dueAnnouncements(
      repeated,
      new Date("2026-07-27T11:44:30Z"),
      new Date("2026-07-27T11:45:10Z")
    );
    expect(due).toHaveLength(2);
    expect(due[0]?.globalChat.text).toBe(due[1]?.globalChat.text);
  });

  test("accepts and preserves enabled silent Message Outputs", () => {
    const config = createDefaultConfig();
    const dormant = schedule({
      announcements: [{
        enabled: true,
        relativeTo: "start",
        minutesBefore: 15,
        globalChat: { enabled: true, text: "" },
        serverNotice: { enabled: true, text: " \t\r\n" }
      }]
    });
    config.schedules.push(dormant);
    config.wilderness.schedules.push(dormant.id);
    const validation = validateConfig(config);
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual([]);
    const serialized = serializeConfig(config);
    const serializedSchedules = serialized.schedules as ScheduleValue[];
    expect(serializedSchedules[0]?.announcements[0]?.globalChat).toEqual({ enabled: true, text: "" });
    expect(serializedSchedules[0]?.announcements[0]?.serverNotice).toEqual({ enabled: true, text: " \t\r\n" });
  });

  test("finds overnight occurrences", () => {
    const overnight = schedule({ days: ["fri"], startTime: "23:00", endTime: "02:00" });
    expect(nextOccurrence(overnight, new Date("2026-07-31T22:00:00Z"))?.endsAt?.toISOString()).toBe("2026-08-01T02:00:00.000Z");
  });

  test("treats equal start and end as 24 hours and sends both boundary rows", () => {
    const continuous = schedule({
      days: ["mon", "tue"],
      startTime: "20:00",
      endTime: "20:00",
      announcements: [
        { enabled: true, relativeTo: "start", minutesBefore: 0, globalChat: { enabled: true, text: "Start" }, serverNotice: { enabled: false, text: "" } },
        { enabled: true, relativeTo: "end", minutesBefore: 0, globalChat: { enabled: true, text: "End" }, serverNotice: { enabled: false, text: "" } }
      ]
    });
    expect(nextOccurrence(continuous, new Date("2026-07-27T19:00:00Z"))?.endsAt?.toISOString()).toBe("2026-07-28T20:00:00.000Z");
    expect(dueAnnouncements(continuous, new Date("2026-07-28T19:59:30Z"), new Date("2026-07-28T20:00:10Z")).map((row) => row.globalChat.text)).toEqual(["End", "Start"]);
    expect(occurrenceAt(schedule({ days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], startTime: "20:00", endTime: "20:00" }), new Date("2026-08-02T10:00:00Z"))).toBeTruthy();
  });

  test("accepts overlapping mode windows because later schedule order decides precedence", () => {
    const config = createDefaultConfig();
    const earlier = schedule({ id: "earlier", name: "Earlier", days: ["mon"] });
    const later = schedule({ id: "later", name: "Later", days: ["mon"] });
    config.schedules.push(earlier, later);
    config.wilderness.schedules.push(later.id, earlier.id);
    expect(validateConfig(config).errors).toEqual([]);
  });

  test("rejects missing targets, bad end anchors, and unknown placeholders", () => {
    const config = createDefaultConfig();
    config.schedules.push(schedule({
      endTime: null,
      announcements: [{
        enabled: true,
        relativeTo: "end",
        minutesBefore: 10,
        globalChat: { enabled: true, text: "{player} waits" },
        serverNotice: { enabled: false, text: "" }
      }]
    }));
    const errors = validateConfig(config).errors.join("\n");
    expect(errors).toContain("endTime is required for a mode takeover");
    expect(errors).toContain("no Area references it");
    expect(errors).toContain("cannot use end without endTime");
    expect(errors).toContain("unsupported placeholder {player}");
  });
});
