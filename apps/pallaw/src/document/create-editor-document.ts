export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface DraftPersistence {
  load(): string | null;
  save(serialized: string): void;
}

export type EditorCommand<TConfig> =
  | { readonly type: "mutate"; readonly apply: (draft: TConfig) => void }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "reset"; readonly value: unknown }
  | { readonly type: "mark-exported" };

export interface EditorSnapshot<TConfig> {
  readonly config: Readonly<TConfig>;
  readonly serialized: string;
  readonly validation: ValidationResult;
  readonly dirty: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface EditorDocument<TConfig> {
  read(): EditorSnapshot<TConfig>;
  dispatch(command: EditorCommand<TConfig>): { accepted: boolean; reason?: string };
  import(source: string | Uint8Array): { accepted: boolean; errors: readonly string[] };
  export(): { fileName: "PalLaw.json"; contents: string };
  subscribe(listener: (snapshot: EditorSnapshot<TConfig>) => void): () => void;
}

interface EditorDocumentOptions<TConfig> {
  readonly initialValue: unknown;
  readonly hydrate: (input: unknown) => TConfig;
  readonly serialize: (config: TConfig) => string;
  readonly validate: (config: TConfig) => ValidationResult;
  readonly parse?: (source: string | Uint8Array) => unknown;
  readonly persistence?: DraftPersistence;
  readonly historyLimit?: number;
}

function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze((value as Record<PropertyKey, unknown>)[key], seen);
  return Object.freeze(value);
}

export function createEditorDocument<TConfig>(options: EditorDocumentOptions<TConfig>): EditorDocument<TConfig> {
  const historyLimit = Math.max(2, options.historyLimit ?? 80);
  const listeners = new Set<(snapshot: EditorSnapshot<TConfig>) => void>();
  let config = deepFreeze(options.hydrate(loadInitialValue(options)));
  let serialized = options.serialize(config);
  let validation = options.validate(config);
  let history = [serialized];
  let historyIndex = 0;
  let dirty = false;

  function loadInitialValue({ initialValue, persistence }: EditorDocumentOptions<TConfig>): unknown {
    if (!persistence) return initialValue;
    try {
      const saved = persistence.load();
      return saved === null ? initialValue : options.parse ? options.parse(saved) : JSON.parse(saved) as unknown;
    } catch {
      return initialValue;
    }
  }

  function snapshot(): EditorSnapshot<TConfig> {
    return Object.freeze({
      config: config as Readonly<TConfig>,
      serialized,
      validation,
      dirty,
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1
    });
  }

  function publish(persist: boolean): void {
    if (persist && options.persistence) {
      try { options.persistence.save(serialized); } catch { /* editing remains available */ }
    }
    const next = snapshot();
    for (const listener of listeners) listener(next);
  }

  function replace(next: TConfig, markDirty: boolean, recordHistory: boolean): boolean {
    const nextSerialized = options.serialize(next);
    if (nextSerialized === serialized) return false;
    config = deepFreeze(next);
    serialized = nextSerialized;
    validation = options.validate(config);
    dirty = markDirty;
    if (recordHistory) {
      history = history.slice(0, historyIndex + 1);
      history.push(serialized);
      if (history.length > historyLimit) history.shift();
      historyIndex = history.length - 1;
    }
    publish(true);
    return true;
  }

  function restore(index: number): void {
    historyIndex = index;
    config = deepFreeze(options.hydrate(JSON.parse(history[index]!) as unknown));
    serialized = options.serialize(config);
    validation = options.validate(config);
    dirty = true;
    publish(true);
  }

  const api: EditorDocument<TConfig> = {
    read: snapshot,
    dispatch(command) {
      if (command.type === "mutate") {
        const draft = clone(config);
        command.apply(draft);
        return { accepted: replace(options.hydrate(draft), true, true) };
      }
      if (command.type === "undo") {
        if (historyIndex === 0) return { accepted: false, reason: "Nothing to undo." };
        restore(historyIndex - 1);
        return { accepted: true };
      }
      if (command.type === "redo") {
        if (historyIndex >= history.length - 1) return { accepted: false, reason: "Nothing to redo." };
        restore(historyIndex + 1);
        return { accepted: true };
      }
      if (command.type === "reset") {
        const next = options.hydrate(command.value);
        config = deepFreeze(next);
        serialized = options.serialize(next);
        validation = options.validate(config);
        history = [serialized];
        historyIndex = 0;
        dirty = false;
        publish(true);
        return { accepted: true };
      }
      if (!dirty) return { accepted: false, reason: "Document is already exported." };
      dirty = false;
      publish(false);
      return { accepted: true };
    },
    import(source) {
      try {
        const parsed = options.parse
          ? options.parse(source)
          : JSON.parse(typeof source === "string" ? source : new TextDecoder().decode(source)) as unknown;
        const next = options.hydrate(parsed);
        const nextValidation = options.validate(next);
        if (!nextValidation.valid) return { accepted: false, errors: nextValidation.errors };
        config = deepFreeze(next);
        serialized = options.serialize(next);
        validation = nextValidation;
        history = [serialized];
        historyIndex = 0;
        dirty = true;
        publish(true);
        return { accepted: true, errors: [] };
      } catch (error) {
        return { accepted: false, errors: [error instanceof Error ? error.message : String(error)] };
      }
    },
    export() {
      return { fileName: "PalLaw.json" as const, contents: serialized };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
  };
  return Object.freeze(api);
}
