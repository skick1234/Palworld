import type { ScheduleAnnouncementValue, ScheduleValue } from "./types";

export const WEEKDAYS = Object.freeze([
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" }
]);

const UTC_DAY_BY_ID = new Map(WEEKDAYS.map((day, index) => [day.id, (index + 1) % 7]));
const ID_BY_UTC_DAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export const ISO_MINUTE_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export function parseMinuteOfDay(value: string): number | null {
  if (!ISO_MINUTE_TIME.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours! * 60 + minutes!;
}

export function formatMinuteOfDay(value: number): string {
  const normalized = ((Math.trunc(value) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function scheduleDurationMinutes(schedule: Pick<ScheduleValue, "startTime" | "endTime">): number | null {
  const start = parseMinuteOfDay(schedule.startTime);
  const end = schedule.endTime ? parseMinuteOfDay(schedule.endTime) : null;
  if (start === null || end === null) return null;
  if (start === end) return 1440;
  return end > start ? end - start : 1440 - start + end;
}

function utcDayStart(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export interface ScheduleOccurrence {
  readonly startsAt: Date;
  readonly endsAt: Date | null;
}

export function occurrenceStartingOn(schedule: ScheduleValue, utcDay: Date): ScheduleOccurrence | null {
  if (!schedule.enabled || !schedule.days.includes(ID_BY_UTC_DAY[utcDay.getUTCDay()]!)) return null;
  const startMinute = parseMinuteOfDay(schedule.startTime);
  if (startMinute === null) return null;
  const startsAt = new Date(utcDayStart(utcDay) + startMinute * 60_000);
  const duration = scheduleDurationMinutes(schedule);
  return { startsAt, endsAt: duration === null ? null : new Date(startsAt.getTime() + duration * 60_000) };
}

export function occurrenceAt(schedule: ScheduleValue, instant: Date): ScheduleOccurrence | null {
  for (const dayOffset of [0, -1]) {
    const day = new Date(utcDayStart(instant) + dayOffset * 86_400_000);
    const occurrence = occurrenceStartingOn(schedule, day);
    if (!occurrence?.endsAt) continue;
    if (instant >= occurrence.startsAt && instant < occurrence.endsAt) return occurrence;
  }
  return null;
}

export function nextOccurrence(schedule: ScheduleValue, after = new Date()): ScheduleOccurrence | null {
  if (!schedule.enabled) return null;
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = new Date(utcDayStart(after) + offset * 86_400_000);
    const occurrence = occurrenceStartingOn(schedule, day);
    if (occurrence && occurrence.startsAt > after) return occurrence;
  }
  return null;
}

export function localWeekdayAndTimeToUtc(dayId: string, time: string, reference = new Date()): { day: string; time: string } | null {
  const dayIndex = WEEKDAYS.findIndex((day) => day.id === dayId);
  const minute = parseMinuteOfDay(time);
  if (dayIndex < 0 || minute === null) return null;
  const mondayOffset = (reference.getDay() + 6) % 7;
  const localMonday = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() - mondayOffset, 0, 0, 0, 0);
  const local = new Date(localMonday.getTime());
  local.setDate(localMonday.getDate() + dayIndex);
  local.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return { day: ID_BY_UTC_DAY[local.getUTCDay()]!, time: formatMinuteOfDay(local.getUTCHours() * 60 + local.getUTCMinutes()) };
}

export function utcWeekdayAndTimeToLocal(dayId: string, time: string, reference = new Date()): { day: string; time: string } | null {
  const utcDay = UTC_DAY_BY_ID.get(dayId);
  const minute = parseMinuteOfDay(time);
  if (utcDay === undefined || minute === null) return null;
  const referenceUtcDay = reference.getUTCDay();
  const delta = (utcDay - referenceUtcDay + 7) % 7;
  const utc = new Date(utcDayStart(reference) + delta * 86_400_000 + minute * 60_000);
  return { day: ID_BY_UTC_DAY[utc.getDay()]!, time: formatMinuteOfDay(utc.getHours() * 60 + utc.getMinutes()) };
}

export function announcementTrigger(occurrence: ScheduleOccurrence, announcement: ScheduleAnnouncementValue): Date | null {
  const anchor = announcement.relativeTo === "end" ? occurrence.endsAt : occurrence.startsAt;
  return anchor ? new Date(anchor.getTime() - announcement.minutesBefore * 60_000) : null;
}

export function dueAnnouncements(schedule: ScheduleValue, previousCheck: Date, now: Date): ScheduleAnnouncementValue[] {
  if (!schedule.enabled || now <= previousCheck) return [];
  const due: ScheduleAnnouncementValue[] = [];
  const firstDay = utcDayStart(previousCheck) - 86_400_000;
  const lastDay = utcDayStart(now) + 86_400_000;
  for (let day = firstDay; day <= lastDay; day += 86_400_000) {
    const occurrence = occurrenceStartingOn(schedule, new Date(day));
    if (!occurrence) continue;
    for (const announcement of schedule.announcements) {
      if (!announcement.enabled) continue;
      const trigger = announcementTrigger(occurrence, announcement);
      if (trigger && trigger > previousCheck && trigger <= now && now.getTime() - trigger.getTime() <= 60_000) due.push(announcement);
    }
  }
  return due;
}

export function formatScheduleTemplate(template: string, values: Readonly<Record<string, unknown>>): string {
  let result = template;
  for (const key of ["schedule", "startTime", "endTime", "minutes", "mode", "areas"]) {
    result = result.replaceAll(`{${key}}`, values[key] == null ? "" : String(values[key]));
  }
  return result;
}
