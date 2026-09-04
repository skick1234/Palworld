import type { EditorDocument } from "../document/create-editor-document";
import type { PalLawConfig } from "../document/create-pallaw-document";
import { clone, isDamageMultiplier, resolveAreaMessages, setCombatOverride } from "../domain/rules";
import type { EventMessage, Point, RegionValue, ScheduleValue } from "../domain/types";
import type { AreaIntent, MessageIntent, ModeIntent } from "./intents";
import type { EditorModel } from "./create-editor-model";

export type MessageSubject =
  | { readonly kind: "global" }
  | { readonly kind: "wilderness" }
  | { readonly kind: "stageAreas" }
  | { readonly kind: "region"; readonly index: number }
  | { readonly kind: "mode"; readonly index: number };

export interface PalLawCommands {
  applyMessage(subject: MessageSubject, intent: MessageIntent): void;
  applyArea(subject: { readonly kind: "wilderness" } | { readonly kind: "stageAreas" } | { readonly kind: "region"; readonly index: number }, intent: Exclude<AreaIntent, { type: "fit-region" }>): void;
  applyMode(index: number, intent: ModeIntent): void;
  changeSetting(scope: "settings" | "regionalCombat", id: string, value: boolean | number): void;
  moveRegion(index: number, direction: number): void;
  duplicateRegion(index: number): void;
  deleteRegion(index: number): void;
  moveMode(index: number, direction: number): void;
  duplicateMode(index: number, name: string, id: string): boolean;
  deleteMode(index: number, replacement: string): void;
  addSchedule(): void;
  updateSchedule(index: number, apply: (schedule: ScheduleValue) => void): void;
  moveSchedule(index: number, direction: number): void;
  duplicateSchedule(index: number): void;
  deleteSchedule(index: number): void;
  setScheduleArea(scheduleId: string, kind: "wilderness" | "stageAreas" | "region", index: number, assigned: boolean): void;
  setActionName(id: string, value: string): void;
  setRegionPolygon(index: number, polygon: readonly (readonly [number, number])[]): void;
  addRegion(name: string, mapId: string, polygon: readonly (readonly [number, number])[]): number;
}

function globalMessage(config: PalLawConfig, eventId: string): EventMessage {
  return config.messages[eventId as "regionChanged" | "actionDenied" | "levelDenied"];
}

function subjectFor(config: PalLawConfig, subject: Exclude<MessageSubject, { kind: "global" }>) {
  if (subject.kind === "wilderness") return config.wilderness;
  if (subject.kind === "stageAreas") return config.stageAreas;
  if (subject.kind === "region") return config.regions[subject.index] ?? null;
  return config.modes[subject.index] ?? null;
}

function ensureOverride(config: PalLawConfig, subject: NonNullable<ReturnType<typeof subjectFor>>, eventId: string): EventMessage {
  subject.messages ||= {};
  if (!Object.hasOwn(subject.messages, eventId)) {
    const resolutionSubject = "id" in subject ? { mode: subject.id, messages: subject.messages } : subject;
    subject.messages[eventId] = clone((resolveAreaMessages(config, resolutionSubject) as unknown as Record<string, EventMessage>)[eventId]!);
  }
  return subject.messages[eventId]!;
}

export function createPalLawCommands(document: EditorDocument<PalLawConfig>, model: EditorModel<PalLawConfig>): PalLawCommands {
  const mutate = (apply: (draft: PalLawConfig) => void) => { document.dispatch({ type: "mutate", apply }); };
  const commands: PalLawCommands = {
    applyMessage(subject, intent) {
      mutate((draft) => {
        if (intent.type === "set-messages-enabled") { draft.messages.enabled = intent.value; return; }
        const target = subject.kind === "global" ? null : subjectFor(draft, subject);
        if (intent.type === "set-override") {
          if (!target) return;
          if (intent.value) ensureOverride(draft, target, intent.eventId);
          else delete target.messages[intent.eventId];
          return;
        }
        const message = target ? ensureOverride(draft, target, intent.eventId) : globalMessage(draft, intent.eventId);
        if (intent.type === "set-event-enabled") message.enabled = intent.value;
        else if (intent.type === "set-cooldown") message.cooldownSeconds = intent.value;
        else if (intent.type === "set-chat-enabled") message.chat.enabled = intent.value;
        else if (intent.type === "set-chat-text") message.chat.text = intent.value;
        else if (intent.type === "set-alert-enabled") message.alerts[intent.presentation]!.enabled = intent.value;
        else if (intent.type === "set-alert-text") message.alerts[intent.presentation]!.text = intent.value;
        else if (intent.type === "set-alert-tone") message.alerts[intent.presentation]!.tone = intent.value;
      });
    },
    applyArea(subject, intent) {
      if (intent.type === "message") {
        commands.applyMessage(subject, intent.intent);
        return;
      }
      mutate((draft) => {
        const target = subject.kind === "wilderness"
          ? draft.wilderness
          : subject.kind === "stageAreas"
            ? draft.stageAreas
            : draft.regions[subject.index];
        if (!target) return;
        if (intent.type === "set-name") target.name = intent.value;
        else if (intent.type === "set-mode") target.mode = intent.value;
        else if (intent.type === "set-enabled" && "enabled" in target) target.enabled = intent.value;
        else if (intent.type === "set-map" && "map" in target) target.map = intent.value;
        else if (intent.type === "set-minimum-level" && subject.kind === "region" && "polygon" in target) {
          const region = target as RegionValue;
          if (intent.value === undefined) delete region.minimumLevel;
          else region.minimumLevel = intent.value;
        }
        else if (intent.type === "set-polygon" && "polygon" in target) target.polygon = intent.value.map(([x, y]) => [Number(x), Number(y)]);
        else if (intent.type === "set-action") {
          if (intent.value === null) delete target.actions[intent.actionId];
          else target.actions[intent.actionId] = intent.value;
        } else if (intent.type === "set-combat") setCombatOverride(target, intent.source, intent.target, intent.value);
        else if (intent.type === "reset-combat") target.combat = {};
      });
    },
    applyMode(index, intent) {
      if (intent.type === "message") { commands.applyMessage({ kind: "mode", index }, intent.intent); return; }
      mutate((draft) => {
        const mode = draft.modes[index];
        if (!mode) return;
        if (intent.type === "set-name") mode.name = intent.value;
        else if (intent.type === "set-color") mode.color = intent.value;
        else if (intent.type === "set-minimum-level") mode.minimumLevel = intent.value;
        else if (intent.type === "set-action") {
          if (intent.value === null) delete mode.actions[intent.actionId];
          else mode.actions[intent.actionId] = intent.value;
        } else if (intent.type === "set-combat") {
          // Mode cells are dense, so null (inherit) is meaningless here and is ignored.
          if (isDamageMultiplier(intent.value)) mode.combat[intent.source]![intent.target] = intent.value;
        }
      });
    },
    changeSetting(scope, id, value) {
      mutate((draft) => { const target = (scope === "regionalCombat" ? draft.regionalCombat : draft.settings) as unknown as Record<string, boolean | number>; target[id] = value; });
    },
    moveRegion(index, direction) {
      const destination = index + direction;
      if (destination < 0 || destination >= document.read().config.regions.length) return;
      mutate((draft) => { [draft.regions[index], draft.regions[destination]] = [draft.regions[destination]!, draft.regions[index]!]; });
      model.selectRegion(destination);
    },
    duplicateRegion(index) {
      mutate((draft) => { const copy = clone(draft.regions[index]!); copy.name = `${copy.name} Copy`; copy.polygon = copy.polygon.map(([x, y]: Point) => [x + 2500, y + 2500]); draft.regions.splice(index + 1, 0, copy); });
      model.selectRegion(index + 1);
    },
    deleteRegion(index) { mutate((draft) => { draft.regions.splice(index, 1); }); },
    moveMode(index, direction) {
      const destination = index + direction;
      if (destination < 0 || destination >= document.read().config.modes.length) return;
      mutate((draft) => { [draft.modes[index], draft.modes[destination]] = [draft.modes[destination]!, draft.modes[index]!]; });
      model.selectMode(destination);
    },
    duplicateMode(index, name, id) {
      const config = document.read().config;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || config.modes.some((mode) => mode.id === id || mode.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return false;
      mutate((draft) => { draft.modes.splice(index + 1, 0, { ...clone(draft.modes[index]!), id, name }); });
      model.selectMode(index + 1);
      return true;
    },
    deleteMode(index, replacement) {
      mutate((draft) => { const source = draft.modes[index]; if (!source || !draft.modes.some((mode) => mode.id === replacement && mode.id !== source.id)) return; if (draft.wilderness.mode === source.id) draft.wilderness.mode = replacement; if (draft.stageAreas.mode === source.id) draft.stageAreas.mode = replacement; draft.regions.forEach((region) => { if (region.mode === source.id) region.mode = replacement; }); draft.modes.splice(index, 1); });
    },
    addSchedule() {
      const existing = new Set(document.read().config.schedules.map((schedule) => schedule.id));
      let number = document.read().config.schedules.length + 1;
      while (existing.has(`schedule-${number}`)) number += 1;
      const schedule: ScheduleValue = {
        id: `schedule-${number}`,
        name: `Announcement ${number}`,
        enabled: true,
        days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        startTime: "12:00",
        endTime: null,
        mode: null,
        announcements: [{ enabled: true, relativeTo: "start", minutesBefore: 0, globalChat: { enabled: true, text: "{schedule} is starting now." }, serverNotice: { enabled: false, text: "" } }]
      };
      const index = document.read().config.schedules.length;
      mutate((draft) => { draft.schedules.push(schedule); });
      model.selectSchedule(index);
    },
    updateSchedule(index, apply) {
      mutate((draft) => {
        const schedule = draft.schedules[index];
        if (!schedule) return;
        const previousId = schedule.id;
        const previousMode = schedule.mode;
        apply(schedule);
        if (schedule.id !== previousId) {
          for (const area of [draft.wilderness, draft.stageAreas, ...draft.regions]) {
            area.schedules = area.schedules.map((id) => id === previousId ? schedule.id : id);
          }
        }
        const areas = [draft.wilderness, draft.stageAreas, ...draft.regions];
        if (previousMode && !schedule.mode) {
          for (const area of areas) area.schedules = area.schedules.filter((id) => id !== schedule.id);
        } else if (!previousMode && schedule.mode && !areas.some((area) => area.schedules.includes(schedule.id))) {
          draft.wilderness.schedules.push(schedule.id);
        }
      });
    },
    moveSchedule(index, direction) {
      const destination = index + direction;
      if (destination < 0 || destination >= document.read().config.schedules.length) return;
      mutate((draft) => { [draft.schedules[index], draft.schedules[destination]] = [draft.schedules[destination]!, draft.schedules[index]!]; });
      model.selectSchedule(destination);
    },
    duplicateSchedule(index) {
      const source = document.read().config.schedules[index];
      if (!source) return;
      const existing = new Set(document.read().config.schedules.map((schedule) => schedule.id));
      let suffix = 2;
      let id = `${source.id}-copy`;
      while (existing.has(id)) id = `${source.id}-copy-${suffix++}`;
      mutate((draft) => {
        draft.schedules.splice(index + 1, 0, { ...clone(source), id, name: `${source.name} Copy` });
        for (const area of [draft.wilderness, draft.stageAreas, ...draft.regions]) {
          const assignment = area.schedules.indexOf(source.id);
          if (assignment >= 0) area.schedules.splice(assignment + 1, 0, id);
        }
      });
      model.selectSchedule(index + 1);
    },
    deleteSchedule(index) {
      const id = document.read().config.schedules[index]?.id;
      if (!id) return;
      mutate((draft) => {
        draft.schedules.splice(index, 1);
        for (const area of [draft.wilderness, draft.stageAreas, ...draft.regions]) area.schedules = area.schedules.filter((scheduleId) => scheduleId !== id);
      });
    },
    setScheduleArea(scheduleId, kind, index, assigned) {
      mutate((draft) => {
        const area = kind === "wilderness" ? draft.wilderness : kind === "stageAreas" ? draft.stageAreas : draft.regions[index];
        if (!area) return;
        area.schedules = area.schedules.filter((id) => id !== scheduleId);
        if (assigned) area.schedules.push(scheduleId);
      });
    },
    setActionName(id, value) { mutate((draft) => { draft.messages.actionNames[id] = value; }); },
    setRegionPolygon(index, polygon) { mutate((draft) => { if (draft.regions[index]) draft.regions[index]!.polygon = polygon.map(([x, y]) => [x, y]); }); },
    addRegion(name, mapId, polygon) {
      const index = document.read().config.regions.length;
      mutate((draft) => { draft.regions.push({ name, enabled: true, mode: draft.modes[0]!.id, schedules: [], map: mapId, polygon: polygon.map(([x, y]) => [x, y]), actions: {}, combat: {}, messages: {} }); });
      model.selectRegion(index);
      return index;
    }
  };
  return Object.freeze(commands);
}
