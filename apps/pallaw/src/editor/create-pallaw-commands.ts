import type { EditorDocument } from "../document/create-editor-document";
import type { PalLawConfig } from "../document/create-pallaw-document";
import { clone, resolveAreaMessages, setQuickCombatOverride } from "../domain/rules";
import type { EventMessage, Point } from "../domain/types";
import type { AreaIntent, MessageIntent, ModeIntent } from "./intents";
import type { EditorModel } from "./create-editor-model";

export type MessageSubject =
  | { readonly kind: "global" }
  | { readonly kind: "wilderness" }
  | { readonly kind: "region"; readonly index: number }
  | { readonly kind: "mode"; readonly index: number };

export interface PalLawCommands {
  applyMessage(subject: MessageSubject, intent: MessageIntent): void;
  applyArea(subject: { readonly wilderness: boolean; readonly index: number | null }, intent: Exclude<AreaIntent, { type: "fit-region" }>): void;
  applyMode(index: number, intent: ModeIntent): void;
  changeSetting(scope: "settings" | "regionalCombat", id: string, value: boolean | number): void;
  moveRegion(index: number, direction: number): void;
  duplicateRegion(index: number): void;
  deleteRegion(index: number): void;
  moveMode(index: number, direction: number): void;
  duplicateMode(index: number, name: string, id: string): boolean;
  deleteMode(index: number, replacement: string): void;
  setActionName(id: string, value: string): void;
  setRegionPolygon(index: number, polygon: readonly (readonly [number, number])[]): void;
  addRegion(name: string, mapId: string, polygon: readonly (readonly [number, number])[]): number;
}

function globalMessage(config: PalLawConfig, eventId: string): EventMessage {
  return config.messages[eventId as "regionChanged" | "actionDenied" | "levelDenied"];
}

function subjectFor(config: PalLawConfig, subject: Exclude<MessageSubject, { kind: "global" }>) {
  if (subject.kind === "wilderness") return config.wilderness;
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
        commands.applyMessage(subject.wilderness ? { kind: "wilderness" } : { kind: "region", index: subject.index! }, intent.intent);
        return;
      }
      mutate((draft) => {
        const target = subject.wilderness ? draft.wilderness : draft.regions[subject.index ?? -1];
        if (!target) return;
        if (intent.type === "set-name") target.name = intent.value;
        else if (intent.type === "set-mode") target.mode = intent.value;
        else if (intent.type === "set-enabled" && "enabled" in target) target.enabled = intent.value;
        else if (intent.type === "set-map" && "map" in target) target.map = intent.value;
        else if (intent.type === "set-minimum-level" && "minimumLevel" in target) target.minimumLevel = intent.value;
        else if (intent.type === "set-polygon" && "polygon" in target) target.polygon = intent.value.map(([x, y]) => [Number(x), Number(y)]);
        else if (intent.type === "set-action") {
          if (intent.value === null) delete target.actions[intent.actionId];
          else target.actions[intent.actionId] = intent.value;
        } else if (intent.type === "set-combat") setQuickCombatOverride(target, intent.source, intent.target, intent.value);
        else if (intent.type === "reset-combat") target.combat = [];
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
        } else if (intent.type === "set-combat") mode.combat[intent.source]![intent.target] = intent.value === "allow";
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
      mutate((draft) => { const source = draft.modes[index]; if (!source || !draft.modes.some((mode) => mode.id === replacement && mode.id !== source.id)) return; if (draft.wilderness.mode === source.id) draft.wilderness.mode = replacement; draft.regions.forEach((region) => { if (region.mode === source.id) region.mode = replacement; }); draft.modes.splice(index, 1); });
    },
    setActionName(id, value) { mutate((draft) => { draft.messages.actionNames[id] = value; }); },
    setRegionPolygon(index, polygon) { mutate((draft) => { if (draft.regions[index]) draft.regions[index]!.polygon = polygon.map(([x, y]) => [x, y]); }); },
    addRegion(name, mapId, polygon) {
      const index = document.read().config.regions.length;
      mutate((draft) => { draft.regions.push({ name, enabled: true, mode: draft.modes[0]!.id, minimumLevel: null, map: mapId, polygon: polygon.map(([x, y]) => [x, y]), actions: {}, combat: [], messages: {} }); });
      model.selectRegion(index);
      return index;
    }
  };
  return Object.freeze(commands);
}
