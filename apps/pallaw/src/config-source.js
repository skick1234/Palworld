export const CONFIG_LIMITS = Object.freeze({
  rawBytes: 4 * 1024 * 1024,
  nestingDepth: 32,
  regions: 1024,
  polygonPoints: 1024,
  totalPolygonPoints: 65536,
  combatEntriesPerArea: 128,
  detailedErrors: 100,
  errorBytes: 512
});

const encoder = new TextEncoder();
const fatalDecoder = new TextDecoder("utf-8", { fatal: true });

export class ConfigSourceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ConfigSourceError";
    this.code = code;
  }
}

function fail(message, code) {
  throw new ConfigSourceError(message, code);
}

function sourceBytes(source) {
  if (typeof source === "string") return encoder.encode(source);
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  if (ArrayBuffer.isView(source)) return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  throw new TypeError("Configuration source must be a string, ArrayBuffer, or byte view.");
}

function decodeSource(source) {
  const bytes = sourceBytes(source);
  if (bytes.byteLength > CONFIG_LIMITS.rawBytes) {
    fail(`Configuration exceeds the ${CONFIG_LIMITS.rawBytes}-byte limit.`, "RawByteLimit");
  }

  let text;
  try {
    text = fatalDecoder.decode(bytes);
  } catch {
    fail("Configuration is not valid UTF-8.", "InvalidEncoding");
  }
  if (text.startsWith("\uFEFF")) text = text.slice(1);
  return text;
}

function tokenizeAndCheck(text) {
  let index = 0;

  function syntax(message) {
    fail(`Invalid JSON at byte-independent character ${index}: ${message}`, "InvalidJson");
  }

  function whitespace() {
    while (index < text.length && /\s/u.test(text[index])) index += 1;
  }

  function stringToken() {
    if (text[index] !== '"') syntax("expected a string");
    const start = index;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === '"') {
        index += 1;
        try {
          return JSON.parse(text.slice(start, index));
        } catch {
          syntax("invalid string escape");
        }
      }
      if (character === "\\") {
        index += 1;
        if (index >= text.length) syntax("unterminated escape");
        if (text[index] === "u") {
          const digits = text.slice(index + 1, index + 5);
          if (!/^[0-9a-f]{4}$/iu.test(digits)) syntax("invalid Unicode escape");
          index += 5;
          continue;
        }
        if (!'"\\/bfnrt'.includes(text[index])) syntax("invalid escape");
        index += 1;
        continue;
      }
      if (character.charCodeAt(0) < 0x20) syntax("unescaped control character");
      index += 1;
    }
    syntax("unterminated string");
  }

  function containerDepth(depth) {
    const next = depth + 1;
    if (next > CONFIG_LIMITS.nestingDepth) {
      fail(`JSON container nesting exceeds depth ${CONFIG_LIMITS.nestingDepth}.`, "NestingDepth");
    }
    return next;
  }

  function object(depth) {
    const currentDepth = containerDepth(depth);
    const keys = new Set();
    index += 1;
    whitespace();
    if (text[index] === "}") {
      index += 1;
      return;
    }
    while (index < text.length) {
      whitespace();
      const key = stringToken();
      if (keys.has(key)) fail(`Duplicate JSON object key ${JSON.stringify(key)}.`, "DuplicateKey");
      keys.add(key);
      whitespace();
      if (text[index] !== ":") syntax("expected ':' after object key");
      index += 1;
      value(currentDepth);
      whitespace();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      if (text[index] !== ",") syntax("expected ',' or '}'");
      index += 1;
    }
    syntax("unterminated object");
  }

  function array(depth) {
    const currentDepth = containerDepth(depth);
    index += 1;
    whitespace();
    if (text[index] === "]") {
      index += 1;
      return;
    }
    while (index < text.length) {
      value(currentDepth);
      whitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      if (text[index] !== ",") syntax("expected ',' or ']'");
      index += 1;
    }
    syntax("unterminated array");
  }

  function scalar() {
    const remainder = text.slice(index);
    const match = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/u.exec(remainder);
    if (!match) syntax("expected a JSON value");
    index += match[0].length;
  }

  function value(depth) {
    whitespace();
    if (text[index] === "{") object(depth);
    else if (text[index] === "[") array(depth);
    else if (text[index] === '"') stringToken();
    else scalar();
  }

  value(0);
  whitespace();
  if (index !== text.length) syntax("unexpected trailing content");
}

export function validateRawConfigurationLimits(document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) return;
  const regions = Array.isArray(document.regions) ? document.regions : [];
  if (regions.length > CONFIG_LIMITS.regions) {
    fail(`regions contains more than ${CONFIG_LIMITS.regions} entries.`, "RegionLimit");
  }

  const areas = [{ value: document.wilderness, path: "wilderness" }];
  regions.forEach((region, index) => areas.push({ value: region, path: `regions[${index}]` }));
  let totalPoints = 0;
  for (const area of areas) {
    const combat = area.value?.combat;
    if (Array.isArray(combat) && combat.length > CONFIG_LIMITS.combatEntriesPerArea) {
      fail(`${area.path}.combat contains more than ${CONFIG_LIMITS.combatEntriesPerArea} entries.`, "CombatEntryLimit");
    }
    const points = area.value?.polygon;
    if (!Array.isArray(points)) continue;
    if (points.length > CONFIG_LIMITS.polygonPoints) {
      fail(`${area.path}.polygon contains more than ${CONFIG_LIMITS.polygonPoints} points.`, "PolygonPointLimit");
    }
    totalPoints += points.length;
    if (totalPoints > CONFIG_LIMITS.totalPolygonPoints) {
      fail(`Raw polygons contain more than ${CONFIG_LIMITS.totalPolygonPoints} total points.`, "TotalPolygonPointLimit");
    }
  }
}

export function parseConfigSource(source) {
  const text = decodeSource(source);
  tokenizeAndCheck(text);
  let document;
  try {
    document = JSON.parse(text);
  } catch (error) {
    fail(`Invalid JSON: ${error.message}`, "InvalidJson");
  }
  validateRawConfigurationLimits(document);
  return document;
}

export function truncateUtf8(value, maximumBytes = CONFIG_LIMITS.errorBytes) {
  const text = String(value);
  const bytes = encoder.encode(text);
  if (bytes.byteLength <= maximumBytes) return text;
  return new TextDecoder().decode(bytes.slice(0, maximumBytes)).replace(/\uFFFD$/u, "");
}

export function createBoundedErrorSink() {
  const details = [];
  let total = 0;
  return {
    push(...messages) {
      for (const message of messages) {
        total += 1;
        if (details.length < CONFIG_LIMITS.detailedErrors) details.push(truncateUtf8(message));
      }
      return details.length;
    },
    finalize() {
      if (total > details.length) return [...details, `${total - details.length} additional errors omitted.`];
      return [...details];
    }
  };
}
