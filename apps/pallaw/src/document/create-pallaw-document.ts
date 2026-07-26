import {
  createDefaultConfig,
  hydrateConfig,
  parseConfigBytesWithMigration,
  parseConfigTextWithMigration,
  stringifyConfig,
  validateConfig
} from "../domain/rules";
import { createEditorDocument, type DraftPersistence, type EditorDocument } from "./create-editor-document";
import type { PalLawConfigValue } from "../domain/types";

export type PalLawConfig = PalLawConfigValue;

export function createPalLawDocument(persistence?: DraftPersistence): EditorDocument<PalLawConfig> {
  return createEditorDocument<PalLawConfig>({
    initialValue: createDefaultConfig() as PalLawConfig,
    hydrate: (input) => hydrateConfig(input) as PalLawConfig,
    serialize: stringifyConfig,
    validate: (config) => validateConfig(config),
    parse: (source) => typeof source === "string"
      ? parseConfigTextWithMigration(source).config
      : parseConfigBytesWithMigration(source).config,
    persistence,
    historyLimit: 80
  });
}
