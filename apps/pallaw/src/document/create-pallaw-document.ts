import {
  CONFIG_VERSION,
  createDefaultConfig,
  hydrateConfig,
  parseConfigBytesWithMigration,
  parseConfigSource,
  parseConfigTextWithMigration,
  stringifyConfig,
  validateConfig
} from "../domain/rules";
import { createEditorDocument, type DraftPersistence, type EditorDocument } from "./create-editor-document";
import type { PalLawConfigValue } from "../domain/types";

export type PalLawConfig = PalLawConfigValue;

function parsePersistedDraft(source: string): unknown {
  const parsed = parseConfigSource(source);
  if (parsed && typeof parsed === "object" && Number((parsed as { version?: unknown }).version) === CONFIG_VERSION) return parsed;
  return parseConfigTextWithMigration(source).config;
}

export function createPalLawDocument(persistence?: DraftPersistence): EditorDocument<PalLawConfig> {
  return createEditorDocument<PalLawConfig>({
    initialValue: createDefaultConfig() as PalLawConfig,
    hydrate: (input) => hydrateConfig(input) as PalLawConfig,
    serialize: stringifyConfig,
    validate: (config) => validateConfig(config),
    parse: (source) => typeof source === "string"
      ? parseConfigTextWithMigration(source).config
      : parseConfigBytesWithMigration(source).config,
    parsePersisted: parsePersistedDraft,
    persistence,
    historyLimit: 80
  });
}
