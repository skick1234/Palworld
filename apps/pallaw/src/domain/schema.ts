/* Generated from site/pallaw/PalLaw.schema.json. Do not edit by hand. */

export type DisplayName = string;
export type MessageEvent =
  | boolean
  | {
      enabled?: boolean;
      cooldownSeconds?: number;
      chat?: ChatChannel;
      alerts?: AlertChannels;
    };
export type ChatChannel =
  | boolean
  | string
  | {
      enabled?: boolean;
      text?: string;
    };
export type BriefAlertChannel =
  | boolean
  | string
  | {
      enabled?: boolean;
      text?: string;
      tone?: "normal" | "negative";
    };
export type ActivityAlertChannel =
  | boolean
  | string
  | {
      enabled?: boolean;
      text?: string;
    };
/**
 * Immutable mode identifier using lowercase slug syntax.
 */
export type ModeId = string;
export type Color = string;
export type ModeActions = Actions;
export type SourceSelection = SourceActor | [SourceActor, ...SourceActor[]];
export type SourceActor = "player" | "partnerPal" | "basePal" | "baseStructure" | "wildPal" | "npc";
export type TargetSelection = Actor | [Actor, ...Actor[]];
export type Actor =
  "player" | "partnerPal" | "basePal" | "baseStructure" | "wildPal" | "npc" | "structure" | "environment";
/**
 * @maxItems 128
 */
export type CombatOverrides = CombatEntry[];
export type Point = [number, number];

export interface PalLawConfigurationVersion3 {
  $schema?: string;
  version: 3;
  regionalCombat?: RegionalCombat;
  settings?: Settings;
  messages?: GlobalMessages;
  /**
   * Ordered configuration-owned area modes. Array position is display order.
   *
   * @minItems 1
   * @maxItems 128
   */
  modes: [ModeDefinition, ...ModeDefinition[]];
  wilderness: Wilderness;
  /**
   * @maxItems 1024
   */
  regions?: Region[];
}
export interface RegionalCombat {
  enabled?: boolean;
}
export interface Settings {
  hotReload?: boolean;
  hotReloadSeconds?: number;
  worldRules?: boolean;
  adminBypass?: boolean;
  playerSweepSeconds?: number;
  mountGraceSeconds?: number;
  debugLogging?: boolean;
}
export interface GlobalMessages {
  enabled?: boolean;
  actionNames?: ActionNames;
  regionChanged?: MessageEvent;
  actionDenied?: MessageEvent;
  levelDenied?: MessageEvent;
}
export interface ActionNames {
  build?: DisplayName;
  dismantle?: DisplayName;
  ride?: DisplayName;
  fly?: DisplayName;
  editSign?: DisplayName;
  editLock?: DisplayName;
  decay?: DisplayName;
  fastTravelDeparture?: DisplayName;
  fastTravelArrival?: DisplayName;
}
export interface AlertChannels {
  brief?: BriefAlertChannel;
  activity?: ActivityAlertChannel;
}
export interface ModeDefinition {
  id: ModeId;
  name: DisplayName;
  color: Color;
  minimumLevel: number | null;
  actions: ModeActions;
  combat: ModeCombat;
  messages?: MessageOverrides;
}
export interface Actions {
  build?: boolean;
  dismantle?: boolean;
  ride?: boolean;
  fly?: boolean;
  editSign?: boolean;
  editLock?: boolean;
  decay?: boolean;
  fastTravelDeparture?: "all" | "baseOnly" | "none";
  fastTravelArrival?: "all" | "baseOnly" | "none";
}
export interface ModeCombat {
  player: TargetRow;
  partnerPal: TargetRow;
  basePal: TargetRow;
  baseStructure: TargetRow;
  wildPal: TargetRow;
  npc: TargetRow;
}
export interface TargetRow {
  player: boolean;
  partnerPal: boolean;
  basePal: boolean;
  baseStructure: boolean;
  wildPal: boolean;
  npc: boolean;
  structure: boolean;
  environment: boolean;
}
export interface MessageOverrides {
  regionChanged?: MessageEvent;
  actionDenied?: MessageEvent;
  levelDenied?: MessageEvent;
}
export interface Wilderness {
  name: DisplayName;
  mode: ModeId;
  actions?: Actions;
  combat?: CombatOverrides;
  messages?: MessageOverrides;
}
export interface CombatEntry {
  source: SourceSelection;
  target: TargetSelection;
  allow: boolean;
  bidirectional?: boolean;
}
export interface Region {
  name: DisplayName;
  enabled?: boolean;
  mode: ModeId;
  minimumLevel?: number;
  map?: string;
  /**
   * @minItems 3
   * @maxItems 1024
   */
  polygon: [Point, Point, Point, ...Point[]];
  actions?: Actions;
  combat?: CombatOverrides;
  messages?: MessageOverrides;
}
