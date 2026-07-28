export type ActionValue = boolean | "all" | "baseOnly" | "baseToAll" | "baseToBase" | "allToBase" | "none";
export type CombatOverride = "default" | "allow" | "deny";
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
  actions: Record<string, ActionValue | undefined>;
  combat: Array<{ source: string | string[]; target: string | string[]; allow?: boolean; bidirectional?: boolean }>;
  messages: Record<string, EventMessage>;
  _modeDefinition?: ModeValue;
}

export interface RegionValue extends AreaValue {
  enabled: boolean;
  minimumLevel: number | null;
  map: string;
  polygon: Point[];
}

export interface ModeValue {
  id: string;
  name: string;
  color: string;
  minimumLevel: number | null;
  actions: Record<string, ActionValue | undefined>;
  combat: Record<string, Record<string, boolean | undefined>>;
  messages: Record<string, EventMessage>;
}

export interface RuntimeSettingsValue {
  hotReload: boolean;
  hotReloadSeconds: number;
  worldRules: boolean;
  adminBypass: boolean;
  playerSweepSeconds: number;
  mountGraceSeconds: number;
  debugLogging: boolean;
}

export interface PalLawConfigValue {
  $schema: string;
  version: number;
  regionalCombat: { enabled: boolean };
  settings: RuntimeSettingsValue;
  messages: GlobalMessages;
  modes: ModeValue[];
  wilderness: AreaValue;
  stageAreas: AreaValue;
  regions: RegionValue[];
}
