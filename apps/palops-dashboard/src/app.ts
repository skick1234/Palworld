type AccessMode = "public" | "operator" | "disabled";
type Access = { mode: AccessMode; fixed: boolean; allowed_modes: AccessMode[] };
type Capabilities = { endpoints: Record<string, Access> };
type JsonObject = Record<string, unknown>;
type ContractOperation = {
  operationId: string;
  method: "GET" | "POST" | "PUT";
  pathTemplate: string;
  summary: string;
  mutation: boolean;
};

const views = {
  leaderboards: { title: "Leaderboards", kicker: "World rankings" },
  players: { title: "Players", kicker: "Player Summaries" },
  operations: { title: "Operations", kicker: "Operator actions" },
  server: { title: "Server", kicker: "Live world state" },
  configuration: { title: "Configuration", kicker: "palops.json authority" },
  api: { title: "API", kicker: "Developer reference" },
} as const;
type View = keyof typeof views;

type OperationDefinition = {
  operationId: string;
  path: string;
  label: string;
  group: "Player" | "Grant" | "Progression" | "Server";
  target: boolean;
  input: "none" | "reason" | "message" | "amount" | "signed" | "items" | "pals" | "eggs" | "relics" | "technologies" | "shutdown";
};

const operationDefinitions: OperationDefinition[] = [
  { operationId: "kickPlayer", path: "/v1/players/ops/kick", label: "Kick player", group: "Player", target: true, input: "reason" },
  { operationId: "banPlayer", path: "/v1/players/ops/ban", label: "Ban player", group: "Player", target: true, input: "reason" },
  { operationId: "unbanPlayer", path: "/v1/players/ops/unban", label: "Unban player", group: "Player", target: true, input: "none" },
  { operationId: "messagePlayer", path: "/v1/players/ops/message", label: "Message player", group: "Player", target: true, input: "message" },
  { operationId: "givePlayerItems", path: "/v1/players/ops/give-items", label: "Give items", group: "Grant", target: true, input: "items" },
  { operationId: "givePlayerPals", path: "/v1/players/ops/give-pals", label: "Give Pals", group: "Grant", target: true, input: "pals" },
  { operationId: "givePlayerPalEggs", path: "/v1/players/ops/give-pal-eggs", label: "Give Pal eggs", group: "Grant", target: true, input: "eggs" },
  { operationId: "givePlayerExperience", path: "/v1/players/ops/give-experience", label: "Give experience", group: "Progression", target: true, input: "amount" },
  { operationId: "givePlayerStatusPoints", path: "/v1/players/ops/give-status-points", label: "Change status points", group: "Progression", target: true, input: "signed" },
  { operationId: "givePlayerRelics", path: "/v1/players/ops/give-relics", label: "Give relics", group: "Progression", target: true, input: "relics" },
  { operationId: "givePlayerTechnologyPoints", path: "/v1/players/ops/give-technology-points", label: "Give technology points", group: "Progression", target: true, input: "amount" },
  { operationId: "givePlayerAncientTechnologyPoints", path: "/v1/players/ops/give-ancient-technology-points", label: "Give ancient technology points", group: "Progression", target: true, input: "amount" },
  { operationId: "learnPlayerTechnologies", path: "/v1/players/ops/learn-technologies", label: "Learn technologies", group: "Progression", target: true, input: "technologies" },
  { operationId: "forgetPlayerTechnologies", path: "/v1/players/ops/forget-technologies", label: "Forget technologies", group: "Progression", target: true, input: "technologies" },
  { operationId: "broadcastServerChat", path: "/v1/server/ops/broadcast", label: "Broadcast chat", group: "Server", target: false, input: "message" },
  { operationId: "alertServerPlayers", path: "/v1/server/ops/alert", label: "Send alert", group: "Server", target: false, input: "message" },
  { operationId: "saveServerWorld", path: "/v1/server/ops/save", label: "Save world", group: "Server", target: false, input: "none" },
  { operationId: "shutdownServer", path: "/v1/server/ops/shutdown", label: "Schedule shutdown", group: "Server", target: false, input: "shutdown" },
];

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const content = byId<HTMLElement>("content");
const notice = byId<HTMLElement>("notice");
const loginDialog = byId<HTMLDialogElement>("login-dialog");
let activeView: View = "leaderboards";
let selectedPlayerId = "";
let authenticated = false;
let capabilities: Capabilities = { endpoints: {} };
let contractOperations: ContractOperation[] = [];

function element<K extends keyof HTMLElementTagNameMap>(name: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
function clear(node: HTMLElement) { node.replaceChildren(); }
function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (value && typeof value === "object" && typeof (value as JsonObject).value === "number") {
    const numeric = (value as { value: number }).value;
    const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(numeric);
    return (value as JsonObject).complete === false ? `${formatted} (partial)` : formatted;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function score(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && typeof (value as JsonObject).value === "number") return (value as { value: number }).value;
  return 0;
}
function object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
function items(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.filter((item): item is JsonObject => !!item && typeof item === "object");
  if (value && typeof value === "object" && Array.isArray((value as JsonObject).items)) return (value as { items: JsonObject[] }).items;
  return [];
}
function errorMessage(body: JsonObject, status: number): string {
  const error = body.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && typeof (error as JsonObject).message === "string") return String((error as JsonObject).message);
  if (typeof body.detail === "string") return typeof body.code === "string" ? `${body.code}: ${body.detail}` : body.detail;
  if (typeof body.message === "string") return body.message;
  return `Request failed with ${status}`;
}
function showNotice(message = "", tone: "info" | "error" | "success" = "info") {
  notice.hidden = !message;
  notice.className = `notice ${tone}`;
  notice.textContent = message;
}
function activateView(view: View, preservePlayer = false) {
  activeView = view;
  if (view !== "players" && !preservePlayer) selectedPlayerId = "";
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", (item as HTMLElement).dataset.view === view));
  history.replaceState(null, "", `#${view}`);
}
function panel(title: string, hint = "", wide = false): { root: HTMLElement; body: HTMLElement } {
  const root = element("article", `panel${wide ? " wide" : ""}`);
  const heading = element("header", "panel-heading");
  heading.append(element("h2", "", title));
  if (hint) heading.append(element("small", "", hint));
  const body = element("div", "panel-body");
  root.append(heading, body);
  return { root, body };
}
function metric(label: string, value: unknown, note = ""): HTMLElement {
  const root = element("div", "metric");
  root.append(element("span", "", label), element("strong", "", display(value)));
  if (note) root.append(element("small", "", note));
  return root;
}
function table(records: JsonObject[], preferred: string[] = [], onSelect?: (record: JsonObject) => void): HTMLElement {
  if (!records.length) return element("p", "empty", "No records are available for this snapshot.");
  const keys = (preferred.length
    ? preferred.filter((key) => records.some((row) => key in row))
    : Object.keys(records[0]).filter((key) => typeof records[0][key] !== "object")).slice(0, 10);
  const wrap = element("div", "table-wrap");
  const tableNode = element("table");
  const head = element("thead");
  const headRow = element("tr");
  for (const key of keys) headRow.append(element("th", "", key.replaceAll("_", " ")));
  head.append(headRow);
  const body = element("tbody");
  for (const record of records) {
    const row = element("tr", onSelect ? "selectable" : "");
    if (onSelect) {
      row.tabIndex = 0;
      row.addEventListener("click", () => onSelect(record));
      row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") onSelect(record); });
    }
    for (const key of keys) {
      const value = display(record[key]);
      const cell = element("td", "", value);
      cell.title = value;
      row.append(cell);
    }
    body.append(row);
  }
  tableNode.append(head, body);
  wrap.append(tableNode);
  return wrap;
}
function labeled(labelText: string, control: HTMLElement, helper = ""): HTMLLabelElement {
  const label = element("label");
  label.append(element("span", "field-label", labelText), control);
  if (helper) label.append(element("small", "field-help", helper));
  return label;
}
function access(operationId: string): Access | null { return capabilities.endpoints[operationId] ?? null; }
async function apiResponse(path: string, operationId: string, init: RequestInit = {}): Promise<{ body: unknown; response: Response }> {
  const policy = access(operationId);
  if (policy?.mode === "disabled") throw new Error(`${operationId} is disabled by endpoint policy.`);
  const response = await fetch(`/api/palops${path}`, init);
  const body = await response.json().catch(() => ({})) as JsonObject;
  if (!response.ok) throw new Error(errorMessage(body, response.status));
  return { body, response };
}
async function api(path: string, operationId: string, init: RequestInit = {}): Promise<unknown> {
  return (await apiResponse(path, operationId, init)).body;
}

async function loadCapabilities() { capabilities = await api("/v1/capabilities", "getCapabilities") as Capabilities; }
async function loadContract() {
  const response = await fetch("/api/contract");
  contractOperations = ((await response.json()) as { operations: ContractOperation[] }).operations;
}
async function loadSession() {
  const response = await fetch("/api/session");
  const state = await response.json() as { authenticated: boolean; expires_at: string | null };
  authenticated = state.authenticated;
  byId("session-label").textContent = authenticated && state.expires_at ? `Operator until ${new Date(state.expires_at).toLocaleTimeString()}` : "Public session";
  byId("login-button").textContent = authenticated ? "Log out" : "Operator login";
}
async function updateWorld() {
  try {
    const status = await api("/v1/server/status", "getServerStatus") as JsonObject;
    const ready = status.ready === true;
    byId("world-dot").classList.toggle("ready", ready);
    byId("world-label").textContent = display(status.world_label ?? (ready ? "World ready" : "Runtime pending"));
    byId("world-detail").textContent = `${display(status.online_player_count)} online, revision ${display(status.snapshot_revision)}`;
  } catch (error) {
    byId("world-label").textContent = "Public mode";
    byId("world-detail").textContent = error instanceof Error ? error.message : "Status unavailable";
  }
}

function flattenedPlayer(player: JsonObject): JsonObject {
  const counts = object(player.counts);
  const scores = object(player.scores);
  return {
    id: player.id,
    display_name: player.display_name,
    guild_name: player.guild_name,
    level: player.level,
    party_pals: counts.party_pals,
    owned_pals: counts.owned_pals,
    team_firepower: scores.team_firepower,
    team_combat_power: scores.team_combat_power,
    complete: player.complete,
  };
}

async function renderLeaderboards() {
  const grid = element("div", "grid");
  const results = await Promise.all([
    api("/v1/leaderboards/players", "listPlayerLeaderboard"),
    api("/v1/leaderboards/pals", "listPalLeaderboard"),
    api("/v1/leaderboards/guilds", "listGuildLeaderboard"),
  ]);
  const players = items(results[0]).sort((a, b) => score(b.team_combat_power) - score(a.team_combat_power));
  const pals = items(results[1]).sort((a, b) => score(b.combat_power) - score(a.combat_power));
  const guilds = items(results[2]).sort((a, b) => score(b.combat_power) - score(a.combat_power));
  const metrics = element("section", "metric-strip");
  metrics.append(
    metric("Ranked players", players.length),
    metric("Top team", players[0]?.display_name ?? "-", display(players[0]?.team_combat_power)),
    metric("Top Party Pal", pals[0]?.display_name ?? pals[0]?.species ?? "-", display(pals[0]?.combat_power)),
    metric("Top guild", guilds[0]?.name ?? "-", display(guilds[0]?.combat_power)),
  );
  grid.append(metrics);
  const playerPanel = panel("Players", "Sorted by team combat power", true);
  playerPanel.body.replaceWith(table(players, ["display_name", "guild_name", "level", "team_combat_power", "team_firepower", "complete"], (record) => openPlayer(String(record.player_id ?? ""))));
  const palPanel = panel("Party Pals", "Sorted by combat power");
  palPanel.body.replaceWith(table(pals, ["display_name", "species", "owner_display_name", "level", "combat_power", "firepower"]));
  const guildPanel = panel("Guilds", "Sorted by combat power");
  guildPanel.body.replaceWith(table(guilds, ["name", "member_count", "combat_power", "firepower", "complete"]));
  grid.append(playerPanel.root, palPanel.root, guildPanel.root);
  content.append(grid);
}

function openPlayer(id: string) {
  if (!id) return;
  selectedPlayerId = id;
  activeView = "players";
  history.replaceState(null, "", `#players/${encodeURIComponent(id)}`);
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", (item as HTMLElement).dataset.view === "players"));
  void render();
}

async function renderPlayers() {
  if (selectedPlayerId) return renderPlayerDetail(selectedPlayerId);
  const players = items(await api("/v1/players", "listPlayers")).map(flattenedPlayer);
  const toolbar = element("div", "list-toolbar");
  const search = element("input") as HTMLInputElement;
  search.type = "search";
  search.placeholder = "Search name, guild, or player ID";
  search.setAttribute("aria-label", "Search players");
  const count = element("span", "result-count", `${players.length} players`);
  toolbar.append(search, count);
  const playerPanel = panel("Player directory", "Select a player for details", true);
  const renderRows = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = players.filter((player) => [player.id, player.display_name, player.guild_name].some((value) => String(value ?? "").toLowerCase().includes(query)));
    count.textContent = `${filtered.length} players`;
    const current = playerPanel.root.querySelector(".table-wrap, .empty");
    current?.replaceWith(table(filtered, ["display_name", "guild_name", "level", "party_pals", "owned_pals", "team_combat_power", "complete"], (record) => openPlayer(String(record.id ?? ""))));
  };
  search.addEventListener("input", renderRows);
  playerPanel.body.replaceWith(table(players, ["display_name", "guild_name", "level", "party_pals", "owned_pals", "team_combat_power", "complete"], (record) => openPlayer(String(record.id ?? ""))));
  content.append(toolbar, playerPanel.root);
}

async function renderPlayerDetail(playerId: string) {
  byId("view-kicker").textContent = "Player detail";
  const [detailValue, presenceValue, operationsValue] = await Promise.all([
    api(`/v1/players/${encodeURIComponent(playerId)}`, "getPlayer"),
    api(`/v1/players/${encodeURIComponent(playerId)}/presence`, "getPlayerPresence").catch(() => null),
    authenticated
      ? api("/v1/ops", "listOperations").catch(() => null)
      : Promise.resolve(null),
  ]);
  const detail = detailValue as JsonObject;
  const presence = presenceValue as JsonObject | null;
  byId("view-title").textContent = display(detail.display_name);
  const actions = element("div", "detail-actions");
  const back = element("button", "button", "Back to players") as HTMLButtonElement;
  back.addEventListener("click", () => { selectedPlayerId = ""; history.replaceState(null, "", "#players"); void render(); });
  const operate = element("button", "button primary", authenticated ? "Open all operations" : "Operator login") as HTMLButtonElement;
  operate.addEventListener("click", () => {
    if (authenticated) { activateView("operations", true); void render(); }
    else byId<HTMLButtonElement>("login-button").click();
  });
  actions.append(back, operate);
  const metrics = element("section", "metric-strip detail-metrics");
  const counts = object(detail.counts);
  const scores = object(detail.scores);
  metrics.append(
    metric("Level", detail.level),
    metric("Party Pals", counts.party_pals),
    metric("Owned Pals", counts.owned_pals),
    metric("Team combat power", scores.team_combat_power),
  );
  const grid = element("div", "grid");
  const overview = panel("Profile", String(detail.id ?? ""));
  overview.body.append(table([{
    guild: detail.guild_name,
    online: presence?.online ?? "Restricted",
    platform_id: presence?.platform_id ?? "Restricted",
    health: presence?.health ?? "Restricted",
    observed_at: detail.observed_at,
    complete: detail.complete,
  }], ["guild", "online", "platform_id", "health", "observed_at", "complete"]));
  const stats = panel("Statistics", "Counts only, no private inventories");
  const statistics = object(detail.statistics);
  stats.body.append(table([{
    experience: statistics.experience,
    boss_defeats: statistics.boss_defeats,
    pal_captures: statistics.pal_captures,
    fishing: statistics.fishing,
    inventory_items: counts.inventory_items,
    unlocked_technologies: counts.unlocked_technologies,
  }], ["experience", "boss_defeats", "pal_captures", "fishing", "inventory_items", "unlocked_technologies"]));
  const relics = panel("Relic counts", "Per relic type");
  const relicRows = Object.entries(object(detail.relic_counts)).map(([relic_type, count]) => ({ relic_type, count }));
  relics.body.append(table(relicRows, ["relic_type", "count"]));
  const party = panel("Party Pals", "Current five-slot party", true);
  const partyGrid = element("div", "party-grid");
  for (const pal of items(detail.party_pals)) {
    const card = element("article", "party-pal");
    const heading = element("header");
    heading.append(element("strong", "", display(pal.display_name || pal.species)), element("span", "", `Level ${display(pal.level)}`));
    card.append(heading, table([{
      species: pal.species,
      condenser_rank: pal.condenser_rank,
      max_hp: pal.max_hp,
      shot_attack: pal.shot_attack,
      defense: pal.defense,
      firepower: pal.firepower,
      combat_power: pal.combat_power,
    }], ["species", "condenser_rank", "max_hp", "shot_attack", "defense", "firepower", "combat_power"]));
    const passiveList = items(pal.passives);
    if (passiveList.length) card.append(table(passiveList, ["effect_type", "effect_value", "weight", "points"]));
    partyGrid.append(card);
  }
  if (!partyGrid.children.length) partyGrid.append(element("p", "empty", "No Party Pals are available in this snapshot."));
  party.body.append(partyGrid);
  grid.append(overview.root, stats.root, relics.root, party.root);
  if (authenticated) {
    const playerActions = panel("Player actions", "Target is locked to this player", true);
    playerActions.body.append(operationComposer(
      operationDefinitions.filter((definition) => definition.target),
      playerId,
    ));
    const playerHistory = panel("Player operation history", "Durable outcomes for this player", true);
    if (operationsValue) {
      const matchingOperations = items(operationsValue).filter((operation) => operation.target_id === playerId);
      playerHistory.body.replaceWith(table(matchingOperations, ["id", "type", "status", "message", "created_at", "updated_at"]));
    } else {
      playerHistory.body.append(element("p", "empty", "Operation history is disabled or unavailable."));
    }
    grid.append(playerActions.root, playerHistory.root);
  } else {
    const operatorTools = panel("Operator tools", "AdminPassword required");
    operatorTools.body.append(element("p", "empty", "Log in to manage this player and review their operation history."));
    grid.append(operatorTools.root);
  }
  content.append(actions, metrics, grid);
}

type BatchColumn = [key: string, label: string, type: "string" | "integer"];
const batchColumns: Partial<Record<OperationDefinition["input"], BatchColumn[]>> = {
  items: [["item_id", "Item ID", "string"], ["quantity", "Quantity", "integer"]],
  pals: [["pal_id", "Pal ID", "string"], ["level", "Level", "integer"], ["quantity", "Quantity", "integer"]],
  eggs: [["pal_id", "Pal ID", "string"], ["quantity", "Quantity", "integer"]],
  relics: [["relic_type", "Relic type", "string"], ["amount", "Amount", "integer"]],
};

function batchEntries(form: HTMLFormElement, input: OperationDefinition["input"]): JsonObject[] {
  const editor = form.querySelector<HTMLElement>(`[data-batch="${input}"]`);
  const columns = batchColumns[input];
  if (!editor || !columns) return [];
  const rows = [...editor.querySelectorAll<HTMLElement>(".batch-row")];
  if (!rows.length) throw new Error("Add at least one batch row.");
  return rows.map((row, rowIndex) => {
    const entry: JsonObject = {};
    for (const [key, label, type] of columns) {
      const control = row.querySelector<HTMLInputElement>(`[data-column="${key}"]`);
      const raw = control?.value.trim() ?? "";
      if (!raw) throw new Error(`${label} is required in row ${rowIndex + 1}.`);
      if (type === "integer") {
        const parsed = Number(raw);
        if (!Number.isInteger(parsed)) throw new Error(`${label} in row ${rowIndex + 1} must be a whole number.`);
        entry[key] = parsed;
      } else entry[key] = raw;
    }
    return entry;
  });
}

function operationBody(definition: OperationDefinition, form: HTMLFormElement): JsonObject {
  const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() ?? "";
  const body: JsonObject = {};
  if (definition.target) {
    const playerId = value("player_id");
    if (playerId.length < 8) throw new Error("Enter a valid opaque player ID.");
    body.player_id = playerId;
  }
  if (definition.input === "reason" && value("value")) body.reason = value("value");
  if (definition.input === "message") {
    if (!value("value")) throw new Error("Enter a message.");
    body.message = value("value");
  }
  if (definition.input === "amount" || definition.input === "signed") {
    const amount = Number.parseInt(value("value"), 10);
    if (!Number.isInteger(amount)) throw new Error("Enter a whole number amount.");
    body.amount = amount;
  }
  if (definition.input === "items") body.items = batchEntries(form, definition.input);
  if (definition.input === "pals") body.pals = batchEntries(form, definition.input);
  if (definition.input === "eggs") body.eggs = batchEntries(form, definition.input);
  if (definition.input === "relics") body.relics = batchEntries(form, definition.input);
  if (definition.input === "technologies") body.technology_ids = value("value").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (definition.input === "shutdown") {
    body.delay_seconds = Number.parseInt(value("delay_seconds"), 10);
    body.message = value("value");
    if (!Number.isInteger(Number(body.delay_seconds)) || !body.message) throw new Error("Enter a delay and shutdown message.");
  }
  return body;
}

async function createOperation(definition: OperationDefinition, body: JsonObject) {
  await api(definition.path, definition.operationId, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": `dashboard-${crypto.randomUUID()}` },
    body: JSON.stringify(body),
  });
}

function batchEditor(input: OperationDefinition["input"]): HTMLElement {
  const columns = batchColumns[input] ?? [];
  const fieldset = element("fieldset", "batch-editor");
  fieldset.dataset.batch = input;
  fieldset.append(element("legend", "field-label", "Batch entries"));
  const rows = element("div", "batch-rows");
  const addRow = () => {
    const row = element("div", "batch-row");
    for (const [key, label, type] of columns) {
      const control = element("input") as HTMLInputElement;
      control.dataset.column = key;
      control.placeholder = label;
      control.setAttribute("aria-label", label);
      control.required = true;
      if (type === "integer") {
        control.type = "number";
        control.step = "1";
        control.min = key === "level" || key === "quantity" || key === "amount" ? "1" : "-1000000";
      }
      row.append(control);
    }
    const remove = element("button", "button compact", "Remove") as HTMLButtonElement;
    remove.type = "button";
    remove.addEventListener("click", () => row.remove());
    row.append(remove);
    rows.append(row);
  };
  const add = element("button", "button", "Add row") as HTMLButtonElement;
  add.type = "button";
  add.addEventListener("click", addRow);
  addRow();
  fieldset.append(rows, add, element("small", "field-help", "Each row is validated before the complete request is submitted."));
  return fieldset;
}

function operationFields(definition: OperationDefinition, form: HTMLFormElement, lockedPlayerId = "") {
  const old = form.querySelector(".dynamic-fields");
  old?.remove();
  const fields = element("div", "dynamic-fields form-stack");
  if (definition.target) {
    const player = element("input") as HTMLInputElement;
    player.name = "player_id";
    player.minLength = 8;
    player.maxLength = 96;
    player.required = true;
    player.value = lockedPlayerId || selectedPlayerId;
    player.readOnly = Boolean(lockedPlayerId);
    fields.append(labeled("Player ID", player, "Use the opaque ID from the player detail page."));
  }
  if (batchColumns[definition.input]) {
    fields.append(batchEditor(definition.input));
  } else if (definition.input !== "none") {
    const input = definition.input === "amount" || definition.input === "signed"
      ? element("input") as HTMLInputElement
      : element("textarea") as HTMLTextAreaElement;
    input.name = "value";
    if (input instanceof HTMLTextAreaElement) input.rows = definition.input === "message" || definition.input === "reason" || definition.input === "shutdown" ? 4 : 7;
    let label = "Value";
    let helper = "";
    if (definition.input === "reason") { label = "Reason"; helper = "Optional, up to 256 characters."; }
    if (definition.input === "message" || definition.input === "shutdown") { label = "Message"; helper = "Required, up to 256 characters."; input.required = true; }
    if (definition.input === "amount" || definition.input === "signed") { label = "Amount"; input.required = true; if (input instanceof HTMLInputElement) input.type = "number"; }
    if (definition.input === "technologies") { label = "Technology IDs"; helper = "One technology ID per line."; }
    fields.append(labeled(label, input, helper));
    if (definition.input === "shutdown") {
      const delay = element("input") as HTMLInputElement;
      delay.name = "delay_seconds";
      delay.type = "number";
      delay.min = "0";
      delay.max = "3600";
      delay.value = "30";
      delay.required = true;
      fields.prepend(labeled("Delay in seconds", delay, "0 to 3600 seconds."));
    }
  }
  const preview = form.querySelector(".operation-preview");
  if (preview) preview.before(fields);
  else form.querySelector("button[type=submit]")?.before(fields);
}

function operationComposer(definitions = operationDefinitions, lockedPlayerId = ""): HTMLFormElement {
  const form = element("form", "form-stack") as HTMLFormElement;
  let selected = definitions.find((entry) => access(entry.operationId)?.mode !== "disabled") ?? definitions[0];
  const picker = element("div", "operation-picker");
  const pickerButtons: HTMLButtonElement[] = [];
  for (const group of ["Player", "Grant", "Progression", "Server"] as const) {
    const groupedDefinitions = definitions.filter((entry) => entry.group === group);
    if (!groupedDefinitions.length) continue;
    const section = element("section", "operation-group");
    section.append(element("h3", "", group));
    const actions = element("div", "operation-actions");
    for (const definition of groupedDefinitions) {
      const button = element("button", "operation-action", definition.label) as HTMLButtonElement;
      button.type = "button";
      button.dataset.operationId = definition.operationId;
      button.disabled = access(definition.operationId)?.mode === "disabled";
      button.classList.toggle("selected", definition.operationId === selected.operationId);
      pickerButtons.push(button);
      actions.append(button);
    }
    section.append(actions);
    picker.append(section);
  }
  form.append(picker, element("p", "field-help", "Choose a specific workflow. Grant and progression actions require the player to be online."));
  const preview = element("section", "operation-preview");
  preview.append(element("span", "field-label", "Request preview"));
  const previewCode = element("pre", "code-block");
  preview.append(previewCode);
  const fieldError = element("p", "field-error");
  fieldError.setAttribute("role", "alert");
  const submit = element("button", "button primary", "Submit operation") as HTMLButtonElement;
  submit.type = "submit";
  form.append(preview, fieldError, submit);
  const updatePreview = () => {
    fieldError.textContent = "";
    try { previewCode.textContent = JSON.stringify(operationBody(selected, form), null, 2); }
    catch (error) { previewCode.textContent = error instanceof Error ? error.message : String(error); }
  };
  const choose = (definition: OperationDefinition) => {
    selected = definition;
    pickerButtons.forEach((button) => button.classList.toggle("selected", button.dataset.operationId === definition.operationId));
    submit.textContent = definition.label;
    submit.disabled = access(definition.operationId)?.mode === "disabled";
    operationFields(definition, form, lockedPlayerId);
    updatePreview();
  };
  picker.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-operation-id]");
    const definition = definitions.find((entry) => entry.operationId === button?.dataset.operationId);
    if (definition) choose(definition);
  });
  form.addEventListener("input", updatePreview);
  form.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest(".batch-editor")) queueMicrotask(updatePreview);
  });
  choose(selected);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    fieldError.textContent = "";
    try {
      await createOperation(selected, operationBody(selected, form));
      await render();
      showNotice(`${selected.label} was accepted and recorded.`, "success");
    } catch (error) { fieldError.textContent = error instanceof Error ? error.message : String(error); }
    finally { submit.disabled = access(selected.operationId)?.mode === "disabled"; }
  });
  return form;
}

async function renderOperations() {
  const grid = element("div", "grid");
  const command = panel("Create operation", "All requests are durable and idempotent");
  command.body.append(operationComposer());
  const historyPanel = panel("Operation history", "Accepted, completed, partially completed, or failed", true);
  const auditPanel = panel("Audit", "Append-only operator facts", true);
  const [operations, audits] = await Promise.all([
    api("/v1/ops", "listOperations"),
    api("/v1/audit", "listAudit"),
  ]);
  historyPanel.body.replaceWith(table(items(operations), ["id", "type", "status", "target_id", "message", "created_at", "updated_at"]));
  auditPanel.body.replaceWith(table(items(audits), ["id", "operation_id", "operation_type", "target_id", "outcome", "created_at"]));
  grid.append(command.root, historyPanel.root, auditPanel.root);
  content.append(grid);
}

async function renderServer() {
  const grid = element("div", "grid");
  const [statusValue, settingsValue, onlineValue, mapValue, bansValue] = await Promise.all([
    api("/v1/server/status", "getServerStatus"),
    api("/v1/server/settings", "getServerSettings"),
    api("/v1/players/online", "listOnlinePlayers"),
    api("/v1/world/map", "getWorldMap"),
    api("/v1/bans", "listBans"),
  ]);
  const status = statusValue as JsonObject;
  const metrics = element("section", "metric-strip");
  metrics.append(
    metric("Runtime", status.ready ? "Ready" : "Pending"),
    metric("Online", status.online_player_count),
    metric("Known players", status.player_count),
    metric("Command queue", status.command_queue_depth),
  );
  grid.append(metrics);
  const settings = panel("Server settings", "Read-only runtime projection");
  settings.body.append(table([settingsValue as JsonObject], ["server_name", "description", "max_players", "public_port", "pvp_enabled"]));
  const online = panel("Online players", "Presence is operator-controlled");
  online.body.append(table(items(onlineValue), ["display_name", "player_id", "platform_id", "health", "position", "observed_at"], (record) => openPlayer(String(record.player_id ?? ""))));
  const mapPanel = panel("World map", "Live player positions", true);
  const map = element("div", "map");
  for (const player of items((mapValue as JsonObject).players)) {
    const position = object(player.position);
    const x = Number(position.x);
    const y = Number(position.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const marker = element("button", "marker") as HTMLButtonElement;
    marker.type = "button";
    marker.style.left = `${Math.max(2, Math.min(98, (x + 500000) / 1000000 * 100))}%`;
    marker.style.top = `${Math.max(2, Math.min(98, (500000 - y) / 1000000 * 100))}%`;
    marker.append(element("span", "", display(player.display_name ?? player.player_id)));
    marker.addEventListener("click", () => openPlayer(String(player.player_id ?? "")));
    map.append(marker);
  }
  if (!map.children.length) map.append(element("p", "empty map-empty", "No online positions are available."));
  mapPanel.body.replaceWith(map);
  const bans = panel("Bans", "Durable block-list projection", true);
  bans.body.append(table(items(bansValue), ["display_name", "player_id", "platform_id", "reason", "created_at", "expires_at"]));
  grid.append(settings.root, online.root, mapPanel.root, bans.root);
  content.append(grid);
}

function configInput(name: string, value: unknown, type = "text"): HTMLInputElement {
  const input = element("input") as HTMLInputElement;
  input.name = name;
  input.type = type;
  input.value = String(value ?? "");
  input.required = true;
  return input;
}

function changedConfigValues(before: unknown, after: unknown, path = ""): Array<{ path: string; before: unknown; after: unknown }> {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) {
    const left = before as JsonObject;
    const right = after as JsonObject;
    return [...new Set([...Object.keys(left), ...Object.keys(right)])]
      .sort()
      .flatMap((key) => changedConfigValues(left[key], right[key], path ? `${path}.${key}` : key));
  }
  return [{ path: path || "configuration", before, after }];
}

async function renderConfiguration() {
  const { body, response } = await apiResponse("/v1/config", "getConfig");
  const config = body as JsonObject;
  const etag = response.headers.get("etag") ?? "";
  const form = element("form", "config-form") as HTMLFormElement;
  const sections = element("div", "grid");
  const listen = object(config.listen);
  const storage = object(config.storage);
  const http = object(config.http);
  const listenPanel = panel("Listener", "Restart required after changes");
  listenPanel.body.classList.add("form-stack");
  listenPanel.body.append(
    labeled("Host", configInput("listen.host", listen.host)),
    labeled("Port", configInput("listen.port", listen.port, "number")),
  );
  const storagePanel = panel("Storage", "Restart required after changes");
  storagePanel.body.classList.add("form-stack");
  storagePanel.body.append(
    labeled("Active database", configInput("storage.active_database", storage.active_database)),
    labeled("Archive directory", configInput("storage.archive_directory", storage.archive_directory)),
  );
  const httpPanel = panel("HTTP", "Restart required after changes");
  httpPanel.body.classList.add("form-stack");
  httpPanel.body.append(
    labeled("Worker count", configInput("http.worker_count", http.worker_count, "number")),
    labeled("Queue capacity", configInput("http.queue_capacity", http.queue_capacity, "number")),
    labeled("Maximum body bytes", configInput("http.maximum_body_bytes", http.maximum_body_bytes, "number")),
  );
  const endpointPanel = panel("Endpoint access", "Public, Operator, or disabled", true);
  const endpointTools = element("div", "endpoint-tools");
  const endpointSearch = element("input") as HTMLInputElement;
  endpointSearch.type = "search";
  endpointSearch.placeholder = "Filter operation IDs";
  endpointSearch.setAttribute("aria-label", "Filter operation IDs");
  const endpointMode = element("select") as HTMLSelectElement;
  endpointMode.setAttribute("aria-label", "Filter endpoint access mode");
  for (const mode of ["all", "public", "operator", "disabled", "fixed"]) {
    const option = element("option", "", mode === "all" ? "All modes" : mode) as HTMLOptionElement;
    option.value = mode;
    endpointMode.append(option);
  }
  endpointTools.append(endpointSearch, endpointMode);
  const endpointList = element("div", "endpoint-ledger editable");
  for (const [operationId, currentMode] of Object.entries(object(config.endpoints)).sort(([left], [right]) => left.localeCompare(right))) {
    const policy = access(operationId);
    const row = element("label", "endpoint-row");
    row.dataset.operationId = operationId.toLowerCase();
    row.dataset.mode = String(currentMode);
    row.dataset.fixed = String(policy?.fixed === true);
    const code = element("code", "", operationId);
    const select = element("select") as HTMLSelectElement;
    select.name = `endpoint.${operationId}`;
    for (const mode of policy?.allowed_modes ?? ["operator", "disabled"] as AccessMode[]) {
      const option = element("option", "", mode) as HTMLOptionElement;
      option.value = mode;
      option.selected = mode === currentMode;
      select.append(option);
    }
    select.disabled = policy?.fixed === true;
    select.addEventListener("change", () => {
      row.dataset.mode = select.value;
      filterEndpoints();
    });
    row.append(code, select, element("small", "", policy?.fixed ? "Fixed" : "Configurable"));
    endpointList.append(row);
  }
  const filterEndpoints = () => {
    const query = endpointSearch.value.trim().toLowerCase();
    for (const row of endpointList.querySelectorAll<HTMLElement>(".endpoint-row")) {
      const modeMatches = endpointMode.value === "all" ||
        (endpointMode.value === "fixed" ? row.dataset.fixed === "true" : row.dataset.mode === endpointMode.value);
      row.hidden = !modeMatches || !String(row.dataset.operationId).includes(query);
    }
  };
  endpointSearch.addEventListener("input", filterEndpoints);
  endpointMode.addEventListener("change", filterEndpoints);
  endpointPanel.body.append(endpointTools, endpointList);
  const combatPanel = panel("Combat power", "One effect_type=weight per line", true);
  const weights = object(object(config.combat_power).weights);
  const weightEditor = element("textarea") as HTMLTextAreaElement;
  weightEditor.name = "combat.weights";
  weightEditor.rows = 12;
  weightEditor.value = Object.entries(weights).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join("\n");
  combatPanel.body.append(labeled("Passive weights", weightEditor, "Changes apply to new snapshots without a restart."));
  sections.append(listenPanel.root, storagePanel.root, httpPanel.root, endpointPanel.root, combatPanel.root);
  const rawPanel = panel("Advanced JSON", "Edit the complete source document directly", true);
  const rawMode = element("input") as HTMLInputElement;
  rawMode.type = "checkbox";
  const rawEditor = element("textarea") as HTMLTextAreaElement;
  rawEditor.rows = 22;
  rawEditor.value = JSON.stringify(config, null, 2);
  rawEditor.disabled = true;
  rawPanel.body.classList.add("form-stack");
  rawPanel.body.append(
    labeled("Use raw JSON editor", rawMode, "Structured controls are hidden while raw mode is active."),
    labeled("palops.json", rawEditor, "The complete document is validated before replacement."),
  );
  const diffPanel = panel("Change preview", "Compared with the ETag revision currently loaded", true);
  const diffPreview = element("pre", "code-block config-diff", "No changes.");
  diffPanel.body.append(diffPreview);
  const actions = element("div", "config-actions");
  const validate = element("button", "button", "Validate changes") as HTMLButtonElement;
  validate.type = "button";
  const save = element("button", "button primary", "Save palops.json") as HTMLButtonElement;
  save.type = "submit";
  actions.append(element("p", "config-revision", `Revision ${etag || "unavailable"}`), validate, save);
  form.append(sections, rawPanel.root, diffPanel.root, actions);

  const collect = (): JsonObject => {
    if (rawMode.checked) {
      const parsed = JSON.parse(rawEditor.value) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Raw palops.json must be a JSON object.");
      return parsed as JsonObject;
    }
    const data = new FormData(form);
    const document = structuredClone(config) as JsonObject;
    object(document.listen).host = String(data.get("listen.host"));
    object(document.listen).port = Number(data.get("listen.port"));
    object(document.storage).active_database = String(data.get("storage.active_database"));
    object(document.storage).archive_directory = String(data.get("storage.archive_directory"));
    object(document.http).worker_count = Number(data.get("http.worker_count"));
    object(document.http).queue_capacity = Number(data.get("http.queue_capacity"));
    object(document.http).maximum_body_bytes = Number(data.get("http.maximum_body_bytes"));
    for (const operationId of Object.keys(object(document.endpoints))) {
      const selected = form.elements.namedItem(`endpoint.${operationId}`) as HTMLSelectElement | null;
      if (selected) object(document.endpoints)[operationId] = selected.value;
    }
    const parsedWeights: JsonObject = {};
    for (const [index, line] of String(data.get("combat.weights") ?? "").split(/\r?\n/).entries()) {
      if (!line.trim()) continue;
      const separator = line.indexOf("=");
      const key = line.slice(0, separator).trim();
      const value = Number(line.slice(separator + 1).trim());
      if (separator < 1 || !key || !Number.isFinite(value)) throw new Error(`Weight line ${index + 1} must use effect_type=number.`);
      parsedWeights[key] = value;
    }
    object(document.combat_power).weights = parsedWeights;
    return document;
  };
  const updateDiff = () => {
    try {
      const changes = changedConfigValues(config, collect());
      diffPreview.textContent = changes.length
        ? changes.map((change) => `${change.path}\n  - ${JSON.stringify(change.before)}\n  + ${JSON.stringify(change.after)}`).join("\n")
        : "No changes.";
    } catch (error) {
      diffPreview.textContent = error instanceof Error ? error.message : String(error);
    }
  };
  rawMode.addEventListener("change", () => {
    sections.hidden = rawMode.checked;
    rawEditor.disabled = !rawMode.checked;
    updateDiff();
  });
  form.addEventListener("input", updateDiff);
  form.addEventListener("change", updateDiff);
  validate.addEventListener("click", async () => {
    try {
      const result = await api("/v1/config/validate", "validateConfig", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(collect()) }) as JsonObject;
      const restarts = Array.isArray(result.restart_required) ? result.restart_required.length : 0;
      showNotice(restarts ? `Configuration is valid. ${restarts} sections require a restart.` : "Configuration is valid and fully hot-reloadable.", "success");
    } catch (error) { showNotice(error instanceof Error ? error.message : String(error), "error"); }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    save.disabled = true;
    try {
      const result = await api("/v1/config", "updateConfig", { method: "PUT", headers: { "Content-Type": "application/json", "If-Match": etag }, body: JSON.stringify(collect()) }) as JsonObject;
      capabilities = { endpoints: {} };
      await loadCapabilities();
      const restarts = Array.isArray(result.restart_required) ? result.restart_required.map(String) : [];
      const appliedMessage = restarts.length
        ? `palops.json was replaced atomically. Restart required for: ${restarts.join(", ")}.`
        : "palops.json was replaced atomically. Live settings are active.";
      const auditRecorded = result.audit_recorded !== false;
      showNotice(
        auditRecorded
          ? appliedMessage
          : `${appliedMessage} Warning: the audit record could not be persisted.`,
        auditRecorded ? "success" : "info",
      );
      await render();
    } catch (error) { showNotice(error instanceof Error ? error.message : String(error), "error"); }
    finally { save.disabled = false; }
  });
  content.append(form);
}

async function renderApi() {
  if (!contractOperations.length) await loadContract();
  const openApi = await api("/v1/openapi.json", "getOpenApi") as JsonObject;
  const configExample = {
    version: 1,
    listen: { host: "127.0.0.1", port: 8222 },
    storage: { active_database: "data/palops.db", archive_directory: "data/archive" },
    http: { worker_count: 4, queue_capacity: 64, maximum_body_bytes: 16384 },
    endpoints: Object.fromEntries(Object.entries(capabilities.endpoints).map(([id, policy]) => [id, policy.mode])),
    combat_power: { policy_version: 1, weights: {} },
  };
  const examples: Record<string, JsonObject> = {
    kickPlayer: { player_id: "player-example", reason: "Operator request" },
    banPlayer: { player_id: "player-example", reason: "Operator request" },
    unbanPlayer: { player_id: "player-example" },
    messagePlayer: { player_id: "player-example", message: "Hello from PalOps" },
    givePlayerItems: { player_id: "player-example", items: [{ item_id: "Berry", quantity: 5 }] },
    givePlayerPals: { player_id: "player-example", pals: [{ pal_id: "SheepBall", level: 10, quantity: 1 }] },
    givePlayerPalEggs: { player_id: "player-example", eggs: [{ pal_id: "SheepBall", quantity: 1 }] },
    givePlayerExperience: { player_id: "player-example", amount: 1000 },
    givePlayerStatusPoints: { player_id: "player-example", amount: 1 },
    givePlayerRelics: { player_id: "player-example", relics: [{ relic_type: "CapturePower", amount: 1 }] },
    givePlayerTechnologyPoints: { player_id: "player-example", amount: 1 },
    givePlayerAncientTechnologyPoints: { player_id: "player-example", amount: 1 },
    learnPlayerTechnologies: { player_id: "player-example", technology_ids: ["Technology_001"] },
    forgetPlayerTechnologies: { player_id: "player-example", technology_ids: ["Technology_001"] },
    broadcastServerChat: { message: "Server maintenance begins soon." },
    alertServerPlayers: { message: "Return to a safe location." },
    saveServerWorld: {},
    shutdownServer: { delay_seconds: 30, message: "Server restarting." },
    updateConfig: configExample,
    validateConfig: configExample,
  };
  const samplePath = (path: string) => path
    .replace("{player_id}", "player-example")
    .replace("{guild_id}", "guild-example")
    .replace("{operation_id}", "operation-example");
  const curlExample = (operation: ContractOperation, mode: unknown) => {
    const body = examples[operation.operationId];
    const headers = [
      mode === "operator" ? "-u admin:$ADMIN_PASSWORD" : "",
      operation.mutation ? '-H "Idempotency-Key: unique-request-id"' : "",
      body ? '-H "Content-Type: application/json"' : "",
      operation.operationId === "updateConfig" ? '-H "If-Match: \\"cfg-current\\""' : "",
      body ? `-d '${JSON.stringify(body)}'` : "",
    ].filter(Boolean).join(" ");
    return `curl -X ${operation.method} ${headers} http://127.0.0.1:8222${samplePath(operation.pathTemplate)}`.replace(/\s+/g, " ");
  };
  const summary = element("section", "metric-strip");
  summary.append(
    metric("Operations", contractOperations.length),
    metric("Public", Object.values(capabilities.endpoints).filter((entry) => entry.mode === "public").length),
    metric("Operator", Object.values(capabilities.endpoints).filter((entry) => entry.mode === "operator").length),
    metric("Disabled", Object.values(capabilities.endpoints).filter((entry) => entry.mode === "disabled").length),
  );
  const reference = panel("Endpoint reference", "Generated from the bundled OpenAPI document", true);
  const records = contractOperations.map((operation) => ({
    method: operation.method,
    path: operation.pathTemplate,
    operation_id: operation.operationId,
    access: access(operation.operationId)?.mode ?? "unknown",
    summary: operation.summary,
    example: examples[operation.operationId] ? JSON.stringify(examples[operation.operationId]) : "Read request",
  }));
  reference.body.append(table(records, ["method", "path", "operation_id", "access", "summary", "example"], (record) => {
    const operation = contractOperations.find((entry) => entry.operationId === record.operation_id);
    if (!operation) return;
    void navigator.clipboard.writeText(curlExample(operation, record.access))
      .then(() => showNotice(`Copied a curl example for ${record.operation_id}.`, "success"))
      .catch(() => showNotice("Clipboard access was denied by the browser.", "error"));
  }));
  const contractPanel = panel("OpenAPI 3.1", `${display(object(openApi.info).title)} ${display(object(openApi.info).version)}`, true);
  const contractDetails = element("details", "contract-details");
  contractDetails.append(element("summary", "", "View the exact embedded contract"));
  contractDetails.append(element("pre", "code-block", JSON.stringify(openApi, null, 2)));
  contractPanel.body.append(contractDetails);
  const problems = panel("Stable problem details", "Every problem includes code, detail, status, and correlation_id", true);
  problems.body.append(table([
    { status: 400, code: "INVALID_REQUEST", meaning: "Malformed or semantically invalid request" },
    { status: 401, code: "UNAUTHENTICATED", meaning: "AdminPassword is required or invalid" },
    { status: 404, code: "NOT_FOUND", meaning: "Unknown, missing, or disabled operation/resource" },
    { status: 409, code: "PLAYER_OFFLINE", meaning: "The target must be online" },
    { status: 409, code: "IDEMPOTENCY_CONFLICT", meaning: "The key was consumed by another request/world" },
    { status: 412, code: "CONFIG_REVISION_MISMATCH", meaning: "palops.json changed after it was read" },
    { status: 422, code: "CONFIG_INVALID", meaning: "The complete configuration candidate was rejected" },
    { status: 429, code: "AUTH_RATE_LIMITED", meaning: "Authentication backoff is active" },
    { status: 503, code: "RUNTIME_UNAVAILABLE", meaning: "Palworld cannot serve the requested operation" },
  ], ["status", "code", "meaning"]));
  const note = element("p", "api-note", "Select any endpoint row to copy a schema-valid curl example. This view never executes arbitrary requests.");
  content.append(summary, note, contractPanel.root, problems.root, reference.root);
}

async function render() {
  clear(content);
  showNotice();
  byId("view-title").textContent = views[activeView].title;
  byId("view-kicker").textContent = views[activeView].kicker;
  content.append(element("div", "loading", "Loading current state"));
  try {
    if (!Object.keys(capabilities.endpoints).length) await loadCapabilities();
    clear(content);
    if (activeView === "leaderboards") await renderLeaderboards();
    else if (activeView === "players") await renderPlayers();
    else if (activeView === "operations") await renderOperations();
    else if (activeView === "server") await renderServer();
    else if (activeView === "configuration") await renderConfiguration();
    else await renderApi();
  } catch (error) {
    clear(content);
    content.append(element("div", "error-state", error instanceof Error ? error.message : String(error)));
  }
}

byId("tabs").addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-view]");
  if (!button) return;
  activateView(button.dataset.view as View);
  void render();
});
byId("refresh-button").addEventListener("click", () => { capabilities = { endpoints: {} }; void render(); void updateWorld(); });
byId("login-button").addEventListener("click", async () => {
  if (authenticated) {
    await fetch("/api/session", { method: "DELETE" });
    await loadSession();
    await render();
  } else loginDialog.showModal();
});
byId("cancel-login").addEventListener("click", () => loginDialog.close());
byId("login-dialog").querySelector(".close-button")?.addEventListener("click", () => loginDialog.close());
byId<HTMLFormElement>("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = byId("login-error");
  error.hidden = true;
  const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: byId<HTMLInputElement>("password").value }) });
  const body = await response.json() as JsonObject;
  if (!response.ok) { error.textContent = errorMessage(body, response.status); error.hidden = false; return; }
  byId<HTMLInputElement>("password").value = "";
  loginDialog.close();
  await loadSession();
  await render();
  await updateWorld();
});
const themeButton = byId("theme-button");
const stored = localStorage.getItem("palworld-mods-theme");
document.documentElement.dataset.theme = stored === "light" ? "light" : "dark";
function themeLabel() {
  const dark = document.documentElement.dataset.theme === "dark";
  themeButton.textContent = dark ? "LT" : "DK";
  themeButton.setAttribute("aria-label", `Use ${dark ? "light" : "dark"} theme`);
}
themeLabel();
themeButton.addEventListener("click", () => {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("palworld-mods-theme", document.documentElement.dataset.theme);
  themeLabel();
});

const hash = decodeURIComponent(location.hash.slice(1));
if (hash.startsWith("players/")) { activeView = "players"; selectedPlayerId = hash.slice("players/".length); }
else if (hash in views) activeView = hash as View;
document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", (item as HTMLElement).dataset.view === activeView));
await loadSession();
await loadCapabilities();
await Promise.all([updateWorld(), loadContract()]);
await render();
