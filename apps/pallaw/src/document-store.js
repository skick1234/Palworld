export function createDocumentStore({
  initialValue,
  hydrate,
  serialize,
  persist = () => {},
  historyLimit = 80
}) {
  if (typeof hydrate !== "function" || typeof serialize !== "function") {
    throw new TypeError("Document store requires hydrate and serialize functions.");
  }

  let value = hydrate(initialValue);
  let serialized = serialize(value);
  let history = [serialized];
  let historyIndex = 0;
  let dirty = false;

  function persistCurrent() {
    persist(serialized);
  }

  function pushHistory(snapshot) {
    if (history[historyIndex] === snapshot) return;
    history = history.slice(0, historyIndex + 1);
    history.push(snapshot);
    if (history.length > historyLimit) history.shift();
    historyIndex = history.length - 1;
  }

  function mutate(mutator, { recordHistory = true } = {}) {
    if (typeof mutator !== "function") throw new TypeError("Mutation must be a function.");
    const before = serialized;
    mutator(value);
    value = hydrate(value);
    serialized = serialize(value);
    if (serialized === before) return false;
    if (recordHistory) pushHistory(serialized);
    dirty = true;
    persistCurrent();
    return true;
  }

  function replace(nextValue, { markDirty = false } = {}) {
    value = hydrate(nextValue);
    serialized = serialize(value);
    history = [serialized];
    historyIndex = 0;
    dirty = markDirty;
    persistCurrent();
  }

  function restoreHistory(index) {
    historyIndex = index;
    value = hydrate(JSON.parse(history[historyIndex]));
    serialized = serialize(value);
    dirty = true;
    persistCurrent();
  }

  function undo() {
    if (historyIndex <= 0) return false;
    restoreHistory(historyIndex - 1);
    return true;
  }

  function redo() {
    if (historyIndex >= history.length - 1) return false;
    restoreHistory(historyIndex + 1);
    return true;
  }

  return Object.freeze({
    get value() { return value; },
    get serialized() { return serialized; },
    get dirty() { return dirty; },
    get canUndo() { return historyIndex > 0; },
    get canRedo() { return historyIndex < history.length - 1; },
    markExported() { dirty = false; },
    mutate,
    redo,
    replace,
    undo
  });
}
