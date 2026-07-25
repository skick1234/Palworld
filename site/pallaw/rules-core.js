export const CONFIG_VERSION = 2;
export const CONFIG_FILE_NAME = "PalLaw.json";
export const SCHEMA_FILE_NAME = "PalLaw.schema.json";

import {
  CONFIG_LIMITS,
  createBoundedErrorSink,
  parseConfigSource,
  validateRawConfigurationLimits
} from "./config-source.js?v=4";
import {
  addMigrationFallback,
  migrateConfiguration
} from "./configuration-migrations.js?v=4";

export { CONFIG_LIMITS, ConfigSourceError, parseConfigSource } from "./config-source.js?v=4";

export {
  MAPS,
  inGameMapToWorld,
  mapFractionToWorld,
  worldToInGameMap,
  worldToMapFraction
} from "./map-coordinates.js?v=4";

export const ACTORS = [
  { id: "player", label: "Player" },
  { id: "partnerPal", label: "Partner Pal" },
  { id: "basePal", label: "Base Pal" },
  {
    id: "baseStructure",
    label: "Base Structure",
    description: "Structures attributed to a base camp or guild, including defensive structures when Palworld reports the structure as the responsible damage source.",
    mapObject: true
  },
  { id: "wildPal", label: "Wild Pal" },
  { id: "npc", label: "NPC" },
  {
    id: "structure",
    label: "Player-Built Structure",
    description: "Objects attributed to a player outside of a base camp.",
    mapObject: true,
    targetOnly: true
  },
  {
    id: "environment",
    label: "Environmental Map Object",
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
  { id: "fastTravelDeparture", label: "Fast travel departure", description: "Begin fast travel while standing in this area." },
  { id: "fastTravelArrival", label: "Fast travel arrival", description: "Arrive at a fast-travel destination inside this area." }
];

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

export const MODES = [
  {
    id: "safe",
    label: "Safe",
    color: "#22C55E",
    description: "Players and player-owned Pals are protected in both directions. Map-object damage keeps vanilla behavior unless overridden."
  },
  {
    id: "pve",
    label: "PvE",
    color: "#38BDF8",
    description: "Environmental combat remains active, while combat between player groups is denied."
  },
  {
    id: "pvp",
    label: "PvP",
    color: "#F43F5E",
    description: "Open player combat. With regional combat authority enabled, PalLaw enables the required player-damage setting and limits combat to the configured areas."
  }
];

export const DEFAULT_MODE_NAMES = Object.freeze({
  safe: "Safe",
  pve: "PvE",
  pvp: "PvP"
});

export const MESSAGE_EVENTS = [
  {
    id: "regionChanged",
    label: "Region changed",
    description: "Sent when a player enters a different named region or returns to wilderness.",
    placeholders: ["{region}", "{previousRegion}", "{mode}"]
  },
  {
    id: "pvpWarning",
    label: "PvP warning",
    description: "Sent in addition to the region message whenever the destination mode is PvP.",
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
  modeNames: { ...DEFAULT_MODE_NAMES },
  regionChanged: {
    enabled: true,
    cooldownSeconds: 0,
    chat: { enabled: false, text: "Entered {region}." },
    alerts: defaultAlerts("{region}", "activity")
  },
  pvpWarning: {
    enabled: true,
    cooldownSeconds: 0,
    chat: { enabled: false, text: "Player combat is enabled in {region}." },
    alerts: defaultAlerts("PVP ENABLED - {region}", "brief", "negative")
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
const MODE_IDS = new Set(MODES.map((entry) => entry.id));
const MESSAGE_IDS = new Set(MESSAGE_EVENTS.map((entry) => entry.id));
const ALERT_PRESENTATION_IDS = new Set(ALERT_PRESENTATIONS.map((entry) => entry.id));
const ALERT_TONE_IDS = new Set(ALERT_TONES.map((entry) => entry.id));
const EPSILON = 1e-6;

export function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function modeDefinition(mode) {
  return MODES.find((entry) => entry.id === mode) || MODES[1];
}

export function createDefaultConfig() {
  return {
    $schema: `./${SCHEMA_FILE_NAME}`,
    version: CONFIG_VERSION,
    regionalCombat: clone(DEFAULT_REGIONAL_COMBAT),
    settings: clone(DEFAULT_SETTINGS),
    messages: clone(DEFAULT_MESSAGES),
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
    result.modeNames = normalizeDisplayNames(value.modeNames, DEFAULT_MODE_NAMES);
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
    if (typeof value[action.id] === "boolean") result[action.id] = value[action.id];
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
  const mode = MODE_IDS.has(source.mode) ? source.mode : "pve";
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
  const mode = modeDefinition(area.mode);
  return {
    ...area,
    enabled: boolean(source.enabled, true),
    minimumLevel: source.minimumLevel !== null && source.minimumLevel !== undefined && source.minimumLevel !== "" && Number.isInteger(Number(source.minimumLevel))
      ? Number(source.minimumLevel)
      : null,
    map: text(source.map, "world"),
    color: text(source.color, mode.color),
    polygon: normalizePolygon(source.polygon)
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
  config.wilderness = normalizeArea(source.wilderness, "Wilderness");
  config.regions = Array.isArray(source.regions)
    ? source.regions.map(normalizeRegion)
    : [];
  return config;
}

export function modeActions() {
  return Object.fromEntries(ACTIONS.map((action) => [action.id, true]));
}

export function effectiveActions(area) {
  return { ...modeActions(area?.mode), ...(area?.actions || {}) };
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

export function effectiveCombat(area) {
  const matrix = modeCombat(area?.mode || "pve");
  for (const entry of area?.combat || []) {
    const sources = normalizeSelection(entry.source);
    const targets = normalizeSelection(entry.target);
    const allowed = entry.allow === true;
    for (const source of sources) {
      if (!matrix[source]) continue;
      for (const target of targets) {
        if (!Object.hasOwn(matrix[source], target)) continue;
        matrix[source][target] = allowed;
        if (entry.bidirectional && matrix[target] && Object.hasOwn(matrix[target], source)) {
          matrix[target][source] = allowed;
        }
      }
    }
  }
  return matrix;
}

function finalMatchingCombatEntry(area, source, target) {
  const combat = Array.isArray(area?.combat) ? area.combat : [];
  for (let index = combat.length - 1; index >= 0; index -= 1) {
    const entry = combat[index];
    if (normalizeSelection(entry?.source).includes(source) &&
        normalizeSelection(entry?.target).includes(target)) {
      return { entry, index };
    }
  }
  return null;
}

function isPreciseQuickOverride(entry, source, target) {
  const sources = normalizeSelection(entry?.source);
  const targets = normalizeSelection(entry?.target);
  return sources.length === 1 && sources[0] === source &&
    targets.length === 1 && targets[0] === target &&
    entry?.bidirectional !== true && typeof entry?.allow === "boolean" &&
    !Object.hasOwn(entry, "damage");
}

export function quickCombatOverride(area, source, target) {
  const match = finalMatchingCombatEntry(area, source, target);
  if (!match || !isPreciseQuickOverride(match.entry, source, target)) return "default";
  return match.entry.allow ? "allow" : "deny";
}

export function setQuickCombatOverride(area, source, target, value) {
  if (!area || typeof area !== "object" || Array.isArray(area)) {
    throw new TypeError("A combat area is required.");
  }
  if (!["default", "allow", "deny"].includes(value)) {
    throw new TypeError("Quick combat override must be default, allow, or deny.");
  }

  area.combat = Array.isArray(area.combat) ? area.combat : [];
  const match = finalMatchingCombatEntry(area, source, target);
  if (match && isPreciseQuickOverride(match.entry, source, target)) {
    area.combat.splice(match.index, 1);
  }
  if (value !== "default") {
    area.combat.push({
      source: [source],
      target: [target],
      allow: value === "allow",
      bidirectional: false
    });
  }
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
    needsPlayerActionEnforcement ||= area.minimumLevel != null ||
      ["ride", "fly"].some((action) => actions[action] === false);
    needsFastTravelAuthorization ||= area.minimumLevel != null ||
      ["fastTravelDeparture", "fastTravelArrival"].some((action) => actions[action] === false);
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
  return normalizeMessages(area?.messages, global, false);
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
  return result;
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
    allowed.add("modeNames");
  }
  if (!rejectUnknownKeys(value, allowed, context, errors)) return;
  if (global && Object.hasOwn(value, "actionNames")) {
    validateRawDisplayNames(value.actionNames, DEFAULT_ACTION_NAMES, `${context}.actionNames`, errors);
  }
  if (global && Object.hasOwn(value, "modeNames")) {
    validateRawDisplayNames(value.modeNames, DEFAULT_MODE_NAMES, `${context}.modeNames`, errors);
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
    if (typeof entry !== "boolean") errors.push(`${context}.${key} must be true or false.`);
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
    for (const key of ["enabled", "minimumLevel", "map", "color", "polygon"]) allowed.add(key);
  }
  if (!rejectUnknownKeys(value, allowed, context, errors)) return;
  if (!Object.hasOwn(value, "name")) errors.push(`${context}.name is required.`);
  if (Object.hasOwn(value, "mode") && !MODE_IDS.has(value.mode)) errors.push(`${context}.mode must be safe, pve, or pvp.`);
  if (Object.hasOwn(value, "actions")) validateRawActions(value.actions, `${context}.actions`, errors);
  if (Object.hasOwn(value, "combat")) validateRawCombat(value.combat, `${context}.combat`, errors);
  if (Object.hasOwn(value, "messages")) validateRawMessages(value.messages, `${context}.messages`, false, errors);
  if (region && !Object.hasOwn(value, "polygon")) errors.push(`${context}.polygon is required.`);
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
  if (!rejectUnknownKeys(input, new Set(["$schema", "version", "regionalCombat", "settings", "messages", "wilderness", "regions"]), "root", errors)) return;
  if (!Object.hasOwn(input, "version")) errors.push("version is required.");
  if (!Object.hasOwn(input, "wilderness")) errors.push("wilderness is required.");
  if (Object.hasOwn(input, "regionalCombat")) {
    validateRawRegionalCombat(input.regionalCombat, errors);
  }
  if (Object.hasOwn(input, "settings")) {
    const allowed = new Set(Object.keys(DEFAULT_SETTINGS));
    rejectUnknownKeys(input.settings, allowed, "settings", errors);
  }
  if (Object.hasOwn(input, "messages")) validateRawMessages(input.messages, "messages", true, errors);
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
  if (!config.wilderness.name.trim()) errors.push("wilderness.name is required.");
  if (!MODE_IDS.has(config.wilderness.mode)) errors.push("wilderness.mode must be safe, pve, or pvp.");
  validateCombat(config.wilderness.combat, "wilderness.combat", errors);

  const names = new Map([[config.wilderness.name.trim().toLowerCase(), "wilderness"]]);
  config.regions.forEach((region, index) => {
    const prefix = `regions[${index}]`;
    const name = region.name.trim();
    if (!name) errors.push(`${prefix}.name is required.`);
    const normalized = name.toLowerCase();
    if (normalized && names.has(normalized)) errors.push(`${prefix}.name duplicates ${names.get(normalized)}.`);
    else if (normalized) names.set(normalized, prefix);
    if (!MODE_IDS.has(region.mode)) errors.push(`${prefix}.mode must be safe, pve, or pvp.`);
    if (!/^#[0-9a-f]{6}$/i.test(region.color)) errors.push(`${prefix}.color must use #RRGGBB.`);
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
    const modeNames = compactDisplayNames(messages.modeNames, DEFAULT_MODE_NAMES);
    if (Object.keys(actionNames).length) result.actionNames = actionNames;
    if (Object.keys(modeNames).length) result.modeNames = modeNames;
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
    wilderness: compactArea(config.wilderness, config.messages),
    regions: config.regions.map((region) => {
      const area = compactArea(region, config.messages);
      return {
        ...area,
        ...(region.enabled === false ? { enabled: false } : {}),
        ...(region.minimumLevel !== null ? { minimumLevel: region.minimumLevel } : {}),
        ...(region.map !== "world" ? { map: region.map } : {}),
        ...(region.color !== modeDefinition(region.mode).color ? { color: region.color } : {}),
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
  return [
    {
      version: 1,
      validate(document) {
        if (Object.hasOwn(document, "damage")) {
          throw new Error("Configuration Version 1 does not allow the damage object.");
        }
        const candidate = clone(document);
        migrateV1ToV2(candidate, []);
        candidate.version = 2;
        const validation = validateConfig(candidate);
        if (!validation.valid) throw new Error(validation.errors.join("\n"));
      },
      migrateToNext: migrateV1ToV2
    },
    {
      version: 2,
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
