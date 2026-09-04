export type ActionValue = boolean | "all" | "baseOnly" | "baseToAll" | "baseToBase" | "allToBase" | "none";
export type Point = [number, number];

export interface AlertMessage {
  enabled: boolean;
  text: string;
  tone?: string;
}

export interface EventMessage {
  enabled: boolean;
  cooldownSeconds: number;
  chat: { enabled: boolean; text: string };
  alerts: Record<string, AlertMessage>;
}

export interface GlobalMessages {
  enabled: boolean;
  actionNames: Record<string, string>;
  regionChanged: EventMessage;
  actionDenied: EventMessage;
  levelDenied: EventMessage;
}

export interface AreaValue {
  name: string;
  mode: string;
  schedules: string[];
  actions: Record<string, ActionValue | undefined>;
  /** Sparse damage multipliers (0 cancels, 1 vanilla); omitted cells inherit the mode. */
  combat: Record<string, Record<string, number | undefined>>;
  messages: Record<string, EventMessage>;
  _modeDefinition?: ModeValue;
}

export interface ScheduleOutput {
  enabled: boolean;
  text: string;
}

export interface ScheduleAnnouncementValue {
  enabled: boolean;
  relativeTo: "start" | "end";
  minutesBefore: number;
  globalChat: ScheduleOutput;
  serverNotice: ScheduleOutput;
}

export interface ScheduleValue {
  id: string;
  name: string;
  enabled: boolean;
  days: string[];
  startTime: string;
  endTime: string | null;
  mode: string | null;
  announcements: ScheduleAnnouncementValue[];
}

export interface RegionValue extends AreaValue {
  enabled: boolean;
  minimumLevel?: number | null;
  map: string;
  polygon: Point[];
}

export interface ModeValue {
  id: string;
  name: string;
  color: string;
  minimumLevel: number | null;
  actions: Record<string, ActionValue | undefined>;
  /** Dense damage multipliers (0 cancels, 1 vanilla) for every source and target. */
  combat: Record<string, Record<string, number | undefined>>;
  messages: Record<string, EventMessage>;
}

export interface RuntimeSettingsValue {
  hotReload: boolean;
  hotReloadSeconds: number;
  worldRules: boolean;
  adminBypass: boolean;
  playerSweepSeconds: number;
  mountGraceSeconds: number;
  refundDeniedSpheres: boolean;
  debugLogging: boolean;
}

export interface PalLawConfigValue {
  $schema: string;
  version: number;
  regionalCombat: { enabled: boolean };
  settings: RuntimeSettingsValue;
  messages: GlobalMessages;
  schedules: ScheduleValue[];
  modes: ModeValue[];
  wilderness: AreaValue;
  stageAreas: AreaValue;
  regions: RegionValue[];
}
