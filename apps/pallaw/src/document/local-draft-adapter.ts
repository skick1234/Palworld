import type { DraftPersistence } from "./create-editor-document";

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createLocalDraftAdapter(storage: DraftStorage, key: string): DraftPersistence {
  return Object.freeze({
    load: () => storage.getItem(key),
    save: (serialized: string) => { storage.setItem(key, serialized); }
  });
}

export function createMemoryDraftAdapter(initial: string | null = null): DraftPersistence & { read(): string | null } {
  let value = initial;
  return Object.freeze({
    load: () => value,
    save: (serialized: string) => { value = serialized; },
    read: () => value
  });
}
