export type JsonObject = Record<string, unknown>;

export interface MigrationReportEntry {
  kind: "fallback" | "assumed-version" | "migration-step";
  fromVersion: number | null;
  toVersion: number;
  path: string;
  message: string;
}

export interface MigrationValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface MigrationDefinition {
  version: number;
  validate(document: JsonObject): boolean | void | MigrationValidationResult;
  migrateToNext?: (document: JsonObject, report: MigrationReportEntry[]) => void;
}

export class ConfigurationMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationMigrationError";
  }
}

function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function requireObject(value: unknown, context: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConfigurationMigrationError(`${context} must be an object.`);
  }
  return value as JsonObject;
}

function requireVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ConfigurationMigrationError("version must be a positive integer.");
  }
  return value as number;
}

function normalizeRegistry(definitions: readonly MigrationDefinition[]): MigrationDefinition[] {
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

function validateBoundary(definition: MigrationDefinition, document: JsonObject): void {
  try {
    const result = definition.validate(document);
    if (result === false || (typeof result === "object" && result.valid === false)) {
      const details = typeof result === "object" && Array.isArray(result.errors) ? result.errors.join("\n") : "validation failed";
      throw new Error(details);
    }
  } catch (error) {
    throw new ConfigurationMigrationError(
      `Configuration Version ${definition.version} validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function addMigrationFallback(report: MigrationReportEntry[], {
  fromVersion,
  toVersion,
  path,
  message
}: Omit<MigrationReportEntry, "kind">): void {
  report.push({
    kind: "fallback",
    fromVersion,
    toVersion,
    path,
    message
  });
}

export function migrateConfiguration(input: unknown, definitions: readonly MigrationDefinition[]): {
  changed: boolean;
  document: JsonObject;
  report: MigrationReportEntry[];
  sourceVersion: number;
  targetVersion: number;
} {
  const registry = normalizeRegistry(definitions);
  const currentVersion = registry.length;
  const document = clone(requireObject(input, "Configuration"));
  const report: MigrationReportEntry[] = [];
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
    definition.migrateToNext!(document, report);
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

export function formatMigrationReport(report: readonly MigrationReportEntry[]): string[] {
  return report.map((entry) => `${entry.path}: ${entry.message}`);
}
