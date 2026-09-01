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
export type SourceActor = "player" | "partnerPal" | "basePal" | "baseStructure" | "wildPal" | "npc";
export type Actor =
  "player" | "partnerPal" | "basePal" | "baseStructure" | "wildPal" | "npc" | "structure" | "environment";
export type Point = [number, number];

export interface PalLawConfigurationVersion8 {
  $schema?: string;
  version: 8;
  regionalCombat?: RegionalCombat;
  settings: Settings;
  messages?: GlobalMessages;
  /**
   * Ordered recurring schedules. When active mode windows overlap in one Area, the later schedule wins.
   */
  schedules?: Schedule[];
  /**
   * Ordered configuration-owned area modes. Array position is display order.
   *
   * @minItems 1
   * @maxItems 128
   */
  modes: [ModeDefinition, ...ModeDefinition[]];
  wilderness: Wilderness;
  stageAreas: Wilderness;
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
  playerSweepSeconds: number;
  mountGraceSeconds?: number;
  refundDeniedSpheres?: boolean;
  debugLogging?: boolean;
}
export interface GlobalMessages {
  enabled?: boolean;
  actionNames?: ActionNames;
  regionChanged?: MessageEvent;
  actionDenied?: MessageEvent;
  levelDenied?: MessageEvent;
}
export interface Schedule {
  id: string;
  name: DisplayName;
  enabled?: boolean;
  days: ("mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun")[];
  startTime: string;
  /**
   * Same as startTime means a 24-hour window; an earlier time means the following UTC day.
   */
  endTime?: string;
  mode?: ModeId;
  announcements?: ScheduleAnnouncement[];
}
export interface ScheduleAnnouncement {
  enabled?: boolean;
  relativeTo: "start" | "end";
  minutesBefore: number;
  globalChat?: ScheduleOutput;
  serverNotice?: ScheduleOutput;
}
export interface ScheduleOutput {
  enabled?: boolean;
  text?: string;
}
export interface ActionNames {
  build?: DisplayName;
  dismantle?: DisplayName;
  capture?: DisplayName;
  groundMount?: DisplayName;
  flyingMount?: DisplayName;
  swimmingMount?: DisplayName;
  editSign?: DisplayName;
  editLock?: DisplayName;
  decay?: DisplayName;
  fastTravelDeparture?: DisplayName;
  fastTravelArrival?: DisplayName;
  fastTravelCrossRegionsDeparture?: DisplayName;
  fastTravelCrossRegionsArrival?: DisplayName;
}
export interface AlertChannels {
  brief?: BriefAlertChannel;
  activity?: ActivityAlertChannel;
}
export interface ModeDefinition {
  id: ModeId;
  name: DisplayName;
  color: Color;
  minimumLevel?: number | null;
  actions: ModeActions;
  combat: ModeCombat;
  messages?: MessageOverrides;
}
export interface Actions {
  build?: boolean;
  dismantle?: boolean;
  capture?: boolean;
  groundMount?: boolean;
  flyingMount?: boolean;
  swimmingMount?: boolean;
  editSign?: boolean;
  editLock?: boolean;
  decay?: boolean;
  fastTravelDeparture?: "all" | "baseToAll" | "baseToBase" | "allToBase" | "none";
  fastTravelArrival?: "all" | "baseOnly" | "none";
  fastTravelCrossRegionsDeparture?: boolean;
  fastTravelCrossRegionsArrival?: boolean;
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
  schedules?: string[];
  actions?: Actions;
  combat?: CombatOverrides;
  messages?: MessageOverrides;
}
export interface CombatOverrides {
  player?: SparseTargetRow;
  partnerPal?: SparseTargetRow;
  basePal?: SparseTargetRow;
  baseStructure?: SparseTargetRow;
  wildPal?: SparseTargetRow;
  npc?: SparseTargetRow;
}
export interface SparseTargetRow {
  player?: boolean;
  partnerPal?: boolean;
  basePal?: boolean;
  baseStructure?: boolean;
  wildPal?: boolean;
  npc?: boolean;
  structure?: boolean;
  environment?: boolean;
}
export interface Region {
  name: DisplayName;
  enabled?: boolean;
  mode: ModeId;
  schedules?: string[];
  minimumLevel?: number | null;
  map: string;
  /**
   * @minItems 3
   * @maxItems 1024
   */
  polygon: [Point, Point, Point, ...Point[]];
  actions?: Actions;
  combat?: CombatOverrides;
  messages?: MessageOverrides;
}
