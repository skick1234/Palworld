import {
  effectLabel,
  nonZeroRelics,
  roundedCombatPower,
  scoredPassiveContributions,
} from "./player-detail";

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
  overview: { title: "Overview", kicker: "Command center", summary: "The current world snapshot, rankings, and operator attention in one place." },
  leaderboards: { title: "Rankings", kicker: "World competition", summary: "Compare players, Party Pals, and guilds from the latest complete server snapshot." },
  players: { title: "Players", kicker: "Player directory", summary: "Find a player, inspect their public progression, and open operator tools when authorized." },
  operations: { title: "Operations", kicker: "Operator actions", summary: "Create durable server actions and follow every request through completion." },
  server: { title: "World", kicker: "Live server state", summary: "Monitor runtime health, online players, positions, settings, and active bans." },
  configuration: { title: "Settings", kicker: "PalOps configuration", summary: "Review, validate, and apply the complete PalOps configuration safely." },
  api: { title: "API", kicker: "Developer reference", summary: "Inspect the exact contract, endpoint access, examples, and stable problem responses." },
} as const;
type View = keyof typeof views;
type RankingCategory = "players" | "pals" | "guilds";
const operatorViews = new Set<View>(["operations", "server", "configuration"]);

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
const viewSelect = byId<HTMLSelectElement>("view-select");
let activeView: View = "overview";
let selectedPlayerId = "";
let authenticated = false;
let capabilities: Capabilities = { endpoints: {} };
let contractOperations: ContractOperation[] = [];
let rankingCategory: RankingCategory = "players";
let renderEpoch = 0;

function element<K extends keyof HTMLElementTagNameMap>(name: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
function clear(node: HTMLElement) { node.replaceChildren(); }
function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value && typeof value === "object" && typeof (value as JsonObject).value === "number") {
    const numeric = (value as { value: number }).value;
    const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(numeric);
    return (value as JsonObject).complete === false ? `${formatted} (partial)` : formatted;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function displayField(key: string, value: unknown): string {
  if (key === "complete" && typeof value === "boolean") return value ? "Complete" : "Partial";
  if (key === "combat_power" || key === "team_combat_power") {
    return display(roundedCombatPower(value));
  }
  if ((key.endsWith("_at") || key === "observed_at") && typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString();
  }
  return display(value);
}
function relativeTime(value: unknown): string {
  if (typeof value !== "string") return "Snapshot time unavailable";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "Snapshot time unavailable";
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(time).toLocaleDateString();
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
function syncNavigation() {
  viewSelect.value = activeView;
  document.querySelectorAll<HTMLButtonElement>(".nav-item").forEach((item) => {
    const selected = item.dataset.view === activeView;
    item.classList.toggle("active", selected);
    if (selected) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
    const target = item.dataset.view as View;
    const locked = operatorViews.has(target) && !authenticated;
    item.dataset.locked = String(locked);
    item.setAttribute("aria-description", locked ? "Operator login required" : "");
  });
}
function activateView(view: View, preservePlayer = false, pushHistory = true) {
  activeView = view;
  if (view !== "players" && !preservePlayer) selectedPlayerId = "";
  syncNavigation();
  if (pushHistory) history.pushState(null, "", `#${view}`);
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
function definitionGrid(
  entries: Array<{ label: string; value: unknown; note?: string }>,
  className = "",
): HTMLElement {
  const root = element("dl", `definition-grid${className ? ` ${className}` : ""}`);
  for (const entry of entries) {
    const item = element("div", "definition-item");
    item.append(element("dt", "", entry.label), element("dd", "", display(entry.value)));
    if (entry.note) item.append(element("small", "", entry.note));
    root.append(item);
  }
  return root;
}
function signedNumber(value: unknown, suffix = ""): string {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Math.abs(numeric));
  return `${numeric > 0 ? "+" : numeric < 0 ? "-" : ""}${formatted}${suffix}`;
}
function passiveEffects(value: unknown): HTMLElement {
  const effects = scoredPassiveContributions(items(value));
  if (!effects.length) return element("p", "pal-effect-empty", "No effects change this Pal's Combat Power.");

  const details = element("details", "pal-effects");
  const summary = element("summary");
  summary.append(
    element("span", "", "Combat effects"),
    element("strong", "", String(effects.length)),
  );
  const list = element("div", "effect-list");
  for (const effect of effects) {
    const type = typeof effect.effect_type === "string" ? effect.effect_type : "";
    const core = type === "MaxHP" || type === "ShotAttack" || type === "Defense";
    const row = element("div", "effect-row");
    row.append(
      element("strong", "", effectLabel(type)),
      element("span", "", signedNumber(effect.effect_value, "%")),
      element("small", "", core ? "Core stat" : signedNumber(effect.points, " pts")),
    );
    list.append(row);
  }
  details.append(summary, list);
  return details;
}
function table(records: JsonObject[], preferred: string[] = [], onSelect?: (record: JsonObject) => void): HTMLElement {
  if (!records.length) return element("p", "empty", "No records are available for this snapshot.");
  const visibleRecords = records.slice(0, 250);
  const keys = (preferred.length
    ? preferred.filter((key) => records.some((row) => key in row))
    : Object.keys(records[0]).filter((key) => typeof records[0][key] !== "object")).slice(0, 10);
  const wrap = element("div", "table-wrap");
  const tableNode = element("table", "data-table");
  const head = element("thead");
  const headRow = element("tr");
  for (const key of keys) headRow.append(element("th", "", key.replaceAll("_", " ")));
  head.append(headRow);
  const body = element("tbody");
  for (const record of visibleRecords) {
    const row = element("tr", onSelect ? "selectable" : "");
    if (onSelect) {
      row.tabIndex = 0;
      row.setAttribute("aria-label", `Open ${display(record.display_name ?? record.name ?? record.id ?? "record")}`);
      row.addEventListener("click", () => onSelect(record));
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(record);
        }
      });
    }
    for (const key of keys) {
      const value = displayField(key, record[key]);
      const cell = element("td", "", value);
      cell.dataset.label = key.replaceAll("_", " ");
      if (typeof record[key] === "number" || score(record[key]) !== 0) cell.classList.add("numeric");
      cell.title = value;
      row.append(cell);
    }
    body.append(row);
  }
  tableNode.append(head, body);
  wrap.append(tableNode);
  if (records.length > visibleRecords.length) wrap.append(element("p", "table-limit", `Showing the first ${visibleRecords.length} of ${records.length} records. Use search or filters to narrow the result.`));
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
  byId("session-label").textContent = authenticated && state.expires_at ? `Operator until ${new Date(state.expires_at).toLocaleTimeString()}` : "Public access";
  byId("login-button").textContent = authenticated ? "Log out" : "Operator login";
  syncNavigation();
}
async function updateWorld() {
  try {
    const health = await api("/health", "getHealth") as JsonObject;
    const ready = health.ready === true;
    byId("world-dot").classList.toggle("ready", ready);
    byId("world-dot").classList.remove("error");
    if (authenticated && access("getServerStatus")?.mode !== "disabled") {
      const status = await api("/v1/server/status", "getServerStatus") as JsonObject;
      byId("world-label").textContent = display(status.world_label ?? (ready ? "World ready" : "Runtime pending"));
      byId("world-detail").textContent = `${display(status.online_player_count)} online, snapshot ${display(status.snapshot_revision)}`;
    } else {
      byId("world-label").textContent = ready ? "PalOps ready" : "PalOps needs attention";
      byId("world-detail").textContent = authenticated ? "Live world status is disabled" : "Login for live world status";
    }
  } catch (error) {
    byId("world-dot").classList.remove("ready");
    byId("world-dot").classList.add("error");
    byId("world-label").textContent = "PalOps unavailable";
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

type RankingData = { players: JsonObject[]; pals: JsonObject[]; guilds: JsonObject[] };

async function loadRankings(): Promise<RankingData> {
  const results = await Promise.all([
    api("/v1/leaderboards/players", "listPlayerLeaderboard"),
    api("/v1/leaderboards/pals", "listPalLeaderboard"),
    api("/v1/leaderboards/guilds", "listGuildLeaderboard"),
  ]);
  return {
    players: items(results[0]).sort((a, b) => score(b.team_combat_power) - score(a.team_combat_power)),
    pals: items(results[1]).sort((a, b) => score(b.combat_power) - score(a.combat_power)),
    guilds: items(results[2]).sort((a, b) => score(b.combat_power) - score(a.combat_power)),
  };
}

function rankingName(category: RankingCategory, record: JsonObject): string {
  if (category === "players") return display(record.display_name);
  if (category === "pals") return display(record.display_name || record.species);
  return display(record.name);
}

function rankingScore(category: RankingCategory, record: JsonObject): unknown {
  return category === "players" ? record.team_combat_power : record.combat_power;
}

function rankingMeta(category: RankingCategory, record: JsonObject): string {
  if (category === "players") return [record.guild_name, record.level ? `Level ${record.level}` : ""].filter(Boolean).join(" | ") || "Independent player";
  if (category === "pals") return [record.species, record.owner_display_name].filter(Boolean).join(" | ");
  return `${display(record.member_count)} members`;
}

function rankingComplete(category: RankingCategory, record: JsonObject): boolean {
  return record.complete !== false && object(rankingScore(category, record)).complete !== false;
}

function rankingTable(category: RankingCategory, records: JsonObject[]): HTMLElement {
  if (!records.length) return element("div", "empty-state", "No ranked records match this search.");
  const wrap = element("div", "table-wrap");
  const tableNode = element("table", "data-table ranking-table");
  const head = element("thead");
  const headRow = element("tr");
  const labels = category === "players"
    ? ["Rank", "Player", "Guild", "Level", "Combat power", "Status"]
    : category === "pals"
      ? ["Rank", "Party Pal", "Species", "Owner", "Level", "Combat power"]
      : ["Rank", "Guild", "Members", "Firepower", "Combat power", "Status"];
  const optionalLabels = new Set(["Guild", "Level", "Species", "Owner", "Members", "Firepower"]);
  labels.forEach((label) => {
    const cell = element("th", optionalLabels.has(label) ? "optional-column" : "", label);
    if (label === "Status") cell.classList.add("ranking-status-column");
    if (label.includes("power") || label === "Level" || label === "Members" || label === "Firepower") cell.classList.add("numeric");
    headRow.append(cell);
  });
  head.append(headRow);
  const body = element("tbody");
  records.forEach((record, index) => {
    const row = element("tr", category === "guilds" ? "" : "selectable");
    const open = category === "players"
      ? () => openPlayer(String(record.player_id ?? ""))
      : category === "pals"
        ? () => openPlayer(String(record.owner_player_id ?? ""))
        : null;
    if (open) {
      row.tabIndex = 0;
      row.setAttribute("aria-label", `Open ${rankingName(category, record)}`);
      row.addEventListener("click", open);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    }
    row.append(element("td", "rank-cell", `#${display(record.__rank ?? index + 1)}`), element("td", "identity-cell", rankingName(category, record)));
    if (category === "players") {
      row.append(
        element("td", "optional-column", display(record.guild_name)),
        element("td", "optional-column numeric", display(record.level)),
        element("td", "score-cell numeric", display(roundedCombatPower(record.team_combat_power))),
      );
    } else if (category === "pals") {
      row.append(
        element("td", "optional-column", display(record.species)),
        element("td", "optional-column", display(record.owner_display_name)),
        element("td", "optional-column numeric", display(record.level)),
        element("td", "score-cell numeric", display(roundedCombatPower(record.combat_power))),
      );
    } else {
      row.append(
        element("td", "optional-column numeric", display(record.member_count)),
        element("td", "optional-column numeric", display(record.firepower)),
        element("td", "score-cell numeric", display(roundedCombatPower(record.combat_power))),
      );
    }
    if (category !== "pals") {
      const status = element("span", `status-label${rankingComplete(category, record) ? "" : " partial"}`, rankingComplete(category, record) ? "Complete" : "Partial");
      const statusCell = element("td", "ranking-status-column");
      statusCell.append(status);
      row.append(statusCell);
    }
    body.append(row);
  });
  tableNode.append(head, body);
  wrap.append(tableNode);
  return wrap;
}

function podium(category: RankingCategory, records: JsonObject[]): HTMLElement {
  const root = element("section", "podium");
  if (!records.length) return root;
  const winner = element("article", "podium-winner");
  const winnerTop = element("div");
  winnerTop.append(element("span", "podium-rank", "World number one"), element("div", "podium-name", rankingName(category, records[0])));
  const scoreLine = element("div", "podium-score", display(roundedCombatPower(rankingScore(category, records[0]))));
  scoreLine.append(element("small", "", "combat power"));
  const winnerBottom = element("div");
  winnerBottom.append(scoreLine, element("p", "empty", rankingMeta(category, records[0])));
  winner.append(winnerTop, winnerBottom);
  const rest = element("div", "podium-rest");
  records.slice(1, 3).forEach((record, index) => {
    const card = element("article", "podium-card");
    const copy = element("div");
    copy.append(element("strong", "", rankingName(category, record)), element("small", "", `${display(roundedCombatPower(rankingScore(category, record)))} combat power`));
    card.append(element("span", "podium-number", `0${index + 2}`), copy);
    rest.append(card);
  });
  root.append(winner, rest);
  return root;
}

function latestRankingObservation(data: RankingData): unknown {
  return [...data.players, ...data.pals, ...data.guilds]
    .map((record) => record.observed_at)
    .filter((value): value is string => typeof value === "string")
    .sort()
    .at(-1);
}

async function renderOverview(epoch: number) {
  const [healthValue, rankings, statusValue, operationsValue] = await Promise.all([
    api("/health", "getHealth"),
    loadRankings(),
    authenticated ? api("/v1/server/status", "getServerStatus").catch(() => null) : Promise.resolve(null),
    authenticated ? api("/v1/ops", "listOperations").catch(() => null) : Promise.resolve(null),
  ]);
  if (epoch !== renderEpoch) return;
  const health = healthValue as JsonObject;
  const status = statusValue as JsonObject | null;
  const grid = element("div", "grid");
  const hero = element("section", "overview-hero");
  const heroCopy = element("div");
  heroCopy.append(
    element("p", "eyebrow", health.ready === true ? "World data available" : "PalOps needs attention"),
    element("h2", "", authenticated ? "Run the world from one clear view." : "See who leads. Log in only when you need control."),
    element("p", "", authenticated
      ? "Health, rankings, current load, and durable operations stay visible without digging through API-shaped screens."
      : "Public rankings stay available without exposing privileged world state or operator controls."),
  );
  const heroActions = element("footer");
  const rankingsButton = element("button", "button primary", "Open rankings") as HTMLButtonElement;
  rankingsButton.addEventListener("click", () => { activateView("leaderboards"); void render(); });
  const secondaryButton = element("button", "button", authenticated ? "Open world" : "Operator login") as HTMLButtonElement;
  secondaryButton.addEventListener("click", () => {
    if (authenticated) { activateView("server"); void render(); }
    else byId<HTMLButtonElement>("login-button").click();
  });
  heroActions.append(rankingsButton, secondaryButton);
  hero.append(heroCopy, heroActions);

  const attention = element("aside", "attention-panel");
  attention.append(element("p", "eyebrow", "Attention"), element("h2", "", authenticated ? "Operator state" : "Public access"));
  const attentionList = element("div", "attention-list");
  const attentionRows = [
    { title: health.ready === true ? "PalOps is ready" : "Runtime is not ready", detail: health.restart_required === true ? "A restart is required." : "Configuration is active." },
    { title: `Snapshot ${relativeTime(latestRankingObservation(rankings))}`, detail: `${rankings.players.length} players are currently ranked.` },
    authenticated
      ? { title: `${display(status?.online_player_count)} players online`, detail: `${display(status?.command_queue_depth)} commands waiting.` }
      : { title: "Operator controls are locked", detail: "Login only when you need private state or server actions." },
  ];
  attentionRows.forEach(({ title, detail }) => {
    const item = element("div", "attention-item");
    const copy = element("div");
    copy.append(element("strong", "", title), element("small", "", detail));
    item.append(element("span", "attention-marker"), copy);
    attentionList.append(item);
  });
  attention.append(attentionList);
  grid.append(hero, attention);

  const metrics = element("section", "metric-strip");
  metrics.append(
    metric("Ranked players", rankings.players.length, `Snapshot ${relativeTime(latestRankingObservation(rankings))}`),
    metric("Top player", rankings.players[0]?.display_name ?? "-", display(roundedCombatPower(rankings.players[0]?.team_combat_power))),
    metric("Top Party Pal", rankings.pals[0]?.display_name ?? rankings.pals[0]?.species ?? "-", display(roundedCombatPower(rankings.pals[0]?.combat_power))),
    metric(authenticated ? "Online now" : "Top guild", authenticated ? status?.online_player_count : rankings.guilds[0]?.name ?? "-", authenticated ? `${display(status?.player_count)} known players` : display(roundedCombatPower(rankings.guilds[0]?.combat_power))),
  );
  grid.append(metrics);

  const leaders = panel("Leading players", "Latest team combat power", true);
  leaders.body.replaceWith(rankingTable("players", rankings.players.slice(0, 5)));
  grid.append(leaders.root);
  if (authenticated && operationsValue) {
    const recent = panel("Recent operations", "Newest durable server actions", true);
    recent.body.replaceWith(table(items(operationsValue).slice(0, 6), ["type", "status", "target_id", "message", "created_at"]));
    grid.append(recent.root);
  }
  content.append(grid);
}

async function renderLeaderboards(epoch: number) {
  const data = await loadRankings();
  if (epoch !== renderEpoch) return;
  const shell = element("div", "ranking-shell");
  const toolbar = element("section", "ranking-toolbar");
  const tabs = element("div", "ranking-tabs");
  const categoryLabels: Record<RankingCategory, string> = { players: "Players", pals: "Party Pals", guilds: "Guilds" };
  for (const category of Object.keys(categoryLabels) as RankingCategory[]) {
    const button = element("button", `ranking-tab${category === rankingCategory ? " active" : ""}`, categoryLabels[category]) as HTMLButtonElement;
    button.type = "button";
    button.dataset.category = category;
    tabs.append(button);
  }
  const search = element("input") as HTMLInputElement;
  search.type = "search";
  search.placeholder = "Name, guild, species, or owner";
  const searchLabel = element("label", "ranking-search");
  searchLabel.append(element("span", "", "Filter this ranking"), search);
  toolbar.append(tabs, searchLabel);
  const podiumHost = element("div");
  const listPanel = panel("Rankings", "Latest snapshot", true);
  const renderCategory = () => {
    const records = data[rankingCategory];
    const rankedRecords = records.map((record, index) => ({ ...record, __rank: index + 1 }));
    const query = search.value.trim().toLowerCase();
    const filtered = query
      ? rankedRecords.filter((record) => Object.values(record).some((value) => typeof value === "string" && value.toLowerCase().includes(query)))
      : rankedRecords;
    const visible = filtered.slice(0, 100);
    clear(podiumHost);
    podiumHost.append(podium(rankingCategory, records));
    listPanel.root.querySelector("h2")!.textContent = categoryLabels[rankingCategory];
    listPanel.root.querySelector("small")!.textContent = `${filtered.length} ranked${filtered.length > visible.length ? ` | showing ${visible.length}` : ""} | snapshot ${relativeTime(records[0]?.observed_at)}`;
    clear(listPanel.body);
    listPanel.body.append(rankingTable(rankingCategory, visible));
  };
  tabs.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-category]");
    if (!button) return;
    rankingCategory = button.dataset.category as RankingCategory;
    tabs.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    search.value = "";
    renderCategory();
  });
  search.addEventListener("input", renderCategory);
  renderCategory();
  shell.append(toolbar, podiumHost, listPanel.root);
  content.append(shell);
}

function openPlayer(id: string) {
  if (!id) return;
  selectedPlayerId = id;
  activeView = "players";
  history.pushState(null, "", `#players/${encodeURIComponent(id)}`);
  syncNavigation();
  void render();
}

async function renderPlayers(epoch: number) {
  if (selectedPlayerId) return renderPlayerDetail(selectedPlayerId, epoch);
  const players = items(await api("/v1/players", "listPlayers")).map(flattenedPlayer);
  if (epoch !== renderEpoch) return;
  const toolbar = element("div", "list-toolbar");
  const search = element("input") as HTMLInputElement;
  search.type = "search";
  search.placeholder = "Search name, guild, or player ID";
  const searchLabel = labeled("Search players", search, "Matches display name, guild, or opaque player ID.");
  const count = element("span", "result-count", `${players.length} players`);
  toolbar.append(searchLabel, count);
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

async function renderPlayerDetail(playerId: string, epoch: number) {
  const [detailValue, presenceValue, operationsValue] = await Promise.all([
    api(`/v1/players/${encodeURIComponent(playerId)}`, "getPlayer"),
    api(`/v1/players/${encodeURIComponent(playerId)}/presence`, "getPlayerPresence").catch(() => null),
    authenticated
      ? api("/v1/ops", "listOperations").catch(() => null)
      : Promise.resolve(null),
  ]);
  if (epoch !== renderEpoch) return;
  byId("view-kicker").textContent = "Player detail";
  const detail = detailValue as JsonObject;
  const presence = presenceValue as JsonObject | null;
  byId("view-title").textContent = display(detail.display_name);
  byId("view-summary").textContent = `Public progression and current Party Pals for ${display(detail.display_name)}.`;
  const actions = element("div", "detail-actions");
  const back = element("button", "button", "Back to players") as HTMLButtonElement;
  back.addEventListener("click", () => { selectedPlayerId = ""; history.pushState(null, "", "#players"); void render(); });
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
    metric("Team combat power", roundedCombatPower(scores.team_combat_power)),
  );
  const grid = element("div", "grid");
  const overview = panel("Profile", String(detail.id ?? ""));
  const profileEntries: Array<{ label: string; value: unknown; note?: string }> = [
    { label: "Guild", value: detail.guild_name },
    { label: "Snapshot", value: detail.complete === true ? "Complete" : "Partial" },
    { label: "Observed", value: displayField("observed_at", detail.observed_at) },
  ];
  if (presence) {
    profileEntries.splice(1, 0,
      { label: "Online", value: presence.online },
      { label: "Health", value: presence.health },
      { label: "Platform ID", value: presence.platform_id },
    );
  } else {
    profileEntries.splice(1, 0, {
      label: "Live state",
      value: "Restricted",
      note: "Operator login required",
    });
  }
  overview.body.append(definitionGrid(profileEntries));
  const stats = panel("Statistics", "Counts only, no private inventories");
  const statistics = object(detail.statistics);
  stats.body.append(definitionGrid([
    { label: "Experience", value: statistics.experience },
    { label: "Boss defeats", value: statistics.boss_defeats },
    { label: "Pal captures", value: statistics.pal_captures },
    { label: "Fishing", value: statistics.fishing },
    { label: "Inventory items", value: counts.inventory_items },
    { label: "Technologies", value: counts.unlocked_technologies },
  ], "statistics-grid"));
  const relics = panel("Relics", "Only earned relics", true);
  const relicRows = nonZeroRelics(object(detail.relic_counts));
  if (relicRows.length) {
    relics.body.append(definitionGrid(
      relicRows.map((relic) => ({ label: relic.relic_type, value: relic.count })),
      "relic-grid",
    ));
  } else {
    relics.body.append(element("p", "empty", "No earned relics were reported in this snapshot."));
  }
  const party = panel("Party Pals", "Current five-slot party", true);
  const partyGrid = element("div", "party-grid");
  for (const pal of items(detail.party_pals)) {
    const card = element("article", "party-pal");
    const heading = element("header");
    const identity = element("div", "pal-identity");
    identity.append(
      element("strong", "", display(pal.display_name || pal.species)),
      element("small", "", display(pal.species)),
    );
    heading.append(identity, element("span", "pal-level", `Level ${display(pal.level)}`));
    const body = element("div", "pal-body");
    const scores = element("div", "pal-scoreboard");
    const combatScore = element("div", "pal-score primary");
    combatScore.append(element("span", "", "Combat Power"), element("strong", "", display(roundedCombatPower(pal.combat_power))));
    const firepowerScore = element("div", "pal-score");
    firepowerScore.append(element("span", "", "Firepower"), element("strong", "", display(pal.firepower)));
    scores.append(combatScore, firepowerScore);
    body.append(
      scores,
      definitionGrid([
        { label: "Maximum HP", value: pal.max_hp },
        { label: "Shot attack", value: pal.shot_attack },
        { label: "Defense", value: pal.defense },
        { label: "Condenser", value: `${display(pal.condenser_rank)} / 4` },
      ], "pal-stat-grid"),
      passiveEffects(pal.passives),
    );
    card.append(heading, body);
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

async function renderOperations(epoch: number) {
  const grid = element("div", "grid");
  const command = panel("Create operation", "All requests are durable and idempotent");
  command.body.append(operationComposer());
  const historyPanel = panel("Operation history", "Accepted, completed, partially completed, or failed", true);
  const auditPanel = panel("Audit", "Append-only operator facts", true);
  const [operations, audits] = await Promise.all([
    api("/v1/ops", "listOperations"),
    api("/v1/audit", "listAudit"),
  ]);
  if (epoch !== renderEpoch) return;
  historyPanel.body.replaceWith(table(items(operations), ["id", "type", "status", "target_id", "message", "created_at", "updated_at"]));
  auditPanel.body.replaceWith(table(items(audits), ["id", "operation_id", "operation_type", "target_id", "outcome", "created_at"]));
  grid.append(command.root, historyPanel.root, auditPanel.root);
  content.append(grid);
}

async function renderServer(epoch: number) {
  const grid = element("div", "grid");
  const [statusValue, settingsValue, onlineValue, mapValue, bansValue] = await Promise.all([
    api("/v1/server/status", "getServerStatus"),
    api("/v1/server/settings", "getServerSettings"),
    api("/v1/players/online", "listOnlinePlayers"),
    api("/v1/world/map", "getWorldMap"),
    api("/v1/bans", "listBans"),
  ]);
  if (epoch !== renderEpoch) return;
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

async function renderConfiguration(epoch: number) {
  const { body, response } = await apiResponse("/v1/config", "getConfig");
  if (epoch !== renderEpoch) return;
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

async function renderApi(epoch: number) {
  if (!contractOperations.length) await loadContract();
  const openApi = await api("/v1/openapi.json", "getOpenApi") as JsonObject;
  if (epoch !== renderEpoch) return;
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

function loadingState(): HTMLElement {
  const root = element("div", "loading-state");
  root.setAttribute("role", "status");
  root.setAttribute("aria-label", "Loading current state");
  root.append(element("div", "skeleton skeleton-heading"), element("div", "skeleton skeleton-metrics"), element("div", "skeleton skeleton-panel"));
  return root;
}

function lockedState(): HTMLElement {
  const root = element("section", "locked-state");
  const copy = element("div", "state-copy");
  copy.append(
    element("span", "state-code", "Operator access"),
    element("h2", "", `${views[activeView].title} is protected`),
    element("p", "", "Use the server AdminPassword to open live world data and server controls. Public rankings remain available without a login."),
  );
  const actions = element("div", "state-actions");
  const login = element("button", "button primary", "Operator login") as HTMLButtonElement;
  login.addEventListener("click", () => byId<HTMLButtonElement>("login-button").click());
  const rankings = element("button", "button", "Back to rankings") as HTMLButtonElement;
  rankings.addEventListener("click", () => { activateView("leaderboards"); void render(); });
  actions.append(login, rankings);
  copy.append(actions);
  root.append(copy);
  return root;
}

function errorState(error: unknown): HTMLElement {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = /unable to connect|failed to fetch|network/i.test(rawMessage)
    ? "The dashboard cannot reach PalOps. Confirm the API is running, then try again."
    : rawMessage;
  const root = element("section", "error-state");
  const copy = element("div", "state-copy");
  copy.append(
    element("span", "state-code", "Connection failed"),
    element("h2", "", "PalOps could not load this view"),
    element("p", "", message || "The dashboard did not receive a usable response."),
  );
  const actions = element("div", "state-actions");
  const retry = element("button", "button primary", "Try again") as HTMLButtonElement;
  retry.addEventListener("click", () => { capabilities = { endpoints: {} }; void render(); void updateWorld(); });
  const secondaryView: View = activeView === "leaderboards" ? "overview" : "leaderboards";
  const secondary = element("button", "button", secondaryView === "overview" ? "Open overview" : "Open rankings") as HTMLButtonElement;
  secondary.addEventListener("click", () => { activateView(secondaryView); void render(); });
  actions.append(retry, secondary);
  copy.append(actions);
  root.append(copy);
  return root;
}

async function render() {
  const epoch = ++renderEpoch;
  const refreshButton = byId<HTMLButtonElement>("refresh-button");
  refreshButton.hidden = false;
  refreshButton.disabled = true;
  clear(content);
  showNotice();
  byId("view-title").textContent = views[activeView].title;
  byId("view-kicker").textContent = views[activeView].kicker;
  byId("view-summary").textContent = views[activeView].summary;
  syncNavigation();
  if (operatorViews.has(activeView) && !authenticated) {
    content.append(lockedState());
    byId("last-updated").textContent = "Operator login required";
    refreshButton.hidden = true;
    refreshButton.disabled = false;
    return;
  }
  content.append(loadingState());
  try {
    if (!Object.keys(capabilities.endpoints).length) await loadCapabilities();
    if (epoch !== renderEpoch) return;
    clear(content);
    if (activeView === "overview") await renderOverview(epoch);
    else if (activeView === "leaderboards") await renderLeaderboards(epoch);
    else if (activeView === "players") await renderPlayers(epoch);
    else if (activeView === "operations") await renderOperations(epoch);
    else if (activeView === "server") await renderServer(epoch);
    else if (activeView === "configuration") await renderConfiguration(epoch);
    else await renderApi(epoch);
    if (epoch === renderEpoch) byId("last-updated").textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch (error) {
    if (epoch !== renderEpoch) return;
    clear(content);
    content.append(errorState(error));
    byId("last-updated").textContent = "Refresh failed";
  } finally {
    if (epoch === renderEpoch) refreshButton.disabled = false;
  }
}

function navigateFromLocation() {
  const hash = decodeURIComponent(location.hash.slice(1));
  selectedPlayerId = "";
  if (hash.startsWith("players/")) {
    activeView = "players";
    selectedPlayerId = hash.slice("players/".length);
  } else if (hash in views) activeView = hash as View;
  else activeView = "overview";
  syncNavigation();
}

byId("tabs").addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-view]");
  if (!button) return;
  activateView(button.dataset.view as View);
  void render();
});
viewSelect.addEventListener("change", () => { activateView(viewSelect.value as View); void render(); });
document.querySelector<HTMLAnchorElement>(".brand")?.addEventListener("click", (event) => {
  event.preventDefault();
  activateView("overview");
  void render();
});
window.addEventListener("popstate", () => { navigateFromLocation(); void render(); });
byId("refresh-button").addEventListener("click", () => { capabilities = { endpoints: {} }; void render(); void updateWorld(); });
byId("login-button").addEventListener("click", async () => {
  if (authenticated) {
    try {
      await fetch("/api/session", { method: "DELETE" });
      await loadSession();
      await render();
      await updateWorld();
    } catch (error) { showNotice(error instanceof Error ? error.message : String(error), "error"); }
  } else loginDialog.showModal();
});
byId("cancel-login").addEventListener("click", () => loginDialog.close());
byId("login-dialog").querySelector(".close-button")?.addEventListener("click", () => loginDialog.close());
byId<HTMLFormElement>("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = byId("login-error");
  const submit = byId<HTMLFormElement>("login-form").querySelector<HTMLButtonElement>("[type=submit]")!;
  error.hidden = true;
  submit.disabled = true;
  try {
    const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: byId<HTMLInputElement>("password").value }) });
    const body = await response.json() as JsonObject;
    if (!response.ok) { error.textContent = errorMessage(body, response.status); error.hidden = false; return; }
    byId<HTMLInputElement>("password").value = "";
    loginDialog.close();
    await loadSession();
    await render();
    await updateWorld();
  } catch (caught) {
    error.textContent = caught instanceof Error ? caught.message : String(caught);
    error.hidden = false;
  } finally { submit.disabled = false; }
});

const themeButton = byId("theme-button");
const stored = localStorage.getItem("palworld-mods-theme");
document.documentElement.dataset.theme = stored === "light" || stored === "dark"
  ? stored
  : matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
function themeLabel() {
  const dark = document.documentElement.dataset.theme === "dark";
  themeButton.textContent = dark ? "Light" : "Dark";
  themeButton.setAttribute("aria-label", `Use ${dark ? "light" : "dark"} theme`);
}
themeLabel();
themeButton.addEventListener("click", () => {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("palworld-mods-theme", document.documentElement.dataset.theme);
  themeLabel();
});

navigateFromLocation();
try { await loadSession(); }
catch (error) { showNotice(error instanceof Error ? error.message : String(error), "error"); }
void updateWorld();
void loadContract();
await render();
