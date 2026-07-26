export class ConfigurationMigrationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigurationMigrationError";
  }
}

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function requireObject(value, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConfigurationMigrationError(`${context} must be an object.`);
  }
  return value;
}

function requireVersion(value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new ConfigurationMigrationError("version must be a positive integer.");
  }
  return value;
}

function normalizeRegistry(definitions) {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    throw new ConfigurationMigrationError("Configuration migration registry must define version 1.");
  }
  const registry = [...definitions].sort((left, right) => left.version - right.version);
  registry.forEach((definition, index) => {
    const expected = index + 1;
    if (definition.version !== expected) {
      throw new ConfigurationMigrationError(
        `Configuration migration registry must be contiguous; expected version ${expected}.`
      );
    }
    if (typeof definition.validate !== "function") {
      throw new ConfigurationMigrationError(
        `Configuration migration registry version ${expected} requires a validator.`
      );
    }
    if (index < registry.length - 1 && typeof definition.migrateToNext !== "function") {
      throw new ConfigurationMigrationError(
        `Configuration migration registry requires a version ${expected} to ${expected + 1} step.`
      );
    }
  });
  return registry;
}

function validateBoundary(definition, document) {
  try {
    const result = definition.validate(document);
    if (result === false || (result && result.valid === false)) {
      const details = Array.isArray(result?.errors) ? result.errors.join("\n") : "validation failed";
      throw new Error(details);
    }
  } catch (error) {
    throw new ConfigurationMigrationError(
      `Configuration Version ${definition.version} validation failed: ${error.message}`
    );
  }
}

export function addMigrationFallback(report, {
  fromVersion,
  toVersion,
  path,
  message
}) {
  report.push({
    kind: "fallback",
    fromVersion,
    toVersion,
    path,
    message
  });
}

export function migrateConfiguration(input, definitions) {
  const registry = normalizeRegistry(definitions);
  const currentVersion = registry.length;
  const document = clone(requireObject(input, "Configuration"));
  const report = [];
  let changed = false;
  let sourceVersion;

  if (!Object.hasOwn(document, "version")) {
    document.version = 1;
    sourceVersion = 1;
    changed = true;
    report.push({
      kind: "assumed-version",
      fromVersion: null,
      toVersion: 1,
      path: "$.version",
      message: "Missing version was interpreted as Configuration Version 1."
    });
  } else {
    sourceVersion = requireVersion(document.version);
  }

  if (sourceVersion > currentVersion) {
    throw new ConfigurationMigrationError(
      `Unsupported future Configuration Version ${sourceVersion}; this build supports through version ${currentVersion}.`
    );
  }

  let version = sourceVersion;
  validateBoundary(registry[version - 1], document);
  while (version < currentVersion) {
    const definition = registry[version - 1];
    definition.migrateToNext(document, report);
    const nextVersion = version + 1;
    document.version = nextVersion;
    changed = true;
    validateBoundary(registry[nextVersion - 1], document);
    report.push({
      kind: "migration-step",
      fromVersion: version,
      toVersion: nextVersion,
      path: "$.version",
      message: `Migrated Configuration Version ${version} to ${nextVersion}.`
    });
    version = nextVersion;
  }

  return {
    changed,
    document,
    report,
    sourceVersion,
    targetVersion: currentVersion
  };
}

export function formatMigrationReport(report) {
  return report.map((entry) => `${entry.path}: ${entry.message}`);
}
