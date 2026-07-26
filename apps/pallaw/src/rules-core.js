export const CONFIG_VERSION = 3;
export const CONFIG_FILE_NAME = "PalLaw.json";
export const SCHEMA_FILE_NAME = "PalLaw.schema.json";

import {
  CONFIG_LIMITS,
  createBoundedErrorSink,
  parseConfigSource,
  validateRawConfigurationLimits
} from "./config-source.js?v=7";
import {
  addMigrationFallback,
  migrateConfiguration
} from "./configuration-migrations.js?v=7";

export { CONFIG_LIMITS, ConfigSourceError, parseConfigSource } from "./config-source.js?v=7";

export {
  MAPS,
  inGameMapToWorld,
  mapFractionToWorld,
  worldToInGameMap,
  worldToMapFraction
} from "./map-coordinates.js?v=7";

export const ACTORS = [
  { id: "player", label: "Player", description: "A player character." },
  { id: "partnerPal", label: "Partner Pal", description: "A Pal currently partnered with and controlled by a player." },
  { id: "basePal", label: "Base Pal", description: "A Pal assigned to a base camp." },
  {
    id: "baseStructure",
    label: "Base Structure",
    description: "Structures attributed to a base camp or guild, including defensive structures when Palworld reports the structure as the responsible damage source.",
    mapObject: true
  },
  { id: "wildPal", label: "Wild Pal", description: "A wild Pal not owned by a player or base." },
  { id: "npc", label: "NPC", description: "A non-player human character." },
  {
    id: "structure",
    label: "Player-Built Structure",
    matrixLabel: "Structure",
    description: "Objects attributed to a player outside of a base camp.",
    mapObject: true,
    targetOnly: true
  },
  {
    id: "environment",
    label: "Environmental Map Object",
    matrixLabel: "Environment",
    description: "Natural mineral resource nodes, including stone and ore. Trees and other foliage are excluded.",
    mapObject: true,
    targetOnly: true
  }
];

export const ACTIONS = [
  { id: "build", label: "Build", description: "Place structures and build objects." },
  { id: "dismantle", label: "Dismantle", description: "Dismantle structures and map objects." },
  { id: "ride", label: "Non-flying mounts", description: "Begin or remain mounted on a non-flying Pal." },
  { id: "fly", label: "Flying mounts", description: "Begin or remain mounted on a flying Pal." },
  { id: "editSign", label: "Edit signs", description: "Change sign text." },
  { id: "editLock", label: "Edit locks", description: "Change passwords and private chest locks." },
  { id: "decay", label: "Building decay", description: "Apply normal structure deterioration." },
  {
    id: "fastTravelDeparture",
    label: "Fast travel departure",
    description: "Choose whether trips started inside this area may use every destination, base camps only, or no destination.",
    fastTravelPolicy: true
  },
  {
    id: "fastTravelArrival",
    label: "Fast travel arrival",
    description: "Choose whether arrivals inside this area may use every destination, base camps only, or no destination.",
    fastTravelPolicy: true
  }
];

export const FAST_TRAVEL_POLICIES = Object.freeze([
  { id: "all", label: "All" },
  { id: "baseOnly", label: "Bases only" },
  { id: "none", label: "Disabled" }
]);

const FAST_TRAVEL_POLICY_IDS = new Set(
  FAST_TRAVEL_POLICIES.map(({ id }) => id)
);

export const DEFAULT_ACTION_NAMES = Object.freeze({
  build: "Building",
  dismantle: "Dismantling",
  ride: "Non-flying riding",
  fly: "Flying mount use",
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

function defaultAlerts(text, enabledPresentation, briefTone = "normal") {
  return Object.fromEntries(ALERT_PRESENTATIONS.map(({ id }) => [
    id,
    {
      enabled: id === enabledPresentation,
      text,
      ...(id === "brief" ? { tone: briefTone } : {})
    }
  ]));
}

export const DEFAULT_MESSAGES = Object.freeze({
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

const ACTOR_IDS = new Set(ACTORS.map((entry) => entry.id));
const SOURCE_ACTOR_IDS = new Set(ACTORS.filter((entry) => !entry.targetOnly).map((entry) => entry.id));
const ACTION_IDS = new Set(ACTIONS.map((entry) => entry.id));
const MESSAGE_IDS = new Set(MESSAGE_EVENTS.map((entry) => entry.id));
const ALERT_PRESENTATION_IDS = new Set(ALERT_PRESENTATIONS.map((entry) => entry.id));
const ALERT_TONE_IDS = new Set(ALERT_TONES.map((entry) => entry.id));
const EPSILON = 1e-6;

export function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function modeDefinition(mode, configOrModes) {
  const modes = Array.isArray(configOrModes)
    ? configOrModes
    : configOrModes?.modes || STARTER_MODES;
  return modes.find((entry) => entry.id === mode) || modes[0];
}

function createStarterMode({ id, name, color }) {
  return {
    id,
    name,
    color,
    minimumLevel: null,
    actions: modeActions(id),
    combat: modeCombat(id),
    messages: {}
  };
}

export function createDefaultConfig() {
  return {
    $schema: `./${SCHEMA_FILE_NAME}`,
    version: CONFIG_VERSION,
    regionalCombat: clone(DEFAULT_REGIONAL_COMBAT),
    settings: clone(DEFAULT_SETTINGS),
    messages: clone(DEFAULT_MESSAGES),
    modes: STARTER_MODES.map(createStarterMode),
    wilderness: {
      name: "Wilderness",
      mode: "pve",
      actions: {},
      combat: [],
      messages: {}
    },
    regions: []
  };
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function text(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeChat(value, base) {
  const result = clone(base);
  if (typeof value === "boolean") {
    result.enabled = value;
  } else if (typeof value === "string") {
    result.enabled = true;
    result.text = value;
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    result.enabled = boolean(value.enabled, result.enabled);
    result.text = text(value.text, result.text);
  }
  return result;
}

function normalizeAlert(value, base, presentation) {
  const result = clone(base);
  if (typeof value === "boolean") {
    result.enabled = value;
  } else if (typeof value === "string") {
    result.enabled = true;
    result.text = value;
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    result.enabled = boolean(value.enabled, result.enabled);
    result.text = text(value.text, result.text);
    if (presentation === "brief") {
      result.tone = ALERT_TONE_IDS.has(value.tone) ? value.tone : result.tone;
    }
  }
  return result;
}

function normalizeAlerts(value, base) {
  const result = clone(base);
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const { id } of ALERT_PRESENTATIONS) {
    if (Object.hasOwn(value, id)) result[id] = normalizeAlert(value[id], result[id], id);
  }
  return result;
}

export function normalizeMessage(value, base) {
  const result = clone(base);
  if (typeof value === "boolean") {
    result.enabled = value;
    return result;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return result;
  }
  result.enabled = boolean(value.enabled, result.enabled);
  result.cooldownSeconds = finite(value.cooldownSeconds, result.cooldownSeconds);
  result.chat = normalizeChat(value.chat, result.chat);
  result.alerts = normalizeAlerts(value.alerts, result.alerts);
  return result;
}

export function enabledMessageOutputCount(message) {
  return Number(Boolean(message?.chat?.enabled)) + ALERT_PRESENTATIONS.reduce(
    (count, { id }) => count + Number(Boolean(message?.alerts?.[id]?.enabled)),
    0
  );
}

export function normalizeMessages(value, base = DEFAULT_MESSAGES, includeGlobalControls = true) {
  const result = clone(base);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return result;
  }
  if (includeGlobalControls) {
    result.enabled = boolean(value.enabled, result.enabled);
    result.actionNames = normalizeDisplayNames(value.actionNames, DEFAULT_ACTION_NAMES);
  }
  for (const event of MESSAGE_EVENTS) {
    if (Object.hasOwn(value, event.id)) {
      result[event.id] = normalizeMessage(value[event.id], result[event.id]);
    }
  }
  return result;
}

function normalizeDisplayNames(value, defaults) {
  const result = { ...defaults };
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const key of Object.keys(defaults)) {
    if (typeof value[key] === "string") result[key] = value[key];
  }
  return result;
}

function normalizeActions(value) {
  const result = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const action of ACTIONS) {
    if (action.fastTravelPolicy) {
      if (FAST_TRAVEL_POLICY_IDS.has(value[action.id])) {
        result[action.id] = value[action.id];
      }
    } else if (typeof value[action.id] === "boolean") {
      result[action.id] = value[action.id];
    }
  }
  return result;
}

function normalizeSelection(value) {
  const entries = Array.isArray(value) ? value : [value];
  return [...new Set(entries.filter((entry) => typeof entry === "string"))];
}

function normalizeCombat(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const result = {
      source: normalizeSelection(entry?.source),
      target: normalizeSelection(entry?.target),
      bidirectional: boolean(entry?.bidirectional, false)
    };
    if (typeof entry?.allow === "boolean") result.allow = entry.allow;
    return result;
  });
}

function normalizeArea(value, fallbackName = "Region") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const mode = text(source.mode, "pve");
  return {
    name: text(source.name, fallbackName),
    mode,
    actions: normalizeActions(source.actions),
    combat: normalizeCombat(source.combat),
    messages: source.messages && typeof source.messages === "object" && !Array.isArray(source.messages)
      ? clone(source.messages)
      : {}
  };
}

function normalizePoint(point) {
  return Array.isArray(point) && point.length >= 2
    ? [finite(point[0], 0), finite(point[1], 0)]
    : [0, 0];
}

function normalizeRegion(value, index) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const area = normalizeArea(source, `Region ${index + 1}`);
  return {
    ...area,
    enabled: boolean(source.enabled, true),
    minimumLevel: source.minimumLevel !== null && source.minimumLevel !== undefined && source.minimumLevel !== "" && Number.isInteger(Number(source.minimumLevel))
      ? Number(source.minimumLevel)
      : null,
    map: text(source.map, "world"),
    polygon: normalizePolygon(source.polygon)
  };
}

function normalizeDenseActions(value) {
  return Object.fromEntries(ACTIONS.map((action) => [
    action.id,
    action.fastTravelPolicy
      ? (FAST_TRAVEL_POLICY_IDS.has(value?.[action.id]) ? value[action.id] : "all")
      : boolean(value?.[action.id], true)
  ]));
}

function normalizeDenseCombat(value) {
  return Object.fromEntries(ACTORS.filter((actor) => !actor.targetOnly).map((source) => [
    source.id,
    Object.fromEntries(ACTORS.map((target) => [
      target.id,
      boolean(value?.[source.id]?.[target.id], false)
    ]))
  ]));
}

function normalizeMode(value, index) {
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
    messages: isPlainObject(source.messages) ? clone(source.messages) : {}
  };
}

function normalizePolygon(value) {
  if (!Array.isArray(value)) return [];
  const points = value.map(normalizePoint);
  if (points.length > 1 && samePoint(points[0], points.at(-1))) points.pop();
  return points;
}

export function hydrateConfig(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const config = createDefaultConfig();
  config.$schema = text(source.$schema, config.$schema);
  config.version = Number(source.version ?? CONFIG_VERSION);
  const regionalCombat = source.regionalCombat &&
      typeof source.regionalCombat === "object" &&
      !Array.isArray(source.regionalCombat)
    ? source.regionalCombat
    : {};
  config.regionalCombat = {
    enabled: boolean(
      regionalCombat.enabled,
      DEFAULT_REGIONAL_COMBAT.enabled
    )
  };
  config.settings = { ...config.settings, ...(source.settings || {}) };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    config.settings[key] = typeof DEFAULT_SETTINGS[key] === "boolean"
      ? boolean(config.settings[key], DEFAULT_SETTINGS[key])
      : finite(config.settings[key], DEFAULT_SETTINGS[key]);
  }
  config.messages = normalizeMessages(source.messages, DEFAULT_MESSAGES, true);
  config.modes = Array.isArray(source.modes) ? source.modes.map(normalizeMode) : [];
  config.wilderness = normalizeArea(source.wilderness, "Wilderness");
  config.regions = Array.isArray(source.regions)
    ? source.regions.map(normalizeRegion)
    : [];
  const attachMode = (area) => Object.defineProperty(area, "_modeDefinition", {
    value: modeDefinition(area.mode, config),
    configurable: true,
    writable: true
  });
  attachMode(config.wilderness);
  config.regions.forEach(attachMode);
  return config;
}

export function modeActions() {
  return Object.fromEntries(
    ACTIONS.map((action) => [action.id, action.fastTravelPolicy ? "all" : true])
  );
}

export function effectiveActions(area) {
  return { ...(area?._modeDefinition?.actions || modeActions(area?.mode)), ...(area?.actions || {}) };
}

export function effectiveMinimumLevel(area, config) {
  return area?.minimumLevel ?? area?._modeDefinition?.minimumLevel ?? modeDefinition(area?.mode, config)?.minimumLevel ?? null;
}

export function modeCombat(mode) {
  const matrix = Object.fromEntries(
    ACTORS.filter((actor) => !actor.targetOnly).map((source) => [
      source.id,
      Object.fromEntries(ACTORS.map((target) => [target.id, true]))
    ])
  );
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

function resolveCombat(area) {
  const preset = area?._modeDefinition?.combat || modeCombat(area?.mode || "pve");
  const matrix = Object.fromEntries(
    Object.entries(preset).map(([source, targets]) => [source, { ...targets }])
  );
  const overridden = Object.fromEntries(
    Object.entries(preset).map(([source, targets]) => [
      source,
      Object.fromEntries(Object.keys(targets).map((target) => [target, false]))
    ])
  );
  for (const entry of area?.combat || []) {
    const sources = normalizeSelection(entry.source);
    const targets = normalizeSelection(entry.target);
    const allowed = entry.allow === true;
    for (const source of sources) {
      if (!matrix[source]) continue;
      for (const target of targets) {
        if (!Object.hasOwn(matrix[source], target)) continue;
        matrix[source][target] = allowed;
        overridden[source][target] = true;
        if (entry.bidirectional && matrix[target] && Object.hasOwn(matrix[target], source)) {
          matrix[target][source] = allowed;
          overridden[target][source] = true;
        }
      }
    }
  }
  return { preset, matrix, overridden };
}

export function effectiveCombat(area) {
  return resolveCombat(area).matrix;
}

export function quickCombatOverride(area, source, target) {
  const resolution = resolveCombat(area);
  if (!resolution.matrix[source] || !Object.hasOwn(resolution.matrix[source], target)) return "default";
  if (!resolution.overridden[source][target]) return "default";
  return resolution.matrix[source][target] ? "allow" : "deny";
}

export function setQuickCombatOverride(area, source, target, value) {
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

  area.combat = ACTORS.filter((actor) => !actor.targetOnly).flatMap((sourceActor) =>
    ACTORS.flatMap((targetActor) => resolution.overridden[sourceActor.id][targetActor.id]
      ? [{
          source: [sourceActor.id],
          target: [targetActor.id],
          allow: resolution.matrix[sourceActor.id][targetActor.id],
          bidirectional: false
        }]
      : [])
  );
}

export function deriveFeatureSummary(input) {
  const config = hydrateConfig(input);
  const areas = [config.wilderness, ...config.regions.filter((region) => region.enabled !== false)];
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
        enablesRegionalPlayerDamage ||= owned.has(source) && owned.has(target) && allowed;
      }
    }
    const actions = effectiveActions(area);
    needsWorldActionAuthorization ||= ["build", "dismantle", "editSign", "editLock"].some((action) => actions[action] === false);
    const minimumLevel = effectiveMinimumLevel(area, config);
    needsPlayerActionEnforcement ||= minimumLevel != null ||
      ["ride", "fly"].some((action) => actions[action] === false);
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

export function resolveAreaMessages(config, area) {
  const global = normalizeMessages(config?.messages, DEFAULT_MESSAGES, true);
  const withMode = normalizeMessages(modeDefinition(area?.mode, config)?.messages, global, false);
  return normalizeMessages(area?.messages, withMode, false);
}

export function samePoint(a, b) {
  return Math.abs(Number(a?.[0]) - Number(b?.[0])) <= EPSILON &&
    Math.abs(Number(a?.[1]) - Number(b?.[1])) <= EPSILON;
}

function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a, b, point) {
  return Math.abs(cross(a, b, point)) <= EPSILON &&
    point[0] >= Math.min(a[0], b[0]) - EPSILON &&
    point[0] <= Math.max(a[0], b[0]) + EPSILON &&
    point[1] >= Math.min(a[1], b[1]) - EPSILON &&
    point[1] <= Math.max(a[1], b[1]) + EPSILON;
}

function segmentsIntersect(a, b, c, d) {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  const proper = ((abC > EPSILON && abD < -EPSILON) || (abC < -EPSILON && abD > EPSILON)) &&
    ((cdA > EPSILON && cdB < -EPSILON) || (cdA < -EPSILON && cdB > EPSILON));
  return proper || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

export function polygonSelfIntersects(polygon) {
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

export function polygonArea(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return 0;
  let twiceArea = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    twiceArea += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(twiceArea) / 2;
}

export function pointInPolygon(polygon, point) {
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

export function areaAt(config, point) {
  let result = { ...config.wilderness, isWilderness: true, index: -1 };
  config.regions.forEach((region, index) => {
    if (region.enabled !== false && pointInPolygon(region.polygon, point)) {
      result = { ...region, isWilderness: false, index };
    }
  });
  return { ...result, minimumLevel: effectiveMinimumLevel(result, config) };
}

export function evaluateCombat(config, sourceKind, targetKind, targetPoint) {
  const targetArea = areaAt(config, targetPoint);
  const targetMatrix = effectiveCombat(targetArea);
  const allowed = targetMatrix[sourceKind]?.[targetKind] ?? false;
  return {
    allowed,
    targetArea
  };
}

function validateMessage(message, context, errors) {
  if (!message || typeof message !== "object") return;
  if (!Number.isFinite(Number(message.cooldownSeconds)) || message.cooldownSeconds < 0 || message.cooldownSeconds > 300) {
    errors.push(`${context}.cooldownSeconds must be between 0 and 300.`);
  }
  if (message.chat?.enabled && (!message.chat.text || message.chat.text.length > 512)) {
    errors.push(`${context}.chat.text must contain 1 to 512 characters when chat is enabled.`);
  }
  for (const { id } of ALERT_PRESENTATIONS) {
    const alert = message.alerts?.[id];
    if (id === "brief" && alert && !ALERT_TONE_IDS.has(alert.tone)) {
      errors.push(`${context}.alerts.brief.tone must be normal or negative.`);
    }
    if (id === "activity" && Object.hasOwn(alert || {}, "tone")) {
      errors.push(`${context}.alerts.activity.tone is not supported.`);
    }
    if (alert?.enabled && (!alert.text || alert.text.length > 256)) {
      errors.push(`${context}.alerts.${id}.text must contain 1 to 256 characters when the alert is enabled.`);
    }
  }
}

function validateCombat(entries, context, errors) {
  if (!Array.isArray(entries)) {
    errors.push(`${context} must be an array.`);
    return;
  }
  entries.forEach((entry, index) => {
    const prefix = `${context}[${index}]`;
    const sources = normalizeSelection(entry?.source);
    const targets = normalizeSelection(entry?.target);
    if (!sources.length || sources.some((actor) => !SOURCE_ACTOR_IDS.has(actor))) errors.push(`${prefix}.source contains an unknown source actor.`);
    if (!targets.length || targets.some((actor) => !ACTOR_IDS.has(actor))) errors.push(`${prefix}.target contains an unknown target actor.`);
    if (typeof entry?.allow !== "boolean") {
      errors.push(`${prefix}.allow must be true or false.`);
    }
  });
}

function boundingBox(polygon) {
  return polygon.reduce((box, [x, y]) => ({
    minX: Math.min(box.minX, x), maxX: Math.max(box.maxX, x),
    minY: Math.min(box.minY, y), maxY: Math.max(box.maxY, y)
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

function boxesOverlap(a, b) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rejectUnknownKeys(value, allowed, context, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${context} must be an object.`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${context}.${key} is not supported.`);
  }
  return true;
}

function validateRawChannel(value, context, errors, allowTone = false) {
  if (typeof value === "boolean" || typeof value === "string") return;
  if (!rejectUnknownKeys(value, new Set(allowTone ? ["enabled", "text", "tone"] : ["enabled", "text"]), context, errors)) return;
  if (allowTone && Object.hasOwn(value, "tone") && !ALERT_TONE_IDS.has(value.tone)) {
    errors.push(`${context}.tone must be normal or negative.`);
  }
}

function validateRawAlerts(value, context, errors) {
  if (!rejectUnknownKeys(value, ALERT_PRESENTATION_IDS, context, errors)) return;
  for (const { id } of ALERT_PRESENTATIONS) {
    if (Object.hasOwn(value, id)) validateRawChannel(value[id], `${context}.${id}`, errors, id === "brief");
  }
}

function validateRawMessage(value, context, errors) {
  if (typeof value === "boolean") return;
  if (!rejectUnknownKeys(value, new Set(["enabled", "cooldownSeconds", "chat", "alerts"]), context, errors)) return;
  if (Object.hasOwn(value, "chat")) validateRawChannel(value.chat, `${context}.chat`, errors);
  if (Object.hasOwn(value, "alerts")) validateRawAlerts(value.alerts, `${context}.alerts`, errors);
}

function validateRawMessages(value, context, global, errors) {
  const allowed = new Set(MESSAGE_EVENTS.map((event) => event.id));
  if (global) {
    allowed.add("enabled");
    allowed.add("actionNames");
  }
  if (!rejectUnknownKeys(value, allowed, context, errors)) return;
  if (global && Object.hasOwn(value, "actionNames")) {
    validateRawDisplayNames(value.actionNames, DEFAULT_ACTION_NAMES, `${context}.actionNames`, errors);
  }
  for (const event of MESSAGE_EVENTS) {
    if (Object.hasOwn(value, event.id)) validateRawMessage(value[event.id], `${context}.${event.id}`, errors);
  }
}

function validateRawDisplayNames(value, defaults, context, errors) {
  if (!rejectUnknownKeys(value, new Set(Object.keys(defaults)), context, errors)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      errors.push(`${context}.${key} must be a string.`);
      continue;
    }
    const length = [...entry].length;
    if (length < 1 || length > 96) {
      errors.push(`${context}.${key} must contain between 1 and 96 characters.`);
    }
  }
}

function validateRawActions(value, context, errors) {
  const allowed = new Set(ACTIONS.map((action) => action.id));
  if (!rejectUnknownKeys(value, allowed, context, errors)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (key === "fastTravelDeparture" || key === "fastTravelArrival") {
      if (!FAST_TRAVEL_POLICY_IDS.has(entry)) {
        errors.push(`${context}.${key} must be all, baseOnly, or none.`);
      }
    } else if (typeof entry !== "boolean") {
      errors.push(`${context}.${key} must be true or false.`);
    }
  }
}

function validateRawCombat(value, context, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${context} must be an array.`);
    return;
  }
  value.forEach((entry, index) => {
    const prefix = `${context}[${index}]`;
    if (!rejectUnknownKeys(entry, new Set(["source", "target", "allow", "damage", "bidirectional"]), prefix, errors)) return;
    if (!Object.hasOwn(entry, "source")) errors.push(`${prefix}.source is required.`);
    if (!Object.hasOwn(entry, "target")) errors.push(`${prefix}.target is required.`);
    if (Object.hasOwn(entry, "damage")) {
      errors.push(`${prefix}.damage is not supported in PalLaw 0.2.0; use allow=true or allow=false.`);
    }
    if (!Object.hasOwn(entry, "allow")) {
      errors.push(`${prefix}.allow is required.`);
    } else if (typeof entry.allow !== "boolean") {
      errors.push(`${prefix}.allow must be true or false.`);
    }
  });
}

function validateRawArea(value, context, region, errors) {
  const allowed = new Set(["name", "mode", "actions", "combat", "messages"]);
  if (region) {
    for (const key of ["enabled", "minimumLevel", "map", "polygon"]) allowed.add(key);
  }
  if (!rejectUnknownKeys(value, allowed, context, errors)) return;
  if (!Object.hasOwn(value, "name")) errors.push(`${context}.name is required.`);
  if (!Object.hasOwn(value, "mode")) errors.push(`${context}.mode is required.`);
  if (Object.hasOwn(value, "actions")) validateRawActions(value.actions, `${context}.actions`, errors);
  if (Object.hasOwn(value, "combat")) validateRawCombat(value.combat, `${context}.combat`, errors);
  if (Object.hasOwn(value, "messages")) validateRawMessages(value.messages, `${context}.messages`, false, errors);
  if (region && !Object.hasOwn(value, "polygon")) errors.push(`${context}.polygon is required.`);
}

function validateRawMode(value, index, errors) {
  const context = `modes[${index}]`;
  if (!rejectUnknownKeys(value, new Set(["id", "name", "color", "minimumLevel", "actions", "combat", "messages"]), context, errors)) return;
  for (const key of ["id", "name", "color", "minimumLevel", "actions", "combat"]) {
    if (!Object.hasOwn(value, key)) errors.push(`${context}.${key} is required.`);
  }
  if (Object.hasOwn(value, "minimumLevel") &&
      value.minimumLevel !== null &&
      (!Number.isInteger(value.minimumLevel) || value.minimumLevel < 1 || value.minimumLevel > 999)) {
    errors.push(`${context}.minimumLevel must be null or an integer between 1 and 999.`);
  }
  if (Object.hasOwn(value, "actions")) {
    validateRawActions(value.actions, `${context}.actions`, errors);
    for (const action of ACTIONS) {
      if (!Object.hasOwn(value.actions, action.id)) errors.push(`${context}.actions.${action.id} is required.`);
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

function validateRawRegionalCombat(value, errors) {
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

function validateRawConfig(input, errors) {
  if (!rejectUnknownKeys(input, new Set(["$schema", "version", "regionalCombat", "settings", "messages", "modes", "wilderness", "regions"]), "root", errors)) return;
  if (!Object.hasOwn(input, "version")) errors.push("version is required.");
  if (!Object.hasOwn(input, "modes")) errors.push("modes is required.");
  if (!Object.hasOwn(input, "wilderness")) errors.push("wilderness is required.");
  if (Object.hasOwn(input, "regionalCombat")) {
    validateRawRegionalCombat(input.regionalCombat, errors);
  }
  if (Object.hasOwn(input, "settings")) {
    const allowed = new Set(Object.keys(DEFAULT_SETTINGS));
    rejectUnknownKeys(input.settings, allowed, "settings", errors);
  }
  if (Object.hasOwn(input, "messages")) validateRawMessages(input.messages, "messages", true, errors);
  if (Object.hasOwn(input, "modes")) {
    if (!Array.isArray(input.modes)) errors.push("modes must be an array.");
    else input.modes.forEach((mode, index) => validateRawMode(mode, index, errors));
  }
  if (Object.hasOwn(input, "wilderness")) validateRawArea(input.wilderness, "wilderness", false, errors);
  if (Object.hasOwn(input, "regions")) {
    if (!Array.isArray(input.regions)) errors.push("regions must be an array.");
    else input.regions.forEach((region, index) => validateRawArea(region, `regions[${index}]`, true, errors));
  }
}

export function validateConfig(input) {
  const errorSink = createBoundedErrorSink();
  const errors = errorSink;
  const warnings = [];
  try {
    validateRawConfigurationLimits(input);
  } catch (error) {
    errors.push(error.message);
  }
  validateRawConfig(input, errors);
  const config = hydrateConfig(input);
  if (Number(config.version) !== CONFIG_VERSION) errors.push(`version must be ${CONFIG_VERSION}.`);
  if (config.modes.length < 1 || config.modes.length > 128) errors.push("modes must contain between 1 and 128 entries.");
  const modeIds = new Set();
  const modeNames = new Set();
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

  const names = new Map([[config.wilderness.name.trim().toLowerCase(), "wilderness"]]);
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
    if (region.minimumLevel !== null && (!Number.isInteger(region.minimumLevel) || region.minimumLevel < 1 || region.minimumLevel > 999)) {
      errors.push(`${prefix}.minimumLevel must be an integer between 1 and 999.`);
    }
    validateCombat(region.combat, `${prefix}.combat`, errors);
    if (!region.enabled) warnings.push(`${prefix} (${region.name || "unnamed"}) is disabled.`);
  });

  const globalMessages = normalizeMessages(config.messages, DEFAULT_MESSAGES, true);
  for (const event of MESSAGE_EVENTS) validateMessage(globalMessages[event.id], `messages.${event.id}`, errors);
  config.regions.forEach((region, index) => {
    const resolved = resolveAreaMessages(config, region);
    for (const event of MESSAGE_EVENTS) validateMessage(resolved[event.id], `regions[${index}].messages.${event.id}`, errors);
  });
  config.modes.forEach((mode, index) => {
    const resolved = resolveAreaMessages(config, { mode: mode.id, messages: {} });
    for (const event of MESSAGE_EVENTS) validateMessage(resolved[event.id], `modes[${index}].messages.${event.id}`, errors);
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

function compactMessage(message, defaults) {
  const result = {};
  if (message.enabled !== defaults.enabled) result.enabled = message.enabled;
  if (message.cooldownSeconds !== defaults.cooldownSeconds) result.cooldownSeconds = message.cooldownSeconds;
  if (message.chat.enabled !== defaults.chat.enabled || message.chat.text !== defaults.chat.text) {
    result.chat = { enabled: message.chat.enabled, text: message.chat.text };
  }
  const alerts = {};
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

function compactMessages(messages, defaults, includeGlobalControls) {
  const result = {};
  if (includeGlobalControls) {
    result.enabled = messages.enabled;
    const actionNames = compactDisplayNames(messages.actionNames, DEFAULT_ACTION_NAMES);
    if (Object.keys(actionNames).length) result.actionNames = actionNames;
  }
  for (const event of MESSAGE_EVENTS) {
    const compact = compactMessage(messages[event.id], defaults[event.id]);
    if (Object.keys(compact).length) result[event.id] = compact;
  }
  return result;
}

function compactDisplayNames(names, defaults) {
  return Object.fromEntries(Object.keys(defaults)
    .filter((key) => names?.[key] !== defaults[key])
    .map((key) => [key, names[key]]));
}

function compactArea(area, globalMessages) {
  const result = { name: area.name, mode: area.mode };
  if (Object.keys(area.actions || {}).length) result.actions = clone(area.actions);
  if ((area.combat || []).length) result.combat = clone(area.combat);
  const resolved = normalizeMessages(area.messages, globalMessages, false);
  const compact = compactMessages(resolved, globalMessages, false);
  if (Object.keys(compact).length) result.messages = compact;
  return result;
}

export function serializeConfig(input) {
  const config = hydrateConfig(input);
  const result = {
    $schema: `./${SCHEMA_FILE_NAME}`,
    version: CONFIG_VERSION,
    regionalCombat: clone(config.regionalCombat),
    settings: clone(config.settings),
    messages: compactMessages(config.messages, DEFAULT_MESSAGES, true),
    modes: config.modes.map((mode) => ({
      id: mode.id,
      name: mode.name,
      color: mode.color,
      minimumLevel: mode.minimumLevel,
      actions: clone(mode.actions),
      combat: clone(mode.combat),
      ...(Object.keys(mode.messages || {}).length ? { messages: clone(mode.messages) } : {})
    })),
    wilderness: compactArea(config.wilderness, config.messages),
    regions: config.regions.map((region) => {
      const area = compactArea(region, config.messages);
      return {
        ...area,
        ...(region.enabled === false ? { enabled: false } : {}),
        ...(region.minimumLevel !== null ? { minimumLevel: region.minimumLevel } : {}),
        ...(region.map !== "world" ? { map: region.map } : {}),
        polygon: region.polygon.map(([x, y]) => [Number(x), Number(y)])
      };
    })
  };
  return result;
}

export function stringifyConfig(input) {
  return `${JSON.stringify(serializeConfig(input), null, 2)}\n`;
}

function currentMigrationRegistry() {
  const migrateCombat = (area, path, report) => {
    if (!area || !Array.isArray(area.combat)) return;
    area.combat.forEach((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
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
  const migrateV1ToV2 = (document, report) => {
    document.regionalCombat = clone(DEFAULT_REGIONAL_COMBAT);
    if (document.settings && typeof document.settings === "object") {
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
  const migrateV2ToV3 = (document, report = []) => {
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
    const legacyErrors = [];
    if (Object.hasOwn(globalMessages, "pvpWarning")) {
      validateRawMessage(globalMessages.pvpWarning, "messages.pvpWarning", legacyErrors);
    }
    const validateLegacyArea = (area, path) => {
      if (!isPlainObject(area)) return;
      if (Object.hasOwn(area, "color") && !/^#[0-9a-f]{6}$/i.test(area.color)) {
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
    const mergeWarning = (base, warning, path) => {
      const result = clone(base);
      let migrated = false;
      const replace = (channelPath, current, incoming) => {
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
        result.alerts[id] = replace(`alerts.${id}`, result.alerts[id], warning.alerts[id]);
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
      const mode = createStarterMode({
        ...starter,
        name: typeof localizedNames[starter.id] === "string"
          ? localizedNames[starter.id]
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
    const migrateArea = (area, path) => {
      if (!isPlainObject(area)) return;
      if (!Object.hasOwn(area, "mode")) area.mode = "pve";
      const actions = area?.actions;
      for (const key of ["fastTravelDeparture", "fastTravelArrival"]) {
        if (!isPlainObject(actions) || !Object.hasOwn(actions, key)) continue;
        if (typeof actions[key] !== "boolean") {
          throw new Error(`${path}.actions.${key} must be true or false.`);
        }
        actions[key] = actions[key] ? "all" : "none";
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
  };
  return [
    {
      version: 1,
      validate(document) {
        if (Object.hasOwn(document, "damage")) {
          throw new Error("Configuration Version 1 does not allow the damage object.");
        }
        const candidate = clone(document);
        migrateV1ToV2(candidate, []);
        migrateV2ToV3(candidate);
        candidate.version = 3;
        const validation = validateConfig(candidate);
        if (!validation.valid) throw new Error(validation.errors.join("\n"));
      },
      migrateToNext: migrateV1ToV2
    },
    {
      version: 2,
      validate(document) {
        const candidate = clone(document);
        migrateV2ToV3(candidate);
        candidate.version = 3;
        const validation = validateConfig(candidate);
        if (!validation.valid) throw new Error(validation.errors.join("\n"));
      },
      migrateToNext: migrateV2ToV3
    },
    {
      version: 3,
      validate(document) {
        const validation = validateConfig(document);
        if (!validation.valid) throw new Error(validation.errors.join("\n"));
      }
    }
  ];
}

export function migrateConfig(input) {
  const registry = currentMigrationRegistry();
  if (registry.length !== CONFIG_VERSION) {
    throw new Error(
      `Configuration migration registry ends at version ${registry.length}, but the model declares version ${CONFIG_VERSION}.`
    );
  }
  return migrateConfiguration(input, registry);
}

function parseConfigWithMigration(source) {
  const migration = migrateConfig(parseConfigSource(source));
  const validation = validateConfig(migration.document);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  return {
    config: validation.config,
    migration
  };
}

export function parseConfigTextWithMigration(textValue) {
  return parseConfigWithMigration(textValue);
}

export function parseConfigBytesWithMigration(bytes) {
  return parseConfigWithMigration(bytes);
}

export function parseConfigText(textValue) {
  return parseConfigTextWithMigration(textValue).config;
}

export function parseConfigBytes(bytes) {
  return parseConfigBytesWithMigration(bytes).config;
}

export function formatTemplate(template, values = {}) {
  let result = String(template ?? "");
  for (const placeholder of ["region", "previousRegion", "mode", "action", "minimumLevel", "playerLevel"]) {
    result = result.replaceAll(`{${placeholder}}`, values[placeholder] == null ? "" : String(values[placeholder]));
  }
  return result;
}
