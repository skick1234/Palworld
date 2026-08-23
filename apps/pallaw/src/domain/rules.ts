export const CONFIG_VERSION = 7;
export const CONFIG_FILE_NAME = "PalLaw.json";
export const SCHEMA_FILE_NAME = "PalLaw.schema.json";

import {
  CONFIG_LIMITS,
  createBoundedErrorSink,
  parseConfigSource,
  validateRawConfigurationLimits
} from "./config-source";
import type { ConfigSource } from "./config-source";
import {
  addMigrationFallback,
  migrateConfiguration
} from "./configuration-migrations";
import type { JsonObject, MigrationDefinition, MigrationReportEntry } from "./configuration-migrations";
import type {
  ActionValue, AlertMessage, AreaValue, CombatOverride, EventMessage, GlobalMessages,
  ModeValue, PalLawConfigValue, Point, RegionValue, RuntimeSettingsValue,
  ScheduleAnnouncementValue, ScheduleOutput, ScheduleValue
} from "./types";
import { ISO_MINUTE_TIME, WEEKDAYS, parseMinuteOfDay, scheduleDurationMinutes } from "./schedules";

type JsonRecord = Record<string, unknown>;
type CombatMatrix = Record<string, Record<string, boolean | undefined>>;
type ModeDescriptor = Pick<ModeValue, "id" | "name" | "color"> & Partial<ModeValue>;
type ErrorSink = { push(...messages: unknown[]): number };
interface Box { minX: number; maxX: number; minY: number; maxY: number; }

function messageFor(messages: GlobalMessages, eventId: string): EventMessage {
  return messages[eventId as "regionChanged" | "actionDenied" | "levelDenied"];
}

export { CONFIG_LIMITS, ConfigSourceError, parseConfigSource } from "./config-source";

export {
  MAPS,
  inGameMapToWorld,
  mapFractionToWorld,
  worldToInGameMap,
  worldToMapFraction
} from "./map-coordinates";

export const ACTORS = [
  { id: "player", label: "Player", description: "A player character." },
  { id: "partnerPal", label: "Partner Pal", description: "A Pal currently partnered with and controlled by a player." },
  { id: "basePal", label: "Base Pal", description: "A Pal assigned to a base camp." },
  {
    id: "baseStructure",
    label: "Base Structure",
    description: "Damageable map objects with both a valid stored Palworld builder identity and base-camp attribution, including defensive structures when Palworld reports one as the responsible damage source.",
    mapObject: true
  },
  { id: "wildPal", label: "Wild Pal", description: "A wild Pal not owned by a player or base." },
  { id: "npc", label: "NPC", description: "A non-player human character." },
  {
    id: "structure",
    label: "Player-Built Structure",
    matrixLabel: "Structure",
    description: "Damageable map objects with a valid stored Palworld builder identity and no base-camp attribution.",
    mapObject: true,
    targetOnly: true
  },
  {
    id: "environment",
    label: "Environmental Map Object",
    matrixLabel: "Environment",
    description: "Known damageable map objects without a valid stored Palworld builder identity, including natural stone and ore even inside a base. Trees and other foliage are excluded.",
    mapObject: true,
    targetOnly: true
  }
];

export const ACTIONS = [
  { id: "build", label: "Build", description: "Place structures and build objects." },
  { id: "dismantle", label: "Dismantle", description: "Dismantle structures and map objects." },
  { id: "groundMount", label: "Ground mounts", description: "Begin or remain mounted on a ground Pal." },
  { id: "flyingMount", label: "Flying mounts", description: "Begin or remain mounted on a flying Pal." },
  { id: "swimmingMount", label: "Swimming mounts", description: "Begin or remain mounted on a swimming Pal." },
  { id: "editSign", label: "Edit signs", description: "Change sign text." },
  { id: "editLock", label: "Edit locks", description: "Change passwords and private chest locks." },
  { id: "decay", label: "Building decay", description: "Apply normal structure deterioration." },
  {
    id: "fastTravelDeparture",
    label: "Fast travel departure",
    description: "Choose the permitted route shape for trips started inside this area. The destination area's arrival policy is checked separately.",
    fastTravelPolicy: true
  },
  {
    id: "fastTravelArrival",
    label: "Fast travel arrival",
    description: "Choose whether arrivals inside this area may use every destination, base camps only, or no destination.",
    fastTravelPolicy: true
  },
  {
    id: "fastTravelCrossRegionsDeparture",
    label: "Cross-area travel departure",
    description: "Allow Fast Travel Departure when the destination is in a different effective area. The destination area's arrival gate is checked separately."
  },
  {
    id: "fastTravelCrossRegionsArrival",
    label: "Cross-area travel arrival",
    description: "Allow Fast Travel Arrival from a different effective area. The origin area's departure gate is checked separately."
  }
];

export const FAST_TRAVEL_POLICIES = Object.freeze([
  { id: "all", label: "All" },
  { id: "baseOnly", label: "Bases only" },
  { id: "none", label: "Disabled" }
]);

export const FAST_TRAVEL_DEPARTURE_POLICIES = Object.freeze([
  { id: "all", label: "All to all" },
  { id: "baseToAll", label: "Base to all" },
  { id: "baseToBase", label: "Base to base" },
  { id: "allToBase", label: "All to base" },
  { id: "none", label: "Disabled" }
]);

const FAST_TRAVEL_POLICY_IDS = new Set(
  FAST_TRAVEL_POLICIES.map(({ id }) => id)
);
const FAST_TRAVEL_DEPARTURE_POLICY_IDS = new Set(
  FAST_TRAVEL_DEPARTURE_POLICIES.map(({ id }) => id)
);

export function fastTravelPolicies(actionId: string) {
  return actionId === "fastTravelDeparture"
    ? FAST_TRAVEL_DEPARTURE_POLICIES
    : FAST_TRAVEL_POLICIES;
}

function isFastTravelPolicy(actionId: string, value: unknown): value is ActionValue {
  return typeof value === "string" &&
    (actionId === "fastTravelDeparture"
      ? FAST_TRAVEL_DEPARTURE_POLICY_IDS.has(value)
      : FAST_TRAVEL_POLICY_IDS.has(value));
}

export const DEFAULT_ACTION_NAMES = Object.freeze({
  build: "Building",
  dismantle: "Dismantling",
  groundMount: "Ground mount use",
  flyingMount: "Flying mount use",
  swimmingMount: "Swimming mount use",
  editSign: "Sign editing",
  editLock: "Lock editing",
  decay: "Building decay",
  fastTravelDeparture: "Fast Travel Departure",
  fastTravelArrival: "Fast Travel Arrival",
  fastTravelCrossRegionsDeparture: "Fast Travel Cross Regions Departure",
  fastTravelCrossRegionsArrival: "Fast Travel Cross Regions Arrival"
});

const LEGACY_DEFAULT_ACTION_NAMES = Object.freeze({
  build: "Building",
  dismantle: "Dismantling",
  ride: "Non-flying riding",
  flyingMount: "Flying mount use",
  editSign: "Sign editing",
  editLock: "Lock editing",
  decay: "Building decay",
  fastTravelDeparture: "Fast Travel Departure",
  fastTravelArrival: "Fast Travel Arrival"
});

export const STARTER_MODES = [
  {
    id: "safe",
    name: "Safe",
    color: "#22C55E",
    description: "Players and player-owned Pals are protected in both directions. Map-object damage keeps vanilla behavior unless overridden."
  },
  {
    id: "pve",
    name: "PvE",
    color: "#38BDF8",
    description: "Environmental combat remains active, while combat between player groups is denied."
  },
  {
    id: "pvp",
    name: "PvP",
    color: "#F43F5E",
    description: "Open player combat. With regional combat authority enabled, PalLaw enables the required player-damage setting and limits combat to the configured areas."
  }
];

export const MODES = STARTER_MODES;

export const MESSAGE_EVENTS = [
  {
    id: "regionChanged",
    label: "Region changed",
    description: "Sent when a player enters a different named region or returns to wilderness.",
    placeholders: ["{region}", "{previousRegion}", "{mode}"]
  },
  {
    id: "actionDenied",
    label: "Action denied",
    description: "Sent when a configured player action is blocked.",
    placeholders: ["{region}", "{mode}", "{action}"]
  },
  {
    id: "levelDenied",
    label: "Level requirement",
    description: "Sent when a player is moved back from a region with a higher minimum level.",
    placeholders: ["{region}", "{previousRegion}", "{mode}", "{minimumLevel}", "{playerLevel}"]
  }
];

export const ALERT_PRESENTATIONS = [
  {
    id: "brief",
    label: "Brief tip",
    description: "A short queued Palworld tip shown only to the affected player."
  },
  {
    id: "activity",
    label: "Activity tip",
    description: "An immediate stacking Palworld activity tip shown only to the affected player."
  }
];

export const ALERT_TONES = [
  { id: "normal", label: "Normal" },
  { id: "negative", label: "Negative" }
];

export const DEFAULT_SETTINGS = Object.freeze({
  hotReload: true,
  hotReloadSeconds: 1,
  worldRules: true,
  adminBypass: true,
  playerSweepSeconds: 0.25,
  mountGraceSeconds: 15,
  debugLogging: false
});

export const DEFAULT_REGIONAL_COMBAT = Object.freeze({
  enabled: true
});

export const NEUTRAL_SETTINGS = Object.freeze({
  hotReload: false,
  hotReloadSeconds: 0,
  worldRules: false,
  adminBypass: false,
  playerSweepSeconds: 0,
  mountGraceSeconds: 0,
  debugLogging: false
});

export const NEUTRAL_REGIONAL_COMBAT = Object.freeze({ enabled: false });

function defaultAlerts(text: string, enabledPresentation: string, briefTone = "normal") {
  return Object.fromEntries(ALERT_PRESENTATIONS.map(({ id }) => [
    id,
    {
      enabled: id === enabledPresentation,
      text,
      ...(id === "brief" ? { tone: briefTone } : {})
    }
  ]));
}

export const DEFAULT_MESSAGES: Readonly<GlobalMessages> = Object.freeze({
  enabled: true,
  actionNames: { ...DEFAULT_ACTION_NAMES },
  regionChanged: {
    enabled: true,
    cooldownSeconds: 0,
    chat: { enabled: false, text: "Entered {region}." },
    alerts: defaultAlerts("{region}", "activity")
  },
  actionDenied: {
    enabled: true,
    cooldownSeconds: 2,
    chat: { enabled: false, text: "{action} is not allowed in {region}." },
    alerts: defaultAlerts("{action} is not allowed here.", "brief", "negative")
  },
  levelDenied: {
    enabled: true,
    cooldownSeconds: 3,
    chat: { enabled: false, text: "Level {minimumLevel} is required to enter {region}." },
    alerts: defaultAlerts("Level {minimumLevel} required - {region}", "brief", "negative")
  }
});

const LEGACY_DEFAULT_MESSAGES: Readonly<GlobalMessages> = Object.freeze({
  ...DEFAULT_MESSAGES,
  actionNames: { ...LEGACY_DEFAULT_ACTION_NAMES }
});

function neutralMessage(): EventMessage {
  return {
    enabled: false,
    cooldownSeconds: 0,
    chat: { enabled: false, text: "" },
    alerts: {
      brief: { enabled: false, text: "" },
      activity: { enabled: false, text: "" }
    }
  };
}

export const NEUTRAL_MESSAGES: Readonly<GlobalMessages> = Object.freeze({
  enabled: false,
  actionNames: Object.fromEntries(Object.keys(DEFAULT_ACTION_NAMES).map((key) => [key, ""])),
  regionChanged: neutralMessage(),
  actionDenied: neutralMessage(),
  levelDenied: neutralMessage()
});

const ACTOR_IDS = new Set(ACTORS.map((entry) => entry.id));
const SOURCE_ACTOR_IDS = new Set(ACTORS.filter((entry) => !entry.targetOnly).map((entry) => entry.id));
const ACTION_IDS = new Set(ACTIONS.map((entry) => entry.id));
const MESSAGE_IDS = new Set(MESSAGE_EVENTS.map((entry) => entry.id));
const ALERT_PRESENTATION_IDS = new Set(ALERT_PRESENTATIONS.map((entry) => entry.id));
const ALERT_TONE_IDS = new Set(ALERT_TONES.map((entry) => entry.id));
const WEEKDAY_IDS = new Set(WEEKDAYS.map((entry) => entry.id));
const SCHEDULE_PLACEHOLDERS = new Set(["schedule", "startTime", "endTime", "minutes", "mode", "areas"]);
const EPSILON = 1e-6;

export function clone<T>(value: T): T {
  const result = typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
  return isHydratedConfig(value) && isPlainObject(result)
    ? markHydrated(result as unknown as PalLawConfigValue) as unknown as T
    : result;
}

function markHydrated<T extends PalLawConfigValue>(config: T): T {
  Object.defineProperty(config, "__pallawHydrated", { value: true, enumerable: false });
  return config;
}

function isHydratedConfig(value: unknown): value is PalLawConfigValue {
  return isPlainObject(value) && value.__pallawHydrated === true;
}

export function modeDefinition(mode: string | undefined, configOrModes?: PalLawConfigValue | readonly ModeDescriptor[]): ModeDescriptor {
  const modes: readonly ModeDescriptor[] = configOrModes && "modes" in configOrModes
    ? configOrModes.modes
    : configOrModes ?? STARTER_MODES;
  return modes.find((entry) => entry.id === mode) || modes[0];
}

function createStarterMode({ id, name, color }: ModeDescriptor): ModeValue {
  return {
    id,
    name,
    color,
    minimumLevel: null,
    actions: modeActions(),
    combat: modeCombat(id),
    messages: {}
  };
}

export function createDefaultConfig(): PalLawConfigValue {
  return markHydrated({
    $schema: `./${SCHEMA_FILE_NAME}`,
    version: CONFIG_VERSION,
    regionalCombat: clone(DEFAULT_REGIONAL_COMBAT),
    settings: clone(DEFAULT_SETTINGS),
    messages: clone(DEFAULT_MESSAGES),
    schedules: [],
    modes: STARTER_MODES.map(createStarterMode),
    wilderness: {
      name: "Wilderness",
      mode: "pve",
      schedules: [],
      actions: {},
      combat: {},
      messages: {}
    },
    stageAreas: {
      name: "Stage Areas",
      mode: "pve",
      schedules: [],
      actions: {},
      combat: {},
      messages: {}
    },
    regions: []
  });
}

function finite(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeChat(value: unknown, base: EventMessage["chat"]): EventMessage["chat"] {
  const result = clone(base);
  if (typeof value === "boolean") {
    result.enabled = value;
  } else if (typeof value === "string") {
    result.enabled = true;
    result.text = value;
  } else if (isPlainObject(value)) {
    result.enabled = boolean(value.enabled, result.enabled);
    result.text = text(value.text, result.text);
  }
  return result;
}

function normalizeAlert(value: unknown, base: EventMessage["alerts"][string], presentation: string): EventMessage["alerts"][string] {
  const result = clone(base);
  if (typeof value === "boolean") {
    result.enabled = value;
  } else if (typeof value === "string") {
    result.enabled = true;
    result.text = value;
  } else if (isPlainObject(value)) {
    result.enabled = boolean(value.enabled, result.enabled);
    result.text = text(value.text, result.text);
    if (presentation === "brief") {
      result.tone = typeof value.tone === "string" && ALERT_TONE_IDS.has(value.tone) ? value.tone : result.tone;
    }
  }
  return result;
}

function normalizeAlerts(value: unknown, base: EventMessage["alerts"]): EventMessage["alerts"] {
  const result = clone(base);
  if (!isPlainObject(value)) return result;
  for (const { id } of ALERT_PRESENTATIONS) {
    if (Object.hasOwn(value, id)) result[id] = normalizeAlert(value[id], result[id], id);
  }
  return result;
}

export function normalizeMessage(value: unknown, base: EventMessage): EventMessage {
  const result = clone(base);
  if (typeof value === "boolean") {
    result.enabled = value;
    return result;
  }
  if (!isPlainObject(value)) {
    return result;
  }
  result.enabled = boolean(value.enabled, result.enabled);
  result.cooldownSeconds = finite(value.cooldownSeconds, result.cooldownSeconds);
  result.chat = normalizeChat(value.chat, result.chat);
  result.alerts = normalizeAlerts(value.alerts, result.alerts);
  return result;
}

export function enabledMessageOutputCount(message: EventMessage | null | undefined): number {
  return Number(Boolean(message?.chat?.enabled && hasVisibleMessageText(message.chat.text))) + ALERT_PRESENTATIONS.reduce(
    (count, { id }) => count + Number(Boolean(message?.alerts?.[id]?.enabled && hasVisibleMessageText(message.alerts[id]?.text))),
    0
  );
}

export function normalizeMessages(value: unknown, base: Readonly<GlobalMessages> = NEUTRAL_MESSAGES, includeGlobalControls = true): GlobalMessages {
  const result = clone(base) as GlobalMessages;
  if (!isPlainObject(value)) {
    return result;
  }
  if (includeGlobalControls) {
    result.enabled = boolean(value.enabled, result.enabled);
    result.actionNames = normalizeDisplayNames(value.actionNames, result.actionNames);
  }
  for (const event of MESSAGE_EVENTS) {
    if (Object.hasOwn(value, event.id)) {
      const id = event.id as keyof Pick<GlobalMessages, "regionChanged" | "actionDenied" | "levelDenied">;
      result[id] = normalizeMessage(value[event.id], result[id]);
    }
  }
  return result;
}

function normalizeDisplayNames(value: unknown, defaults: Readonly<Record<string, string>>): Record<string, string> {
  const result = { ...defaults };
  if (!isPlainObject(value)) return result;
  for (const key of Object.keys(defaults)) {
    if (typeof value[key] === "string") result[key] = value[key];
  }
  return result;
}

function normalizeActions(value: unknown): Record<string, ActionValue | undefined> {
  const result: Record<string, ActionValue | undefined> = {};
  if (!isPlainObject(value)) return result;
  for (const action of ACTIONS) {
    if (action.fastTravelPolicy) {
      const candidate = value[action.id];
      if (isFastTravelPolicy(action.id, candidate)) {
        result[action.id] = candidate;
      }
    } else if (typeof value[action.id] === "boolean") {
      result[action.id] = value[action.id] as boolean;
    }
  }
  return result;
}

function normalizeCombat(value: unknown): AreaValue["combat"] {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([source, row]) => {
    if (!SOURCE_ACTOR_IDS.has(source) || !isPlainObject(row)) return [];
    const targets = Object.fromEntries(Object.entries(row)
      .filter(([target, allowed]) => ACTOR_IDS.has(target) && typeof allowed === "boolean")) as Record<string, boolean | undefined>;
    return Object.keys(targets).length ? [[source, targets]] : [];
  })) as AreaValue["combat"];
}

function normalizeArea(value: unknown, fallbackName = "Region"): AreaValue {
  const source = isPlainObject(value) ? value : {};
  const mode = text(source.mode, "pve");
  return {
    name: text(source.name, fallbackName),
    mode,
    schedules: Array.isArray(source.schedules) ? source.schedules.filter((entry): entry is string => typeof entry === "string") : [],
    actions: normalizeActions(source.actions),
    combat: normalizeCombat(source.combat),
    messages: source.messages && typeof source.messages === "object" && !Array.isArray(source.messages)
      ? clone(source.messages) as Record<string, EventMessage>
      : {}
  };
}

function normalizeScheduleOutput(value: unknown): ScheduleOutput {
  const source = isPlainObject(value) ? value : {};
  return { enabled: boolean(source.enabled, false), text: text(source.text) };
}

function normalizeScheduleAnnouncement(value: unknown): ScheduleAnnouncementValue {
  const source = isPlainObject(value) ? value : {};
  return {
    enabled: boolean(source.enabled, false),
    relativeTo: source.relativeTo === "end" ? "end" : "start",
    minutesBefore: Number.isInteger(Number(source.minutesBefore)) ? Number(source.minutesBefore) : 0,
    globalChat: normalizeScheduleOutput(source.globalChat),
    serverNotice: normalizeScheduleOutput(source.serverNotice)
  };
}

function normalizeSchedule(value: unknown, index: number): ScheduleValue {
  const source = isPlainObject(value) ? value : {};
  return {
    id: text(source.id),
    name: text(source.name, `Schedule ${index + 1}`),
    enabled: boolean(source.enabled, false),
    days: Array.isArray(source.days) ? source.days.filter((entry): entry is string => typeof entry === "string") : [],
    startTime: text(source.startTime, "00:00"),
    endTime: typeof source.endTime === "string" ? source.endTime : null,
    mode: typeof source.mode === "string" ? source.mode : null,
    announcements: Array.isArray(source.announcements) ? source.announcements.map(normalizeScheduleAnnouncement) : []
  };
}

function normalizePoint(point: unknown): Point {
  return Array.isArray(point) && point.length >= 2
    ? [finite(point[0], 0), finite(point[1], 0)]
    : [0, 0];
}

function normalizeRegion(value: unknown, index: number): RegionValue {
  const source = isPlainObject(value) ? value : {};
  const area = normalizeArea(source, `Region ${index + 1}`);
  return {
    ...area,
    enabled: boolean(source.enabled, false),
    ...(Object.hasOwn(source, "minimumLevel") ? {
      minimumLevel: source.minimumLevel === null
        ? null
        : Number.isInteger(Number(source.minimumLevel)) ? Number(source.minimumLevel) : undefined
    } : {}),
    map: text(source.map),
    polygon: normalizePolygon(source.polygon)
  };
}

function normalizeDenseActions(value: unknown): Record<string, ActionValue | undefined> {
  const source = isPlainObject(value) ? value : {};
  return Object.fromEntries(ACTIONS.map((action) => [
    action.id,
    action.fastTravelPolicy
      ? (() => { const candidate = source[action.id]; return isFastTravelPolicy(action.id, candidate) ? candidate : "none"; })()
      : boolean(source[action.id], false)
  ])) as Record<string, ActionValue | undefined>;
}

function normalizeDenseCombat(value: unknown): CombatMatrix {
  const sourceValue = isPlainObject(value) ? value : {};
  return Object.fromEntries(ACTORS.filter((actor) => !actor.targetOnly).map((source) => [
    source.id,
    Object.fromEntries(ACTORS.map((target) => [
      target.id, boolean((() => { const row = sourceValue[source.id]; return isPlainObject(row) ? row[target.id] : undefined; })(), false)
    ]))
  ])) as CombatMatrix;
}

function normalizeMode(value: unknown, index: number): ModeValue {
  const source = isPlainObject(value) ? value : {};
  return {
    id: text(source.id),
    name: text(source.name, `Mode ${index + 1}`),
    color: text(source.color),
    minimumLevel: source.minimumLevel !== null && source.minimumLevel !== undefined && source.minimumLevel !== "" && Number.isInteger(Number(source.minimumLevel))
      ? Number(source.minimumLevel)
      : null,
    actions: normalizeDenseActions(source.actions),
    combat: normalizeDenseCombat(source.combat),
    messages: isPlainObject(source.messages) ? clone(source.messages) as Record<string, EventMessage> : {}
  };
}

function normalizePolygon(value: unknown): Point[] {
  if (!Array.isArray(value)) return [];
  const points = value.map(normalizePoint);
  if (points.length > 1 && samePoint(points[0], points.at(-1))) points.pop();
  return points;
}

export function hydrateConfig(value: unknown): PalLawConfigValue {
  const source = isPlainObject(value) ? value : {};
  const config = {
    $schema: text(source.$schema, `./${SCHEMA_FILE_NAME}`),
    version: Number(source.version ?? CONFIG_VERSION),
    regionalCombat: clone(NEUTRAL_REGIONAL_COMBAT),
    settings: clone(NEUTRAL_SETTINGS),
    messages: clone(NEUTRAL_MESSAGES),
    schedules: [] as ScheduleValue[],
    modes: [] as ModeValue[],
    wilderness: normalizeArea(source.wilderness, "Wilderness"),
    stageAreas: normalizeArea(source.stageAreas, "Stage Areas"),
    regions: [] as RegionValue[]
  } as PalLawConfigValue;
  const regionalCombat = isPlainObject(source.regionalCombat) ? source.regionalCombat : {};
  config.regionalCombat = {
    enabled: boolean(regionalCombat.enabled, false)
  };
  config.settings = { ...config.settings, ...(isPlainObject(source.settings) ? source.settings : {}) } as RuntimeSettingsValue;
  for (const key of Object.keys(NEUTRAL_SETTINGS) as Array<keyof RuntimeSettingsValue>) {
    const fallback = NEUTRAL_SETTINGS[key];
    (config.settings as unknown as Record<string, boolean | number>)[key] = typeof fallback === "boolean"
      ? boolean(config.settings[key], fallback)
      : finite(config.settings[key], fallback);
  }
  config.messages = normalizeMessages(source.messages, NEUTRAL_MESSAGES, true);
  config.schedules = Array.isArray(source.schedules) ? source.schedules.map(normalizeSchedule) : [];
  config.modes = Array.isArray(source.modes) ? source.modes.map(normalizeMode) : [];
  config.regions = Array.isArray(source.regions)
    ? source.regions.map(normalizeRegion)
    : [];
  const attachMode = (area: AreaValue) => Object.defineProperty(area, "_modeDefinition", {
    value: modeDefinition(area.mode, config),
    configurable: true,
    writable: true
  });
  attachMode(config.wilderness);
  attachMode(config.stageAreas);
  config.regions.forEach(attachMode);
  return markHydrated(config);
}

export function modeActions(): Record<string, ActionValue | undefined> {
  return Object.fromEntries(
    ACTIONS.map((action) => [action.id, action.fastTravelPolicy ? "all" : true])
  ) as Record<string, ActionValue | undefined>;
}

export function effectiveActions(area: AreaValue): Record<string, ActionValue | undefined> {
  return { ...(area?._modeDefinition?.actions || modeActions()), ...(area?.actions || {}) };
}

export function effectiveMinimumLevel(area: Pick<AreaValue, "mode"> & Partial<Pick<RegionValue, "minimumLevel">> & Partial<Pick<AreaValue, "_modeDefinition">>, config: PalLawConfigValue): number | null {
  return Object.hasOwn(area, "minimumLevel")
    ? area.minimumLevel ?? null
    : area?._modeDefinition?.minimumLevel ?? modeDefinition(area?.mode, config)?.minimumLevel ?? null;
}

export function modeCombat(mode: string): CombatMatrix {
  const matrix = Object.fromEntries(
    ACTORS.filter((actor) => !actor.targetOnly).map((source) => [
      source.id,
      Object.fromEntries(ACTORS.map((target) => [target.id, true]))
    ])
  ) as CombatMatrix;
  const ownedSources = ["player", "partnerPal", "basePal", "baseStructure"];
  const ownedTargets = ["player", "partnerPal", "basePal", "baseStructure"];
  if (mode === "pve" || mode === "safe") {
    for (const source of ownedSources) {
      for (const target of ownedTargets) matrix[source][target] = false;
    }
  }
  if (mode === "safe") {
    for (const source of Object.keys(matrix)) {
      for (const target of ACTORS.map((actor) => actor.id)) {
        if (target === "structure" || target === "baseStructure" || target === "environment") continue;
        if (ownedSources.includes(source) || ownedTargets.includes(target)) matrix[source][target] = false;
      }
    }
  }
  return matrix;
}

function resolveCombat(area: AreaValue): { preset: CombatMatrix; matrix: CombatMatrix; overridden: CombatMatrix } {
  const preset = area?._modeDefinition?.combat || modeCombat(area?.mode || "pve");
  const matrix = Object.fromEntries(
    Object.entries(preset).map(([source, targets]) => [source, { ...targets }])
  ) as CombatMatrix;
  const overridden = Object.fromEntries(
    Object.entries(preset).map(([source, targets]) => [
      source,
      Object.fromEntries(Object.keys(targets).map((target) => [target, false]))
    ])
  ) as CombatMatrix;
  for (const [source, row] of Object.entries(area?.combat || {})) {
    if (!matrix[source]) continue;
    for (const [target, allowed] of Object.entries(row || {})) {
      if (!Object.hasOwn(matrix[source], target) || typeof allowed !== "boolean") continue;
      matrix[source][target] = allowed;
      overridden[source][target] = true;
    }
  }
  return { preset, matrix, overridden };
}

export function effectiveCombat(area: AreaValue): CombatMatrix {
  return resolveCombat(area).matrix;
}

export function quickCombatOverride(area: AreaValue, source: string, target: string): CombatOverride {
  const resolution = resolveCombat(area);
  if (!resolution.matrix[source] || !Object.hasOwn(resolution.matrix[source], target)) return "default";
  if (!resolution.overridden[source][target]) return "default";
  return resolution.matrix[source][target] ? "allow" : "deny";
}

export function setQuickCombatOverride(area: AreaValue, source: string, target: string, value: CombatOverride): void {
  if (!area || typeof area !== "object" || Array.isArray(area)) {
    throw new TypeError("A combat area is required.");
  }
  if (!["default", "allow", "deny"].includes(value)) {
    throw new TypeError("Quick combat override must be default, allow, or deny.");
  }
  if (!SOURCE_ACTOR_IDS.has(source) || !ACTOR_IDS.has(target)) {
    throw new TypeError("Quick combat override requires a known source and target actor.");
  }

  const resolution = resolveCombat(area);
  resolution.overridden[source][target] = value !== "default";
  resolution.matrix[source][target] = value === "default"
    ? resolution.preset[source][target]
    : value === "allow";

  const combat = clone(area.combat || {});
  if (value === "default") {
    if (combat[source]) {
      delete combat[source][target];
      if (!Object.keys(combat[source]).length) delete combat[source];
    }
  } else {
    combat[source] ||= {};
    combat[source][target] = value === "allow";
  }
  area.combat = combat;
}

export function deriveFeatureSummary(input: unknown) {
  const config = hydrateConfig(input);
  const areas = [config.wilderness, config.stageAreas, ...config.regions.filter((region) => region.enabled !== false)];
  for (const schedule of config.schedules) {
    if (!schedule.enabled || !schedule.mode) continue;
    const definition = modeDefinition(schedule.mode, config) as ModeValue;
    if (!definition) continue;
    areas.push({
      name: schedule.name,
      mode: definition.id,
      schedules: [],
      actions: definition.actions,
      combat: {},
      messages: definition.messages,
      _modeDefinition: definition
    });
  }
  const owned = new Set(["player", "partnerPal", "basePal", "baseStructure"]);
  let enablesRegionalPlayerDamage = false;
  let characterPolicyNonVanilla = false;
  let structurePolicyNonVanilla = false;
  let needsWorldActionAuthorization = false;
  let needsPlayerActionEnforcement = false;
  let needsFastTravelAuthorization = false;
  let needsDecayEnforcement = false;

  for (const area of areas) {
    const matrix = effectiveCombat(area);
    for (const [source, targets] of Object.entries(matrix)) {
      for (const [target, allowed] of Object.entries(targets)) {
        if (target === "structure" || target === "baseStructure" || target === "environment") {
          structurePolicyNonVanilla ||= !allowed;
          continue;
        }
        characterPolicyNonVanilla ||= !allowed;
        enablesRegionalPlayerDamage ||= owned.has(source) && owned.has(target) && allowed === true;
      }
    }
    const actions = effectiveActions(area);
    needsWorldActionAuthorization ||= ["build", "dismantle", "editSign", "editLock"].some((action) => actions[action] === false);
    const minimumLevel = effectiveMinimumLevel(area, config);
    needsPlayerActionEnforcement ||= minimumLevel != null ||
      ["groundMount", "flyingMount", "swimmingMount"].some((action) => actions[action] === false);
    needsFastTravelAuthorization ||= minimumLevel != null ||
      actions.fastTravelDeparture !== "all" ||
      actions.fastTravelArrival !== "all";
    needsDecayEnforcement ||= actions.decay === false;
  }

  const regionalCombatEnabled = config.regionalCombat.enabled;
  const worldRulesEnabled = config.settings.worldRules !== false;
  const requestsRegionalPlayerDamage = enablesRegionalPlayerDamage;
  return Object.freeze({
    requestsRegionalPlayerDamage,
    enablesRegionalPlayerDamage:
      regionalCombatEnabled && requestsRegionalPlayerDamage,
    characterPolicyNonVanilla:
      regionalCombatEnabled && characterPolicyNonVanilla,
    structurePolicyNonVanilla:
      regionalCombatEnabled && structurePolicyNonVanilla,
    needsWorldActionAuthorization:
      worldRulesEnabled && needsWorldActionAuthorization,
    needsPlayerActionEnforcement:
      worldRulesEnabled && needsPlayerActionEnforcement,
    needsFastTravelAuthorization:
      worldRulesEnabled && needsFastTravelAuthorization,
    needsDecayEnforcement:
      worldRulesEnabled && needsDecayEnforcement,
    hotReloadEnabled: config.settings.hotReload !== false,
    notificationsEnabled: config.messages.enabled !== false,
    profilingEnabled: false
  });
}

export function resolveAreaMessages(config: PalLawConfigValue, area: Pick<AreaValue, "mode" | "messages">): GlobalMessages {
  const global = normalizeMessages(config?.messages, NEUTRAL_MESSAGES, true);
  const withMode = normalizeMessages(modeDefinition(area?.mode, config)?.messages, global, false);
  return normalizeMessages(area?.messages, withMode, false);
}

export function samePoint(a: Point | undefined, b: Point | undefined): boolean {
  return Math.abs(Number(a?.[0]) - Number(b?.[0])) <= EPSILON &&
    Math.abs(Number(a?.[1]) - Number(b?.[1])) <= EPSILON;
}

function cross(a: Point, b: Point, c: Point): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a: Point, b: Point, point: Point): boolean {
  return Math.abs(cross(a, b, point)) <= EPSILON &&
    point[0] >= Math.min(a[0], b[0]) - EPSILON &&
    point[0] <= Math.max(a[0], b[0]) + EPSILON &&
    point[1] >= Math.min(a[1], b[1]) - EPSILON &&
    point[1] <= Math.max(a[1], b[1]) + EPSILON;
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  const proper = ((abC > EPSILON && abD < -EPSILON) || (abC < -EPSILON && abD > EPSILON)) &&
    ((cdA > EPSILON && cdB < -EPSILON) || (cdA < -EPSILON && cdB > EPSILON));
  return proper || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

export function polygonSelfIntersects(polygon: readonly Point[]): boolean {
  if (!Array.isArray(polygon) || polygon.length < 4) return false;
  for (let first = 0; first < polygon.length; first += 1) {
    const firstNext = (first + 1) % polygon.length;
    for (let second = first + 1; second < polygon.length; second += 1) {
      const secondNext = (second + 1) % polygon.length;
      if (first === second || firstNext === second || secondNext === first) continue;
      if (segmentsIntersect(polygon[first], polygon[firstNext], polygon[second], polygon[secondNext])) return true;
    }
  }
  return false;
}

export function polygonArea(polygon: readonly Point[]): number {
  if (!Array.isArray(polygon) || polygon.length < 3) return 0;
  let twiceArea = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    twiceArea += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(twiceArea) / 2;
}

export function pointInPolygon(polygon: readonly Point[], point: Point): boolean {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[previous];
    const b = polygon[current];
    if (onSegment(a, b, point)) return true;
    const crosses = ((a[1] > point[1]) !== (b[1] > point[1])) &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

export function areaAt(config: PalLawConfigValue, point: Point, inStage = false): AreaValue & { isWilderness: boolean; index: number; minimumLevel: number | null } {
  if (inStage) return { ...config.stageAreas, isWilderness: false, index: -1, minimumLevel: effectiveMinimumLevel(config.stageAreas, config) };
  let result: AreaValue & { isWilderness: boolean; index: number } = { ...config.wilderness, isWilderness: true, index: -1 };
  config.regions.forEach((region, index) => {
    if (region.enabled !== false && pointInPolygon(region.polygon, point)) {
      result = { ...region, isWilderness: false, index };
    }
  });
  return { ...result, minimumLevel: effectiveMinimumLevel(result, config) };
}

export function evaluateCombat(config: PalLawConfigValue, sourceKind: string, targetKind: string, targetPoint: Point) {
  const targetArea = areaAt(config, targetPoint);
  const targetMatrix = effectiveCombat(targetArea);
  const allowed = targetMatrix[sourceKind]?.[targetKind] ?? false;
  return {
    allowed,
    targetArea
  };
}

function validateMessage(message: EventMessage, context: string, errors: ErrorSink): void {
  if (!message || typeof message !== "object") return;
  if (!Number.isFinite(Number(message.cooldownSeconds)) || message.cooldownSeconds < 0 || message.cooldownSeconds > 300) {
    errors.push(`${context}.cooldownSeconds must be between 0 and 300.`);
  }
  if (message.chat?.enabled && message.chat.text.length > 512) {
    errors.push(`${context}.chat.text must contain at most 512 characters when chat is enabled.`);
  }
  for (const { id } of ALERT_PRESENTATIONS) {
    const alert = message.alerts?.[id];
    if (id === "brief" && alert && (alert.enabled || alert.text || alert.tone !== undefined) &&
        (typeof alert.tone !== "string" || !ALERT_TONE_IDS.has(alert.tone))) {
      errors.push(`${context}.alerts.brief.tone must be normal or negative.`);
    }
    if (id === "activity" && Object.hasOwn(alert || {}, "tone")) {
      errors.push(`${context}.alerts.activity.tone is not supported.`);
    }
    if (alert?.enabled && alert.text.length > 256) {
      errors.push(`${context}.alerts.${id}.text must contain at most 256 characters when the alert is enabled.`);
    }
  }
}

function validateCombat(entries: unknown, context: string, errors: ErrorSink): void {
  if (!isPlainObject(entries)) {
    errors.push(`${context} must be an object.`);
    return;
  }
  for (const [source, row] of Object.entries(entries)) {
    if (!SOURCE_ACTOR_IDS.has(source)) errors.push(`${context}.${source} is not a supported source actor.`);
    if (!isPlainObject(row)) {
      errors.push(`${context}.${source} must be an object.`);
      continue;
    }
    for (const [target, allowed] of Object.entries(row)) {
      if (!ACTOR_IDS.has(target)) errors.push(`${context}.${source}.${target} is not a supported target actor.`);
      if (typeof allowed !== "boolean") errors.push(`${context}.${source}.${target} must be true or false.`);
    }
  }
}

function boundingBox(polygon: readonly Point[]): Box {
  return polygon.reduce((box, [x, y]) => ({
    minX: Math.min(box.minX, x), maxX: Math.max(box.maxX, x),
    minY: Math.min(box.minY, y), maxY: Math.max(box.maxY, y)
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function validateScheduleText(textValue: string, context: string, maximum: number, available: ReadonlySet<string>, errors: ErrorSink): void {
  const length = [...textValue].length;
  if (length > maximum) errors.push(`${context} must contain at most ${maximum} characters when enabled.`);
  for (const match of textValue.matchAll(/\{([^{}]+)\}/gu)) {
    const placeholder = match[1]!;
    if (!SCHEDULE_PLACEHOLDERS.has(placeholder)) errors.push(`${context} contains unsupported placeholder {${placeholder}}.`);
    else if (!available.has(placeholder)) errors.push(`${context} cannot use {${placeholder}} for this schedule.`);
  }
}

function validateScheduleDefinitions(config: PalLawConfigValue, modeIds: ReadonlySet<string>, errors: ErrorSink, warnings: string[]): void {
  if (config.schedules.length > 64) errors.push("schedules must contain at most 64 entries.");
  const scheduleIds = new Set<string>();
  const scheduleNames = new Set<string>();
  const targets = new Map<string, string[]>();
  const areas: Array<{ area: AreaValue; path: string }> = [
    { area: config.wilderness, path: "wilderness" },
    { area: config.stageAreas, path: "stageAreas" },
    ...config.regions.map((area, index) => ({ area, path: `regions[${index}]` }))
  ];
  for (const { area, path } of areas) {
    const seen = new Set<string>();
    area.schedules.forEach((id, index) => {
      if (seen.has(id)) errors.push(`${path}.schedules[${index}] duplicates ${id}.`);
      seen.add(id);
      const entries = targets.get(id) ?? [];
      entries.push(path);
      targets.set(id, entries);
    });
  }
  config.schedules.forEach((schedule, index) => {
    const context = `schedules[${index}]`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(schedule.id)) errors.push(`${context}.id must use lowercase slug syntax.`);
    if (scheduleIds.has(schedule.id)) errors.push(`${context}.id duplicates another schedule.`);
    scheduleIds.add(schedule.id);
    const normalizedName = schedule.name.trim().toLocaleLowerCase();
    if (!normalizedName || [...schedule.name].length > 96) errors.push(`${context}.name must contain between 1 and 96 characters.`);
    if (scheduleNames.has(normalizedName)) errors.push(`${context}.name duplicates another schedule name ignoring case.`);
    scheduleNames.add(normalizedName);
    if (!schedule.days.length || schedule.days.length > 7 || schedule.days.some((day) => !WEEKDAY_IDS.has(day)) || new Set(schedule.days).size !== schedule.days.length) {
      errors.push(`${context}.days must contain one to seven unique weekdays.`);
    }
    if (!ISO_MINUTE_TIME.test(schedule.startTime)) errors.push(`${context}.startTime must use UTC HH:mm.`);
    if (schedule.endTime !== null && !ISO_MINUTE_TIME.test(schedule.endTime)) errors.push(`${context}.endTime must use UTC HH:mm.`);
    if (schedule.announcements.length > 64) errors.push(`${context}.announcements must contain at most 64 entries.`);
    if (!schedule.mode && schedule.announcements.length === 0) errors.push(`${context} must define a mode takeover or at least one announcement.`);
    if (schedule.mode) {
      if (!modeIds.has(schedule.mode)) errors.push(`${context}.mode references an unknown mode.`);
      if (schedule.endTime === null) errors.push(`${context}.endTime is required for a mode takeover.`);
      if (!(targets.get(schedule.id)?.length)) errors.push(`${context} is a mode takeover but no Area references it.`);
    } else {
      if (targets.get(schedule.id)?.length) errors.push(`${context} is announcement-only and cannot be assigned to Areas.`);
    }
    const available = new Set(SCHEDULE_PLACEHOLDERS);
    const duration = scheduleDurationMinutes(schedule);
    schedule.announcements.forEach((announcement, announcementIndex) => {
      const announcementContext = `${context}.announcements[${announcementIndex}]`;
      if (announcement.relativeTo !== "start" && announcement.relativeTo !== "end") errors.push(`${announcementContext}.relativeTo must be start or end.`);
      if (!Number.isInteger(announcement.minutesBefore) || announcement.minutesBefore < 0 || announcement.minutesBefore > 60) errors.push(`${announcementContext}.minutesBefore must be an integer between 0 and 60.`);
      if (announcement.relativeTo === "end") {
        if (!schedule.endTime) errors.push(`${announcementContext} cannot use end without endTime.`);
        else if (duration !== null && announcement.minutesBefore > duration) errors.push(`${announcementContext}.minutesBefore cannot exceed the schedule duration.`);
      }
      const anyOutput = announcement.globalChat.enabled || announcement.serverNotice.enabled;
      if (announcement.enabled && !anyOutput) errors.push(`${announcementContext} must enable Global chat or Server notice.`);
      if (announcement.globalChat.enabled) validateScheduleText(announcement.globalChat.text, `${announcementContext}.globalChat.text`, 512, available, errors);
      if (announcement.serverNotice.enabled) validateScheduleText(announcement.serverNotice.text, `${announcementContext}.serverNotice.text`, 256, available, errors);
    });
  });
  for (const [id, paths] of targets) {
    if (!scheduleIds.has(id)) for (const path of paths) errors.push(`${path}.schedules references unknown schedule ${id}.`);
  }
  config.schedules.filter((schedule) => !schedule.enabled).forEach((schedule) => warnings.push(`Schedule "${schedule.name}" is disabled.`));
}

function isPlainObject(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rejectUnknownKeys(value: unknown, allowed: ReadonlySet<string>, context: string, errors: ErrorSink): value is JsonRecord {
  if (!isPlainObject(value)) {
    errors.push(`${context} must be an object.`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${context}.${key} is not supported.`);
  }
  return true;
}

function validateRawChannel(value: unknown, context: string, errors: ErrorSink, allowTone = false): void {
  if (typeof value === "boolean" || typeof value === "string") return;
  if (!rejectUnknownKeys(value, new Set(allowTone ? ["enabled", "text", "tone"] : ["enabled", "text"]), context, errors)) return;
  if (!Object.keys(value).length) errors.push(`${context} must contain at least one override field.`);
  if (allowTone && Object.hasOwn(value, "tone") && (typeof value.tone !== "string" || !ALERT_TONE_IDS.has(value.tone))) {
    errors.push(`${context}.tone must be normal or negative.`);
  }
}

function validateRawAlerts(value: unknown, context: string, errors: ErrorSink): void {
  if (!rejectUnknownKeys(value, ALERT_PRESENTATION_IDS, context, errors)) return;
  if (!Object.keys(value).length) errors.push(`${context} must contain at least one override field.`);
  for (const { id } of ALERT_PRESENTATIONS) {
    if (Object.hasOwn(value, id)) validateRawChannel(value[id], `${context}.${id}`, errors, id === "brief");
  }
}

function validateRawMessage(value: unknown, context: string, errors: ErrorSink): void {
  if (typeof value === "boolean") return;
  if (!rejectUnknownKeys(value, new Set(["enabled", "cooldownSeconds", "chat", "alerts"]), context, errors)) return;
  if (!Object.keys(value).length) errors.push(`${context} must contain at least one field.`);
  if (Object.hasOwn(value, "chat")) validateRawChannel(value.chat, `${context}.chat`, errors);
  if (Object.hasOwn(value, "alerts")) validateRawAlerts(value.alerts, `${context}.alerts`, errors);
}

function validateRawMessages(value: unknown, context: string, global: boolean, errors: ErrorSink): void {
  const allowed = new Set(MESSAGE_EVENTS.map((event) => event.id));
  if (global) {
    allowed.add("enabled");
    allowed.add("actionNames");
  }
  if (!rejectUnknownKeys(value, allowed, context, errors)) return;
  if (!global && !Object.keys(value).length) errors.push(`${context} must contain at least one override field.`);
  if (global && Object.hasOwn(value, "actionNames")) {
    validateRawDisplayNames(value.actionNames, DEFAULT_ACTION_NAMES, `${context}.actionNames`, errors);
  }
  for (const event of MESSAGE_EVENTS) {
    if (Object.hasOwn(value, event.id)) validateRawMessage(value[event.id], `${context}.${event.id}`, errors);
  }
}

function validateRawDisplayNames(value: unknown, defaults: Readonly<Record<string, string>>, context: string, errors: ErrorSink): void {
  if (!rejectUnknownKeys(value, new Set(Object.keys(defaults)), context, errors)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      errors.push(`${context}.${key} must be a string.`);
      continue;
    }
    const length = [...entry].length;
    if (length > 96) {
      errors.push(`${context}.${key} must contain at most 96 characters.`);
    }
  }
}

function validateRawActions(value: unknown, context: string, errors: ErrorSink): void {
  const allowed = new Set(ACTIONS.map((action) => action.id));
  if (!rejectUnknownKeys(value, allowed, context, errors)) return;
  if (!Object.keys(value).length) errors.push(`${context} must contain at least one override field.`);
  for (const [key, entry] of Object.entries(value)) {
    if (key === "fastTravelDeparture") {
      if (!isFastTravelPolicy(key, entry)) {
        errors.push(`${context}.${key} must be all, baseToAll, baseToBase, allToBase, or none.`);
      }
    } else if (key === "fastTravelArrival") {
      if (!isFastTravelPolicy(key, entry)) {
        errors.push(`${context}.${key} must be all, baseOnly, or none.`);
      }
    } else if (typeof entry !== "boolean") {
      errors.push(`${context}.${key} must be true or false.`);
    }
  }
}

function validateRawCombat(value: unknown, context: string, errors: ErrorSink): void {
  if (!rejectUnknownKeys(value, SOURCE_ACTOR_IDS, context, errors)) return;
  if (!Object.keys(value).length) errors.push(`${context} must contain at least one override cell.`);
  for (const [source, row] of Object.entries(value)) {
    const rowContext = `${context}.${source}`;
    if (!rejectUnknownKeys(row, ACTOR_IDS, rowContext, errors)) continue;
    if (!Object.keys(row).length) errors.push(`${rowContext} must contain at least one override cell.`);
    for (const [target, allowed] of Object.entries(row)) {
      if (typeof allowed !== "boolean") errors.push(`${rowContext}.${target} must be true or false.`);
    }
  }
}

function validateRawArea(value: unknown, context: string, region: boolean, errors: ErrorSink): void {
  const allowed = new Set(["name", "mode", "schedules", "actions", "combat", "messages"]);
  if (region) {
    for (const key of ["enabled", "minimumLevel", "map", "polygon"]) allowed.add(key);
  }
  if (!rejectUnknownKeys(value, allowed, context, errors)) return;
  if (!Object.hasOwn(value, "name")) errors.push(`${context}.name is required.`);
  if (!Object.hasOwn(value, "mode")) errors.push(`${context}.mode is required.`);
  if (Object.hasOwn(value, "actions")) validateRawActions(value.actions, `${context}.actions`, errors);
  if (Object.hasOwn(value, "combat")) validateRawCombat(value.combat, `${context}.combat`, errors);
  if (Object.hasOwn(value, "messages")) validateRawMessages(value.messages, `${context}.messages`, false, errors);
  if (Object.hasOwn(value, "schedules") && !Array.isArray(value.schedules)) errors.push(`${context}.schedules must be an array.`);
  if (region && !Object.hasOwn(value, "polygon")) errors.push(`${context}.polygon is required.`);
  if (region && !Object.hasOwn(value, "map")) errors.push(`${context}.map is required.`);
  if (region && Object.hasOwn(value, "enabled") && typeof value.enabled !== "boolean") errors.push(`${context}.enabled must be true or false.`);
  if (region && Object.hasOwn(value, "minimumLevel") && value.minimumLevel !== null &&
      (typeof value.minimumLevel !== "number" || !Number.isInteger(value.minimumLevel) || value.minimumLevel < 1 || value.minimumLevel > 999)) {
    errors.push(`${context}.minimumLevel must be null or an integer between 1 and 999.`);
  }
  if (region && Object.hasOwn(value, "map") && (typeof value.map !== "string" || !value.map.length || value.map.length > 64)) errors.push(`${context}.map must contain between 1 and 64 characters.`);
}

function validateRawScheduleOutput(value: unknown, context: string, errors: ErrorSink): void {
  if (!rejectUnknownKeys(value, new Set(["enabled", "text"]), context, errors)) return;
  if (Object.hasOwn(value, "enabled") && typeof value.enabled !== "boolean") errors.push(`${context}.enabled must be true or false.`);
  if (Object.hasOwn(value, "text") && typeof value.text !== "string") errors.push(`${context}.text must be a string.`);
}

function validateRawAnnouncement(value: unknown, context: string, errors: ErrorSink): void {
  if (!rejectUnknownKeys(value, new Set(["enabled", "relativeTo", "minutesBefore", "globalChat", "serverNotice"]), context, errors)) return;
  for (const key of ["relativeTo", "minutesBefore"]) if (!Object.hasOwn(value, key)) errors.push(`${context}.${key} is required.`);
  if (Object.hasOwn(value, "enabled") && typeof value.enabled !== "boolean") errors.push(`${context}.enabled must be true or false.`);
  if (Object.hasOwn(value, "globalChat")) validateRawScheduleOutput(value.globalChat, `${context}.globalChat`, errors);
  if (Object.hasOwn(value, "serverNotice")) validateRawScheduleOutput(value.serverNotice, `${context}.serverNotice`, errors);
}

function validateRawSchedule(value: unknown, index: number, errors: ErrorSink): void {
  const context = `schedules[${index}]`;
  if (!rejectUnknownKeys(value, new Set(["id", "name", "enabled", "days", "startTime", "endTime", "mode", "announcements"]), context, errors)) return;
  for (const key of ["id", "name", "days", "startTime"]) if (!Object.hasOwn(value, key)) errors.push(`${context}.${key} is required.`);
  if (Object.hasOwn(value, "enabled") && typeof value.enabled !== "boolean") errors.push(`${context}.enabled must be true or false.`);
  if (Object.hasOwn(value, "announcements")) {
    if (!Array.isArray(value.announcements)) errors.push(`${context}.announcements must be an array.`);
    else value.announcements.forEach((announcement, announcementIndex) => validateRawAnnouncement(announcement, `${context}.announcements[${announcementIndex}]`, errors));
  }
}

function validateRawMode(value: unknown, index: number, errors: ErrorSink): void {
  const context = `modes[${index}]`;
  if (!rejectUnknownKeys(value, new Set(["id", "name", "color", "minimumLevel", "actions", "combat", "messages"]), context, errors)) return;
  for (const key of ["id", "name", "color", "actions", "combat"]) {
    if (!Object.hasOwn(value, key)) errors.push(`${context}.${key} is required.`);
  }
  if (Object.hasOwn(value, "minimumLevel") &&
      value.minimumLevel !== null &&
      (typeof value.minimumLevel !== "number" || !Number.isInteger(value.minimumLevel) || value.minimumLevel < 1 || value.minimumLevel > 999)) {
    errors.push(`${context}.minimumLevel must be null or an integer between 1 and 999.`);
  }
  if (Object.hasOwn(value, "actions")) {
    validateRawActions(value.actions, `${context}.actions`, errors);
    const actions = value.actions;
    for (const action of ACTIONS) {
      if (!isPlainObject(actions) || !Object.hasOwn(actions, action.id)) errors.push(`${context}.actions.${action.id} is required.`);
    }
  }
  if (Object.hasOwn(value, "combat")) {
    if (!isPlainObject(value.combat)) errors.push(`${context}.combat must be an object.`);
    else {
      const sourceIds = ACTORS.filter((actor) => !actor.targetOnly).map((actor) => actor.id);
      rejectUnknownKeys(value.combat, new Set(sourceIds), `${context}.combat`, errors);
      for (const source of sourceIds) {
        if (!Object.hasOwn(value.combat, source)) {
          errors.push(`${context}.combat.${source} is required.`);
          continue;
        }
        if (!rejectUnknownKeys(value.combat[source], ACTOR_IDS, `${context}.combat.${source}`, errors)) continue;
        for (const target of ACTORS) {
          if (!Object.hasOwn(value.combat[source], target.id)) errors.push(`${context}.combat.${source}.${target.id} is required.`);
          else if (typeof value.combat[source][target.id] !== "boolean") errors.push(`${context}.combat.${source}.${target.id} must be true or false.`);
        }
      }
    }
  }
  if (Object.hasOwn(value, "messages")) validateRawMessages(value.messages, `${context}.messages`, false, errors);
}

function validateRawRegionalCombat(value: unknown, errors: ErrorSink): void {
  if (!rejectUnknownKeys(
    value,
    new Set(["enabled"]),
    "regionalCombat",
    errors
  )) return;
  if (Object.hasOwn(value, "enabled") &&
      typeof value.enabled !== "boolean") {
    errors.push("regionalCombat.enabled must be true or false.");
  }
}

function validateRawConfig(input: unknown, errors: ErrorSink): void {
  if (!rejectUnknownKeys(input, new Set(["$schema", "version", "regionalCombat", "settings", "messages", "schedules", "modes", "wilderness", "stageAreas", "regions"]), "root", errors)) return;
  if (!Object.hasOwn(input, "version")) errors.push("version is required.");
  if (!Object.hasOwn(input, "settings")) errors.push("settings is required.");
  if (!Object.hasOwn(input, "modes")) errors.push("modes is required.");
  if (!Object.hasOwn(input, "wilderness")) errors.push("wilderness is required.");
  if (!Object.hasOwn(input, "stageAreas")) errors.push("stageAreas is required.");
  if (Object.hasOwn(input, "regionalCombat")) {
    validateRawRegionalCombat(input.regionalCombat, errors);
  }
  if (Object.hasOwn(input, "settings")) {
    const allowed = new Set(Object.keys(DEFAULT_SETTINGS));
    if (rejectUnknownKeys(input.settings, allowed, "settings", errors)) {
      const settings = input.settings;
      for (const key of ["hotReload", "worldRules", "adminBypass", "debugLogging"]) {
        if (Object.hasOwn(settings, key) && typeof settings[key] !== "boolean") errors.push(`settings.${key} must be true or false.`);
      }
      const validateNumber = (key: string, minimum: number, maximum: number) => {
        if (Object.hasOwn(settings, key) && (typeof settings[key] !== "number" || !Number.isFinite(settings[key]) || settings[key] < minimum || settings[key] > maximum)) {
          errors.push(`settings.${key} must be between ${minimum} and ${maximum}.`);
        }
      };
      validateNumber("hotReloadSeconds", 0.1, 60);
      validateNumber("playerSweepSeconds", 0.05, 10);
      validateNumber("mountGraceSeconds", 0, 120);
      if (!Object.hasOwn(settings, "playerSweepSeconds")) errors.push("settings.playerSweepSeconds is required.");
      if (settings.hotReload === true && !Object.hasOwn(settings, "hotReloadSeconds")) errors.push("settings.hotReloadSeconds is required when hotReload is true.");
    }
  }
  if (Object.hasOwn(input, "messages")) validateRawMessages(input.messages, "messages", true, errors);
  if (Object.hasOwn(input, "schedules")) {
    if (!Array.isArray(input.schedules)) errors.push("schedules must be an array.");
    else input.schedules.forEach((schedule, index) => validateRawSchedule(schedule, index, errors));
  }
  if (Object.hasOwn(input, "modes")) {
    if (!Array.isArray(input.modes)) errors.push("modes must be an array.");
    else input.modes.forEach((mode, index) => validateRawMode(mode, index, errors));
  }
  if (Object.hasOwn(input, "wilderness")) validateRawArea(input.wilderness, "wilderness", false, errors);
  if (Object.hasOwn(input, "stageAreas")) validateRawArea(input.stageAreas, "stageAreas", false, errors);
  if (Object.hasOwn(input, "regions")) {
    if (!Array.isArray(input.regions)) errors.push("regions must be an array.");
    else input.regions.forEach((region, index) => validateRawArea(region, `regions[${index}]`, true, errors));
  }
}

type BriefToneDefinitions = Record<string, boolean>;

function resolveBriefToneDefinitions(
  messages: unknown,
  parent: BriefToneDefinitions,
  context: string,
  errors: ErrorSink
): BriefToneDefinitions {
  const result = { ...parent };
  if (!isPlainObject(messages)) return result;
  for (const event of MESSAGE_EVENTS) {
    const rawEvent = messages[event.id];
    if (!isPlainObject(rawEvent) || !isPlainObject(rawEvent.alerts) || !Object.hasOwn(rawEvent.alerts, "brief")) continue;
    const brief = rawEvent.alerts.brief;
    const toneDefined = isPlainObject(brief) && Object.hasOwn(brief, "tone") &&
      typeof brief.tone === "string" && ALERT_TONE_IDS.has(brief.tone);
    if (toneDefined) {
      result[event.id] = true;
    } else if (brief !== false && !result[event.id]) {
      errors.push(`${context}.${event.id}.alerts.brief.tone is required because no parent layer defines it.`);
    }
  }
  return result;
}

function validateBriefToneInheritance(input: unknown, errors: ErrorSink): void {
  if (!isPlainObject(input)) return;
  const empty = Object.fromEntries(MESSAGE_EVENTS.map(({ id }) => [id, false]));
  const global = resolveBriefToneDefinitions(input.messages, empty, "messages", errors);
  const modes = new Map<string, BriefToneDefinitions>();
  if (Array.isArray(input.modes)) {
    input.modes.forEach((mode, index) => {
      if (!isPlainObject(mode)) return;
      const definitions = resolveBriefToneDefinitions(mode.messages, global, `modes[${index}].messages`, errors);
      if (typeof mode.id === "string") modes.set(mode.id, definitions);
    });
  }
  const validateArea = (area: unknown, context: string) => {
    if (!isPlainObject(area)) return;
    const parent = typeof area.mode === "string" ? modes.get(area.mode) ?? global : global;
    resolveBriefToneDefinitions(area.messages, parent, `${context}.messages`, errors);
  };
  validateArea(input.wilderness, "wilderness");
  validateArea(input.stageAreas, "stageAreas");
  if (Array.isArray(input.regions)) input.regions.forEach((region, index) => validateArea(region, `regions[${index}]`));
}

export function validateConfig(input: unknown) {
  const errorSink = createBoundedErrorSink();
  const errors = errorSink;
  const warnings: string[] = [];
  const rawInput = isHydratedConfig(input) ? serializeConfig(input) : input;
  try {
    validateRawConfigurationLimits(rawInput);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  validateRawConfig(rawInput, errors);
  validateBriefToneInheritance(rawInput, errors);
  const config = hydrateConfig(input);
  if (Number(config.version) !== CONFIG_VERSION) errors.push(`version must be ${CONFIG_VERSION}.`);
  if (config.modes.length < 1 || config.modes.length > 128) errors.push("modes must contain between 1 and 128 entries.");
  const modeIds = new Set<string>();
  const modeNames = new Set<string>();
  config.modes.forEach((mode, index) => {
    const prefix = `modes[${index}]`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(mode.id)) errors.push(`${prefix}.id must use lowercase slug syntax.`);
    if (modeIds.has(mode.id)) errors.push(`${prefix}.id duplicates another mode.`);
    modeIds.add(mode.id);
    const normalizedName = mode.name.trim().toLowerCase();
    if (!normalizedName || [...mode.name].length > 96) errors.push(`${prefix}.name must contain between 1 and 96 characters.`);
    if (modeNames.has(normalizedName)) errors.push(`${prefix}.name duplicates another mode name ignoring case.`);
    modeNames.add(normalizedName);
    if (!/^#[0-9a-f]{6}$/i.test(mode.color)) errors.push(`${prefix}.color must use #RRGGBB.`);
    if (mode.minimumLevel !== null && (!Number.isInteger(mode.minimumLevel) || mode.minimumLevel < 1 || mode.minimumLevel > 999)) {
      errors.push(`${prefix}.minimumLevel must be null or an integer between 1 and 999.`);
    }
  });
  if (!config.wilderness.name.trim()) errors.push("wilderness.name is required.");
  if (!modeIds.has(config.wilderness.mode)) errors.push("wilderness.mode references an unknown mode.");
  validateCombat(config.wilderness.combat, "wilderness.combat", errors);

  if (!config.stageAreas.name.trim()) errors.push("stageAreas.name is required.");
  if (!modeIds.has(config.stageAreas.mode)) errors.push("stageAreas.mode references an unknown mode.");
  validateCombat(config.stageAreas.combat, "stageAreas.combat", errors);

  const names = new Map([[config.wilderness.name.trim().toLowerCase(), "wilderness"]]);
  const normalizedStageName = config.stageAreas.name.trim().toLowerCase();
  if (normalizedStageName && names.has(normalizedStageName)) errors.push(`stageAreas.name duplicates ${names.get(normalizedStageName)}.`);
  else if (normalizedStageName) names.set(normalizedStageName, "stageAreas");
  config.regions.forEach((region, index) => {
    const prefix = `regions[${index}]`;
    const name = region.name.trim();
    if (!name) errors.push(`${prefix}.name is required.`);
    const normalized = name.toLowerCase();
    if (normalized && names.has(normalized)) errors.push(`${prefix}.name duplicates ${names.get(normalized)}.`);
    else if (normalized) names.set(normalized, prefix);
    if (!modeIds.has(region.mode)) errors.push(`${prefix}.mode references an unknown mode.`);
    if (!Array.isArray(region.polygon) || region.polygon.length < 3) errors.push(`${prefix}.polygon requires at least three points.`);
    else {
      if (polygonArea(region.polygon) <= EPSILON) errors.push(`${prefix}.polygon must enclose a non-zero area.`);
      if (polygonSelfIntersects(region.polygon)) errors.push(`${prefix}.polygon must not self-intersect.`);
      for (let point = 0; point < region.polygon.length; point += 1) {
        const current = region.polygon[point];
        const next = region.polygon[(point + 1) % region.polygon.length];
        if (samePoint(current, next)) errors.push(`${prefix}.polygon contains adjacent duplicate points.`);
      }
    }
    if (Object.hasOwn(region, "minimumLevel") && region.minimumLevel !== null &&
        (!Number.isInteger(region.minimumLevel) || Number(region.minimumLevel) < 1 || Number(region.minimumLevel) > 999)) {
      errors.push(`${prefix}.minimumLevel must be an integer between 1 and 999.`);
    }
    validateCombat(region.combat, `${prefix}.combat`, errors);
    if (!region.enabled) warnings.push(`${prefix} (${region.name || "unnamed"}) is disabled.`);
  });

  validateScheduleDefinitions(config, modeIds, errors, warnings);

  const stageMessages = resolveAreaMessages(config, config.stageAreas);
  for (const event of MESSAGE_EVENTS) validateMessage(messageFor(stageMessages, event.id), `stageAreas.messages.${event.id}`, errors);

  const globalMessages = normalizeMessages(config.messages, NEUTRAL_MESSAGES, true);
  for (const event of MESSAGE_EVENTS) validateMessage(messageFor(globalMessages, event.id), `messages.${event.id}`, errors);
  config.regions.forEach((region, index) => {
    const resolved = resolveAreaMessages(config, region);
    for (const event of MESSAGE_EVENTS) validateMessage(messageFor(resolved, event.id), `regions[${index}].messages.${event.id}`, errors);
  });
  config.modes.forEach((mode, index) => {
    const resolved = resolveAreaMessages(config, { mode: mode.id, messages: {} });
    for (const event of MESSAGE_EVENTS) validateMessage(messageFor(resolved, event.id), `modes[${index}].messages.${event.id}`, errors);
  });

  const enabled = config.regions
    .map((region, index) => ({ region, index }))
    .filter(({ region }) => region.enabled && region.polygon.length >= 3);
  for (let first = 0; first < enabled.length; first += 1) {
    for (let second = first + 1; second < enabled.length; second += 1) {
      const a = enabled[first];
      const b = enabled[second];
      if (boxesOverlap(boundingBox(a.region.polygon), boundingBox(b.region.polygon))) {
        warnings.push(`Regions "${a.region.name}" and "${b.region.name}" may overlap. "${b.region.name}" wins because it appears later.`);
      }
    }
  }

  const combatFeatures = deriveFeatureSummary(config);
  if (combatFeatures.requestsRegionalPlayerDamage &&
      !config.regionalCombat.enabled) {
    warnings.push(
      "Regional combat is configured but regionalCombat.enabled is false, so PalLaw leaves all combat on Palworld's vanilla path."
    );
  }
  const boundedErrors = errorSink.finalize();
  return {
    config,
    featureSummary: boundedErrors.length ? null : deriveFeatureSummary(config),
    errors: boundedErrors,
    warnings,
    valid: boundedErrors.length === 0
  };
}

function compactMessage(message: EventMessage, defaults: EventMessage): JsonRecord {
  const result: JsonRecord = {};
  if (message.enabled !== defaults.enabled) result.enabled = message.enabled;
  if (message.cooldownSeconds !== defaults.cooldownSeconds) result.cooldownSeconds = message.cooldownSeconds;
  if (message.chat.enabled !== defaults.chat.enabled || message.chat.text !== defaults.chat.text) {
    result.chat = { enabled: message.chat.enabled, text: message.chat.text };
  }
  const alerts: JsonRecord = {};
  for (const { id } of ALERT_PRESENTATIONS) {
    if (message.alerts[id].enabled !== defaults.alerts[id].enabled ||
        message.alerts[id].text !== defaults.alerts[id].text ||
        (id === "brief" && message.alerts[id].tone !== defaults.alerts[id].tone)) {
      alerts[id] = {
        enabled: message.alerts[id].enabled,
        text: message.alerts[id].text,
        ...(id === "brief" ? { tone: message.alerts[id].tone } : {})
      };
    }
  }
  if (Object.keys(alerts).length) result.alerts = alerts;
  return result;
}

function compactMessages(messages: GlobalMessages, defaults: Readonly<GlobalMessages>, includeGlobalControls: boolean): JsonRecord {
  const result: JsonRecord = {};
  if (includeGlobalControls) {
    if (messages.enabled !== defaults.enabled) result.enabled = messages.enabled;
    const actionNames = compactDisplayNames(messages.actionNames, defaults.actionNames);
    if (Object.keys(actionNames).length) result.actionNames = actionNames;
  }
  for (const event of MESSAGE_EVENTS) {
    const compact = compactMessage(messageFor(messages, event.id), messageFor(defaults as GlobalMessages, event.id));
    if (Object.keys(compact).length) result[event.id] = compact;
  }
  return result;
}

function compactDisplayNames(names: Readonly<Record<string, string>>, defaults: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.keys(defaults)
    .filter((key) => names?.[key] !== defaults[key])
    .map((key) => [key, names[key]]));
}

function compactArea(area: AreaValue): JsonRecord {
  const result: JsonRecord = { name: area.name, mode: area.mode };
  if (area.schedules.length) result.schedules = [...area.schedules];
  if (Object.keys(area.actions || {}).length) result.actions = clone(area.actions);
  if (Object.keys(area.combat || {}).length) result.combat = clone(area.combat);
  if (Object.keys(area.messages || {}).length) result.messages = clone(area.messages);
  return result;
}

function compactSettings(settings: RuntimeSettingsValue): JsonRecord {
  return {
    playerSweepSeconds: settings.playerSweepSeconds,
    ...(settings.hotReload ? { hotReload: true } : {}),
    ...(settings.hotReloadSeconds !== 0 ? { hotReloadSeconds: settings.hotReloadSeconds } : {}),
    ...(settings.worldRules ? { worldRules: true } : {}),
    ...(settings.adminBypass ? { adminBypass: true } : {}),
    ...(settings.mountGraceSeconds !== 0 ? { mountGraceSeconds: settings.mountGraceSeconds } : {}),
    ...(settings.debugLogging ? { debugLogging: true } : {})
  };
}

function compactScheduleOutput(output: ScheduleOutput): JsonRecord | null {
  const result: JsonRecord = {};
  if (output.enabled) result.enabled = true;
  if (output.text) result.text = output.text;
  return Object.keys(result).length ? result : null;
}

export function serializeConfig(input: unknown): JsonRecord {
  const config = hydrateConfig(input);
  const result: JsonRecord = {
    $schema: `./${SCHEMA_FILE_NAME}`,
    version: CONFIG_VERSION,
    ...(config.regionalCombat.enabled ? { regionalCombat: { enabled: true } } : {}),
    settings: compactSettings(config.settings),
    ...(() => {
      const messages = compactMessages(config.messages, NEUTRAL_MESSAGES, true);
      return Object.keys(messages).length ? { messages } : {};
    })(),
    ...(config.schedules.length ? { schedules: config.schedules.map((schedule) => ({
      id: schedule.id,
      name: schedule.name,
      ...(schedule.enabled ? { enabled: true } : {}),
      days: [...schedule.days],
      startTime: schedule.startTime,
      ...(schedule.endTime ? { endTime: schedule.endTime } : {}),
      ...(schedule.mode ? { mode: schedule.mode } : {}),
      ...(schedule.announcements.length ? { announcements: schedule.announcements.map((announcement) => {
        const globalChat = compactScheduleOutput(announcement.globalChat);
        const serverNotice = compactScheduleOutput(announcement.serverNotice);
        return {
          ...(announcement.enabled ? { enabled: true } : {}),
          relativeTo: announcement.relativeTo,
          minutesBefore: announcement.minutesBefore,
          ...(globalChat ? { globalChat } : {}),
          ...(serverNotice ? { serverNotice } : {})
        };
      }) } : {})
    })) } : {}),
    modes: config.modes.map((mode) => ({
      id: mode.id,
      name: mode.name,
      color: mode.color,
      ...(mode.minimumLevel !== null ? { minimumLevel: mode.minimumLevel } : {}),
      actions: clone(mode.actions),
      combat: clone(mode.combat),
      ...(Object.keys(mode.messages || {}).length ? { messages: clone(mode.messages) } : {})
    })),
    wilderness: compactArea(config.wilderness),
    stageAreas: compactArea(config.stageAreas),
    ...(config.regions.length ? { regions: config.regions.map((region) => {
      const area = compactArea(region);
      return {
        ...area,
        ...(region.enabled ? { enabled: true } : {}),
        ...(Object.hasOwn(region, "minimumLevel") ? { minimumLevel: region.minimumLevel ?? null } : {}),
        map: region.map,
        polygon: region.polygon.map(([x, y]) => [Number(x), Number(y)])
      };
    }) } : {})
  };
  return result;
}

export function stringifyConfig(input: unknown): string {
  return `${JSON.stringify(serializeConfig(input), null, 2)}\n`;
}

function currentMigrationRegistry(): MigrationDefinition[] {
  const validateLegacyActionNames = (document: JsonObject) => {
    const messages = isPlainObject(document.messages) ? document.messages : null;
    const names = messages && isPlainObject(messages.actionNames) ? messages.actionNames : null;
    if (!names) return;
    for (const [key, value] of Object.entries(names)) {
      if (value === "") {
        throw new Error(`messages.actionNames.${key} must contain between 1 and 96 characters in Configuration Versions 1 through 4.`);
      }
    }
  };
  const validateLegacyMessageShape = (document: JsonObject) => {
    const messages = isPlainObject(document.messages) ? document.messages : null;
    if (!messages) return;
    if (Object.hasOwn(messages, "notifyOnFirstLocation")) {
      throw new Error("messages.notifyOnFirstLocation is not supported.");
    }
    for (const eventName of [...MESSAGE_EVENTS.map(({ id }) => id), "pvpWarning"]) {
      const event = isPlainObject(messages[eventName]) ? messages[eventName] : null;
      if (!event) continue;
      for (const key of Object.keys(event)) {
        if (!["enabled", "cooldownSeconds", "chat", "alerts"].includes(key)) {
          throw new Error(`messages.${eventName}.${key} is not supported.`);
        }
      }
      const alerts = isPlainObject(event.alerts) ? event.alerts : null;
      if (!alerts) continue;
      for (const key of Object.keys(alerts)) {
        if (!["brief", "activity"].includes(key)) {
          throw new Error(`messages.${eventName}.alerts.${key} is not supported.`);
        }
      }
      const brief = isPlainObject(alerts.brief) ? alerts.brief : null;
      if (brief && Object.hasOwn(brief, "tone") &&
          (typeof brief.tone !== "string" || !ALERT_TONE_IDS.has(brief.tone))) {
        throw new Error(`messages.${eventName}.alerts.brief.tone must be normal or negative.`);
      }
      const activity = isPlainObject(alerts.activity) ? alerts.activity : null;
      if (activity && Object.hasOwn(activity, "tone")) {
        throw new Error(`messages.${eventName}.alerts.activity.tone is not supported.`);
      }
    }
  };
  const validateVersion1MessageText = (document: JsonObject) => {
    const validateChannel = (value: unknown, context: string, maximum: number) => {
      if (typeof value === "string" && value.length === 0) {
        throw new Error(`${context} must contain 1 to ${maximum} characters in Configuration Version 1.`);
      }
      if (isPlainObject(value) && Object.hasOwn(value, "text") && value.text === "") {
        throw new Error(`${context}.text must contain 1 to ${maximum} characters in Configuration Version 1.`);
      }
    };
    const validateMessages = (value: unknown, context: string) => {
      if (!isPlainObject(value)) return;
      for (const eventId of ["regionChanged", "pvpWarning", "actionDenied", "levelDenied"]) {
        const event = value[eventId];
        if (!isPlainObject(event)) continue;
        if (Object.hasOwn(event, "chat")) validateChannel(event.chat, `${context}.${eventId}.chat`, 512);
        if (!isPlainObject(event.alerts)) continue;
        if (Object.hasOwn(event.alerts, "brief")) validateChannel(event.alerts.brief, `${context}.${eventId}.alerts.brief`, 256);
        if (Object.hasOwn(event.alerts, "activity")) validateChannel(event.alerts.activity, `${context}.${eventId}.alerts.activity`, 256);
      }
    };
    validateMessages(document.messages, "messages");
    const validateArea = (area: unknown, context: string) => {
      if (isPlainObject(area)) validateMessages(area.messages, `${context}.messages`);
    };
    validateArea(document.wilderness, "wilderness");
    if (Array.isArray(document.regions)) {
      document.regions.forEach((region, index) => validateArea(region, `regions[${index}]`));
    }
  };
  const migrateCombat = (area: unknown, path: string, report: MigrationReportEntry[]) => {
    if (!isPlainObject(area) || !Array.isArray(area.combat)) return;
    area.combat.forEach((entry, index) => {
      if (!isPlainObject(entry) ||
          !Object.hasOwn(entry, "damage")) {
        return;
      }
      if (Object.hasOwn(entry, "allow")) {
        throw new Error(`${path}.combat[${index}] must use exactly one of allow or damage.`);
      }
      if (typeof entry.damage !== "number" || !Number.isFinite(entry.damage) ||
          entry.damage < 0 || entry.damage > 100) {
        throw new Error(`${path}.combat[${index}].damage must be between 0 and 100.`);
      }
      entry.allow = entry.damage > 0;
      delete entry.damage;
      addMigrationFallback(report, {
        fromVersion: 1,
        toVersion: 2,
        path: `${path}.combat[${index}].damage`,
        message: "PalLaw 0.2.0 removed positive damage scaling; damage <= 0 became allow=false and damage > 0 became allow=true."
      });
    });
  };
  const migrateV1ToV2 = (document: JsonObject, report: MigrationReportEntry[]) => {
    document.regionalCombat = clone(DEFAULT_REGIONAL_COMBAT);
    if (isPlainObject(document.settings)) {
      delete document.settings.targetFiltering;
      delete document.settings.targetSweepSeconds;
    }
    addMigrationFallback(report, {
      fromVersion: 1,
      toVersion: 2,
      path: "$.regionalCombat.enabled",
      message: "PalLaw 0.2.0 makes regional combat authority explicit and enables it to preserve Version 1 combat behavior. Set regionalCombat.enabled=false for vanilla combat with level and action rules only."
    });
    migrateCombat(document.wilderness, "$.wilderness", report);
    if (Array.isArray(document.regions)) {
      document.regions.forEach((region, index) => {
        migrateCombat(region, `$.regions[${index}]`, report);
      });
    }
  };
  const migrateV2ToV3 = (document: JsonObject, report: MigrationReportEntry[] = []) => {
    const oldRegionChanged = {
      enabled: true,
      cooldownSeconds: 0,
      chat: { enabled: false, text: "Entered {region}." },
      alerts: defaultAlerts("{region}", "activity")
    };
    const oldPvpWarning = {
      enabled: true,
      cooldownSeconds: 0,
      chat: { enabled: false, text: "Player combat is enabled in {region}." },
      alerts: defaultAlerts("PVP ENABLED - {region}", "brief", "negative")
    };
    const globalMessages = isPlainObject(document.messages) ? document.messages : {};
    const legacyErrors: string[] = [];
    if (Object.hasOwn(globalMessages, "pvpWarning")) {
      validateRawMessage(globalMessages.pvpWarning, "messages.pvpWarning", legacyErrors);
    }
    const validateLegacyArea = (area: unknown, path: string) => {
      if (!isPlainObject(area)) return;
      if (Object.hasOwn(area, "color") && (typeof area.color !== "string" || !/^#[0-9a-f]{6}$/i.test(area.color))) {
        legacyErrors.push(`${path}.color must use #RRGGBB.`);
      }
      if (isPlainObject(area.messages) && Object.hasOwn(area.messages, "pvpWarning")) {
        validateRawMessage(area.messages.pvpWarning, `${path}.messages.pvpWarning`, legacyErrors);
      }
    };
    validateLegacyArea(document.wilderness, "wilderness");
    if (Array.isArray(document.regions)) {
      document.regions.forEach((region, index) => validateLegacyArea(region, `regions[${index}]`));
    }
    if (legacyErrors.length) throw new Error(legacyErrors.join("\n"));
    const effectiveGlobalRegion = normalizeMessage(globalMessages.regionChanged, oldRegionChanged);
    const effectiveGlobalWarning = normalizeMessage(globalMessages.pvpWarning, oldPvpWarning);
    const mergeWarning = (base: EventMessage, warning: EventMessage, path: string): EventMessage => {
      const result = clone(base);
      let migrated = false;
      const replace = <T extends { enabled: boolean }>(channelPath: string, current: T, incoming: T): T => {
        if (!warning.enabled || !incoming.enabled) return current;
        if (base.enabled && current.enabled) {
          addMigrationFallback(report, {
            fromVersion: 2,
            toVersion: 3,
            path: `${path}.${channelPath}`,
            message: "Enabled PvP warning output replaced the enabled region-change output."
          });
        }
        migrated = true;
        return clone(incoming);
      };
      result.chat = replace("chat", result.chat, warning.chat);
      for (const { id } of ALERT_PRESENTATIONS) {
      result.alerts[id] = replace<AlertMessage>(`alerts.${id}`, result.alerts[id]!, warning.alerts[id]!);
      }
      if (migrated) result.cooldownSeconds = warning.cooldownSeconds;
      return result;
    };
    const localizedNames = isPlainObject(globalMessages.modeNames) ? globalMessages.modeNames : {};
    for (const id of Object.keys(localizedNames)) {
      if (!STARTER_MODES.some((mode) => mode.id === id)) {
        throw new Error(`messages.modeNames contains an unknown field: ${id}`);
      }
    }
    document.modes = STARTER_MODES.map((starter) => {
      const localizedName = localizedNames[starter.id];
      const mode = createStarterMode({
        ...starter,
        name: typeof localizedName === "string"
          ? localizedName
          : starter.name
      });
      if (starter.id === "pvp") {
        mode.messages.regionChanged = mergeWarning(
          effectiveGlobalRegion,
          effectiveGlobalWarning,
          "$.modes[pvp].messages.regionChanged"
        );
      }
      return mode;
    });
    if (Object.hasOwn(globalMessages, "modeNames")) {
      delete globalMessages.modeNames;
      addMigrationFallback(report, {
        fromVersion: 2,
        toVersion: 3,
        path: "$.messages.modeNames",
        message: "Mode display names moved to the corresponding mode.name fields."
      });
    }
    if (Object.hasOwn(globalMessages, "pvpWarning")) {
      delete globalMessages.pvpWarning;
      addMigrationFallback(report, {
        fromVersion: 2,
        toVersion: 3,
        path: "$.messages.pvpWarning",
        message: "PvP warning outputs moved to pvp.messages.regionChanged."
      });
    }
    const migrateArea = (area: unknown, path: string) => {
      if (!isPlainObject(area)) return;
      if (!Object.hasOwn(area, "mode")) area.mode = "pve";
      const actions = area?.actions;
      for (const key of ["fastTravelDeparture", "fastTravelArrival"]) {
        if (!isPlainObject(actions) || !Object.hasOwn(actions, key)) continue;
        const current = actions[key];
        if (typeof current !== "boolean") {
          throw new Error(`${path}.actions.${key} must be true or false.`);
        }
        actions[key] = current ? "all" : "none";
      }
      if (Object.hasOwn(area, "color")) {
        delete area.color;
        addMigrationFallback(report, {
          fromVersion: 2,
          toVersion: 3,
          path: `${path}.color`,
          message: "Removed the region color; the referenced mode is now the sole color authority."
        });
      }
      const messages = isPlainObject(area.messages) ? area.messages : null;
      if (messages && area.mode === "pvp" &&
          (Object.hasOwn(messages, "regionChanged") || Object.hasOwn(messages, "pvpWarning"))) {
          const areaRegion = normalizeMessage(messages.regionChanged, effectiveGlobalRegion);
          const areaWarning = normalizeMessage(messages.pvpWarning, effectiveGlobalWarning);
          messages.regionChanged = mergeWarning(areaRegion, areaWarning, `${path}.messages.regionChanged`);
      }
      if (messages && Object.hasOwn(messages, "pvpWarning")) {
        delete messages.pvpWarning;
        addMigrationFallback(report, {
          fromVersion: 2,
          toVersion: 3,
          path: `${path}.messages.pvpWarning`,
          message: area.mode === "pvp"
            ? "PvP warning outputs merged into this area's messages.regionChanged override."
            : "Removed an unused PvP warning override from a non-PvP area."
        });
      }
    };
    migrateArea(document.wilderness, "$.wilderness");
    if (Array.isArray(document.regions)) {
      document.regions.forEach((region, index) => {
        migrateArea(region, `$.regions[${index}]`);
      });
    }
    if (!isPlainObject(document.wilderness)) return;
    const stageAreas = clone(document.wilderness) as JsonObject;
    const names = new Set<string>();
    const rememberName = (area: unknown) => {
      if (isPlainObject(area) && typeof area.name === "string") names.add(area.name.toLocaleLowerCase());
    };
    rememberName(document.wilderness);
    if (Array.isArray(document.regions)) document.regions.forEach(rememberName);
    let stageName = "Stage Areas";
    for (let suffix = 2; names.has(stageName.toLocaleLowerCase()); suffix += 1) stageName = `Stage Areas ${suffix}`;
    stageAreas.name = stageName;
    document.stageAreas = stageAreas;
    addMigrationFallback(report, {
      fromVersion: 2,
      toVersion: 3,
      path: "$.stageAreas",
      message: `Created ${stageName} from Wilderness because older configurations had no separate policy for Palworld stages.`
    });
  };
  const migrateV3ToV4 = (document: JsonObject) => {
    if (!Array.isArray(document.schedules)) document.schedules = [];
    const migrateArea = (area: unknown) => {
      if (!isPlainObject(area) || !isPlainObject(area.actions)) return;
      if (area.actions.fastTravelDeparture === "baseOnly") {
        area.actions.fastTravelDeparture = "baseToAll";
      }
    };
    if (Array.isArray(document.modes)) document.modes.forEach(migrateArea);
    migrateArea(document.wilderness);
    migrateArea(document.stageAreas);
    if (Array.isArray(document.regions)) document.regions.forEach(migrateArea);
  };
  const migrateV4ToV5 = (document: JsonObject, report: MigrationReportEntry[] = []) => {
    const materialize = (object: JsonObject, key: string, value: unknown, path: string) => {
      if (Object.hasOwn(object, key)) return;
      object[key] = clone(value);
      addMigrationFallback(report, {
        fromVersion: 4,
        toVersion: 5,
        path: `${path}.${key}`,
        message: "Materialized the frozen Configuration Version 4 effective value because Version 5 omission uses a neutral fallback."
      });
    };
    const pruneEmptyOverrideObjects = (value: JsonObject, path: string) => {
      for (const [key, entry] of Object.entries(value)) {
        if (!isPlainObject(entry)) continue;
        pruneEmptyOverrideObjects(entry, `${path}.${key}`);
        if (Object.keys(entry).length) continue;
        delete value[key];
        addMigrationFallback(report, {
          fromVersion: 4,
          toVersion: 5,
          path: `${path}.${key}`,
          message: "Removed an empty no-op override object; Version 5 expresses inheritance by omitting the override."
        });
      }
    };
    const expandCombatOverrides = (area: unknown, path: string) => {
      if (!isPlainObject(area) || !Array.isArray(area.combat)) return;
      const sparse: JsonObject = {};
      area.combat.forEach((rawEntry, index) => {
        if (isPlainObject(rawEntry) && Object.hasOwn(rawEntry, "damage")) {
          throw new Error(`${path}.combat[${index}].damage is not supported in PalLaw 0.2.0; use allow=true or allow=false.`);
        }
        if (!isPlainObject(rawEntry) || typeof rawEntry.allow !== "boolean") return;
        const sources = Array.isArray(rawEntry.source) ? rawEntry.source : [rawEntry.source];
        const targets = Array.isArray(rawEntry.target) ? rawEntry.target : [rawEntry.target];
        for (const source of sources) {
          if (typeof source !== "string" || !SOURCE_ACTOR_IDS.has(source)) continue;
          const row = isPlainObject(sparse[source]) ? sparse[source] : (sparse[source] = {} as JsonObject) as JsonObject;
          for (const target of targets) {
            if (typeof target !== "string" || !ACTOR_IDS.has(target)) continue;
            row[target] = rawEntry.allow;
            if (rawEntry.bidirectional === true && SOURCE_ACTOR_IDS.has(target) && target !== "structure" && target !== "environment") {
              const reverse = isPlainObject(sparse[target]) ? sparse[target] : (sparse[target] = {} as JsonObject) as JsonObject;
              reverse[source] = rawEntry.allow;
            }
          }
        }
      });
      if (Object.keys(sparse).length) area.combat = sparse;
      else delete area.combat;
      addMigrationFallback(report, {
        fromVersion: 4,
        toVersion: 5,
        path: `${path}.combat`,
        message: "Expanded ordered combat selector entries into the sparse source-to-target override matrix used by Version 5."
      });
    };
    const migrateArea = (area: unknown, path: string, region = false) => {
      if (!isPlainObject(area)) return;
      expandCombatOverrides(area, path);
      if (isPlainObject(area.actions)) pruneEmptyOverrideObjects(area.actions, `${path}.actions`);
      if (isPlainObject(area.actions) && !Object.keys(area.actions).length) delete area.actions;
      if (isPlainObject(area.messages)) {
        pruneEmptyOverrideObjects(area.messages, `${path}.messages`);
        if (!Object.keys(area.messages).length) delete area.messages;
      }
      if (region) {
        materialize(area, "enabled", true, path);
        materialize(area, "map", "world", path);
      }
    };

    const regionalCombat = isPlainObject(document.regionalCombat)
      ? document.regionalCombat
      : (document.regionalCombat = {} as JsonObject) as JsonObject;
    materialize(regionalCombat, "enabled", DEFAULT_REGIONAL_COMBAT.enabled, "$.regionalCombat");
    const settings = isPlainObject(document.settings)
      ? document.settings
      : (document.settings = {} as JsonObject) as JsonObject;
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) materialize(settings, key, value, "$.settings");
    document.messages = clone(normalizeMessages(document.messages, LEGACY_DEFAULT_MESSAGES, true)) as unknown as JsonObject;
    addMigrationFallback(report, {
      fromVersion: 4,
      toVersion: 5,
      path: "$.messages",
      message: "Materialized the complete frozen Version 4 global message definitions because Version 5 omitted messages are disabled and empty."
    });
    if (Array.isArray(document.schedules)) {
      document.schedules.forEach((schedule, scheduleIndex) => {
        if (!isPlainObject(schedule)) return;
        materialize(schedule, "enabled", true, `$.schedules[${scheduleIndex}]`);
        if (Array.isArray(schedule.announcements)) schedule.announcements.forEach((announcement, announcementIndex) => {
          if (isPlainObject(announcement)) materialize(announcement, "enabled", true, `$.schedules[${scheduleIndex}].announcements[${announcementIndex}]`);
        });
      });
    }
    if (Array.isArray(document.modes)) document.modes.forEach((mode, index) => {
      if (isPlainObject(mode) && isPlainObject(mode.messages)) {
        pruneEmptyOverrideObjects(mode.messages, `$.modes[${index}].messages`);
        if (!Object.keys(mode.messages).length) delete mode.messages;
      }
    });
    migrateArea(document.wilderness, "$.wilderness");
    migrateArea(document.stageAreas, "$.stageAreas");
    if (Array.isArray(document.regions)) document.regions.forEach((region, index) => migrateArea(region, `$.regions[${index}]`, true));
  };
  const migrateV5ToV6 = (document: JsonObject, report: MigrationReportEntry[]) => {
    const materializeModeAction = (actions: JsonObject, key: string, path: string) => {
      if (Object.hasOwn(actions, key)) return;
      actions[key] = true;
      addMigrationFallback(report, {
        fromVersion: 5,
        toVersion: 6,
        path: `${path}.${key}`,
        message: "Configuration Version 5 had no cross-area Fast Travel endpoint permission; defaulted to allow."
      });
    };
    if (Array.isArray(document.modes)) {
      document.modes.forEach((mode, index) => {
        if (!isPlainObject(mode) || !isPlainObject(mode.actions)) return;
        const path = `$.modes[${index}].actions`;
        materializeModeAction(mode.actions, "fastTravelCrossRegionsDeparture", path);
        materializeModeAction(mode.actions, "fastTravelCrossRegionsArrival", path);
      });
    }
    const messages = isPlainObject(document.messages) ? document.messages : null;
    const actionNames = messages && isPlainObject(messages.actionNames) ? messages.actionNames : null;
    if (!actionNames) return;
    const materializeActionName = (key: string, value: string) => {
      if (Object.hasOwn(actionNames, key)) return;
      actionNames[key] = value;
      addMigrationFallback(report, {
        fromVersion: 5,
        toVersion: 6,
        path: `$.messages.actionNames.${key}`,
        message: "Added the default cross-area Fast Travel endpoint display name for Configuration Version 6."
      });
    };
    materializeActionName("fastTravelCrossRegionsDeparture", "Fast Travel Cross Regions Departure");
    materializeActionName("fastTravelCrossRegionsArrival", "Fast Travel Cross Regions Arrival");
  };
  const migrateV6ToV7 = (document: JsonObject, report: MigrationReportEntry[]) => {
    const renameAction = (actions: JsonObject, path: string, oldKey: string, newKey: string, message: string) => {
      if (Object.hasOwn(actions, oldKey) && !Object.hasOwn(actions, newKey)) {
        actions[newKey] = actions[oldKey];
        delete actions[oldKey];
        addMigrationFallback(report, {
          fromVersion: 6,
          toVersion: 7,
          path: `${path}.${newKey}`,
          message
        });
      } else if (Object.hasOwn(actions, oldKey) && Object.hasOwn(actions, newKey)) {
        delete actions[oldKey];
      }
    };
    const materializeSwimmingMount = (actions: JsonObject, path: string) => {
      renameAction(actions, path, "ride", "groundMount", "Renamed mount key ride to groundMount for Version 7 ground mounts.");
      renameAction(actions, path, "fly", "flyingMount", "Renamed mount key fly to flyingMount for Version 7 flying mounts.");
      renameAction(actions, path, "swim", "swimmingMount", "Renamed mount key swim to swimmingMount for Version 7 swimming mounts.");
      if (!Object.hasOwn(actions, "swimmingMount")) {
        const rideValue = typeof actions["groundMount"] === "boolean" ? actions["groundMount"] : (typeof actions["ride"] === "boolean" ? actions["ride"] : true);
        actions["swimmingMount"] = rideValue;
        addMigrationFallback(report, {
          fromVersion: 6,
          toVersion: 7,
          path: `${path}.swimmingMount`,
          message: "Version 6 had no swimming mount use; defaulted swimmingMount to the previous ride value. Set swimmingMount explicitly to deny swimming mounts."
        });
      }
    };
    if (Array.isArray(document.modes)) {
      document.modes.forEach((mode, index) => {
        if (!isPlainObject(mode) || !isPlainObject(mode.actions)) return;
        const path = `$.modes[${index}].actions`;
        materializeSwimmingMount(mode.actions, path);
      });
    }
    const messages = isPlainObject(document.messages) ? document.messages : null;
    const actionNames = messages && isPlainObject(messages.actionNames) ? messages.actionNames : null;
    if (actionNames) {
      const renameName = (oldKey: string, newKey: string, display: string) => {
        if (Object.hasOwn(actionNames, oldKey) && !Object.hasOwn(actionNames, newKey)) {
          actionNames[newKey] = actionNames[oldKey];
          delete actionNames[oldKey];
          addMigrationFallback(report, {
            fromVersion: 6,
            toVersion: 7,
            path: `$.messages.actionNames.${newKey}`,
            message: `Renamed action display name ${oldKey} to ${newKey}.`
          });
        } else if (Object.hasOwn(actionNames, oldKey) && Object.hasOwn(actionNames, newKey)) {
          delete actionNames[oldKey];
        }
        if (!Object.hasOwn(actionNames, newKey)) {
          actionNames[newKey] = display;
          addMigrationFallback(report, {
            fromVersion: 6,
            toVersion: 7,
            path: `$.messages.actionNames.${newKey}`,
            message: `Added the default ${display} display name for Configuration Version 7.`
          });
        }
      };
      renameName("ride", "groundMount", "Ground mount use");
      renameName("fly", "flyingMount", "Flying mount use");
      if (Object.hasOwn(actionNames, "swim") && !Object.hasOwn(actionNames, "swimmingMount")) {
        actionNames["swimmingMount"] = actionNames["swim"];
        delete actionNames["swim"];
        addMigrationFallback(report, {
          fromVersion: 6,
          toVersion: 7,
          path: "$.messages.actionNames.swimmingMount",
          message: "Renamed action display name swim to swimmingMount."
        });
      }
      if (!Object.hasOwn(actionNames, "swimmingMount")) {
        actionNames["swimmingMount"] = "Swimming mount use";
        addMigrationFallback(report, {
          fromVersion: 6,
          toVersion: 7,
          path: "$.messages.actionNames.swimmingMount",
          message: "Added the default swimming mount display name for Configuration Version 7."
        });
      }
      if (actionNames["groundMount"] === "Non-flying riding") {
        actionNames["groundMount"] = "Ground mount use";
        addMigrationFallback(report, {
          fromVersion: 6,
          toVersion: 7,
          path: "$.messages.actionNames.groundMount",
          message: "Updated ground mount display name from Non-flying riding to Ground mount use."
        });
      }
    }
  };

  return [
    {
      version: 1,
      validate(document) {
        validateVersion1MessageText(document);
        validateLegacyActionNames(document);
        validateLegacyMessageShape(document);
        if (Object.hasOwn(document, "damage")) {
          throw new Error("Configuration Version 1 does not allow the damage object.");
        }
        const candidate = clone(document);
        migrateV1ToV2(candidate, []);
        migrateV2ToV3(candidate);
        migrateV3ToV4(candidate);
        migrateV4ToV5(candidate);
        migrateV5ToV6(candidate, []);
        migrateV6ToV7(candidate, []);
        candidate.version = 7;
        const validation = validateConfig(candidate);
        if (!validation.valid) throw new Error(validation.errors.join("\n"));
      },
      migrateToNext: migrateV1ToV2
    },
    {
      version: 2,
      validate(document) {
        validateLegacyActionNames(document);
        validateLegacyMessageShape(document);
        const candidate = clone(document);
        migrateV2ToV3(candidate);
        migrateV3ToV4(candidate);
        migrateV4ToV5(candidate);
        migrateV5ToV6(candidate, []);
        migrateV6ToV7(candidate, []);
        candidate.version = 7;
        const validation = validateConfig(candidate);
        if (!validation.valid) throw new Error(validation.errors.join("\n"));
      },
      migrateToNext: migrateV2ToV3
    },
    {
      version: 3,
      validate(document) {
        validateLegacyActionNames(document);
        const candidate = clone(document);
        migrateV3ToV4(candidate);
        migrateV4ToV5(candidate);
        migrateV5ToV6(candidate, []);
        migrateV6ToV7(candidate, []);
        candidate.version = 7;
        const validation = validateConfig(candidate);
        if (!validation.valid) throw new Error(validation.errors.join("\n"));
      },
      migrateToNext: migrateV3ToV4
    },
    {
      version: 4,
      validate(document) {
        validateLegacyActionNames(document);
        const candidate = clone(document);
        migrateV4ToV5(candidate);
        migrateV5ToV6(candidate, []);
        migrateV6ToV7(candidate, []);
        candidate.version = 7;
        const validation = validateConfig(candidate);
        if (!validation.valid) throw new Error(validation.errors.join("\n"));
      },
      migrateToNext: migrateV4ToV5
    },
    {
      version: 5,
      validate(document) {
        const candidate = clone(document) as unknown as JsonObject;
        migrateV5ToV6(candidate, []);
        migrateV6ToV7(candidate, []);
        candidate.version = 7;
        const validation = validateConfig(candidate);
        if (!validation.valid) throw new Error(validation.errors.join("\n"));
      },
      migrateToNext(document, report) {
        migrateV5ToV6(document, report);
      }
    },
    {
      version: 6,
      validate(document) {
        const candidate = clone(document) as unknown as JsonObject;
        migrateV6ToV7(candidate, []);
        candidate.version = 7;
        const validation = validateConfig(candidate);
        if (!validation.valid) throw new Error(validation.errors.join("\n"));
      },
      migrateToNext(document, report) {
        migrateV6ToV7(document, report);
      }
    },
    {
      version: 7,
      validate(document) {
        const validation = validateConfig(document);
        if (!validation.valid) throw new Error(validation.errors.join("\n"));
      }
    }
  ];
}

export function migrateConfig(input: unknown) {
  const registry = currentMigrationRegistry();
  if (registry.length !== CONFIG_VERSION) {
    throw new Error(
      `Configuration migration registry ends at version ${registry.length}, but the model declares version ${CONFIG_VERSION}.`
    );
  }
  return migrateConfiguration(input, registry);
}

function parseConfigWithMigration(source: ConfigSource) {
  const migration = migrateConfig(parseConfigSource(source));
  const validation = validateConfig(migration.document);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  return {
    config: validation.config,
    migration
  };
}

export function parseConfigTextWithMigration(textValue: string) {
  return parseConfigWithMigration(textValue);
}

export function parseConfigBytesWithMigration(bytes: ArrayBuffer | ArrayBufferView) {
  return parseConfigWithMigration(bytes);
}

export function parseConfigText(textValue: string): PalLawConfigValue {
  return parseConfigTextWithMigration(textValue).config;
}

export function parseConfigBytes(bytes: ArrayBuffer | ArrayBufferView): PalLawConfigValue {
  return parseConfigBytesWithMigration(bytes).config;
}

export function formatTemplate(template: unknown, values: Readonly<Record<string, unknown>> = {}): string {
  let result = String(template ?? "");
  for (const placeholder of ["region", "previousRegion", "mode", "action", "minimumLevel", "playerLevel"]) {
    result = result.replaceAll(`{${placeholder}}`, values[placeholder] == null ? "" : String(values[placeholder]));
  }
  return result;
}

export function hasVisibleMessageText(value: unknown): boolean {
  return typeof value === "string" && /[^ \t\r\n]/u.test(value);
}
