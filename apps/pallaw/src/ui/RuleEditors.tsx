import { For, Show, createSignal } from "solid-js";
import { ACTIONS, ACTORS, MAX_DAMAGE_MULTIPLIER, fastTravelPolicies } from "../domain/rules";

export type ActionValue = boolean | "all" | "baseOnly" | "baseToAll" | "baseToBase" | "allToBase" | "none";
export type ActionValues = Readonly<Record<string, ActionValue | undefined>>;

function actionLabel(actionId: string, value: ActionValue | undefined): string {
  if (typeof value === "boolean") return value ? "Allow" : "Deny";
  return fastTravelPolicies(actionId).find((policy) => policy.id === value)?.label ?? "Deny";
}

export function ActionsEditor(props: {
  readonly actions: ActionValues;
  readonly effective: ActionValues;
  readonly isMode: boolean;
  readonly onChange: (actionId: string, value: ActionValue | null) => void;
}) {
  const [description, setDescription] = createSignal<{ title: string; text: string }>({ title: "Player Actions", text: "Hover or focus a header or cell to see its meaning." });
  const nextValue = (id: string, fastTravel: boolean): ActionValue | null => {
    const raw = props.actions[id];
    if (props.isMode && fastTravel) {
      const values = fastTravelPolicies(id).map((policy) => policy.id as ActionValue);
      return values[(values.indexOf(raw ?? "none") + 1) % values.length]!;
    }
    if (props.isMode) return !Boolean(raw);
    if (fastTravel) {
      const values: Array<ActionValue | null> = [null, ...fastTravelPolicies(id).map((policy) => policy.id as ActionValue)];
      return values[(values.indexOf(raw ?? null) + 1) % values.length]!;
    }
    if (raw === undefined) return true;
    if (raw === true) return false;
    return null;
  };
  return <>
    <div class="action-matrix-grid"><For each={ACTIONS}>{(action) => {
      const raw = () => props.actions[action.id];
      const effective = () => props.effective[action.id];
      const rawLabel = () => raw() === undefined ? "Default" : actionLabel(action.id, raw());
      const effectiveLabel = () => actionLabel(action.id, effective());
      const accessible = () => props.isMode
        ? `${action.label}: ${effectiveLabel()}. Activate to change.`
        : raw() === undefined
          ? `${action.label}: Default, effective ${effectiveLabel()}. Activate to change.`
          : `${action.label}: ${rawLabel()} override. Activate to change.`;
      return <div class="action-matrix-item"><button
        type="button"
        classList={{ "matrix-cell": true, allowed: effective() !== false && effective() !== "none", denied: effective() === false || effective() === "none", "is-default": props.isMode || raw() === undefined, "is-override": !props.isMode && raw() !== undefined }}
        aria-label={accessible()}
        onClick={() => { props.onChange(action.id, nextValue(action.id, Boolean(action.fastTravelPolicy))); }}
        onMouseEnter={() => { setDescription({ title: action.label, text: action.description }); }}
        onFocus={() => { setDescription({ title: action.label, text: action.description }); }}
      >
        <span class="action-cell-name">{action.label}</span>
        <span class="matrix-cell-primary">{rawLabel()}</span>
        {!props.isMode && <span class="matrix-cell-secondary">{raw() === undefined ? effectiveLabel() : "Override"}</span>}
      </button></div>;
    }}</For></div>
    <div class="matrix-actor-description"><strong>{description().title}</strong><span>{description().text}</span></div>
  </>;
}

/** Damage multipliers per source and target: 0 denies, 1 keeps vanilla damage, anything else scales it. */
export type CombatMatrixValue = Readonly<Record<string, Readonly<Record<string, number | undefined>> | undefined>>;
/** Explicit area cell multiplier, or null when the cell inherits the mode default. */
export type CombatOverride = number | null;

function multiplierLabel(value: number): string {
  return value === 0 ? "Deny" : value === 1 ? "Allow" : `${value}×`;
}

interface MatrixActorDefinition {
  readonly name: string;
  readonly text: string;
}

interface MatrixRelationshipDescription {
  readonly source: MatrixActorDefinition;
  readonly target?: MatrixActorDefinition;
}

export function CombatMatrix(props: {
  readonly matrix: CombatMatrixValue;
  readonly isMode: boolean;
  readonly modeName?: string;
  readonly overrideFor: (source: string, target: string) => CombatOverride;
  readonly onChange: (source: string, target: string, value: CombatOverride) => void;
}) {
  const sources = ACTORS.filter((actor) => !actor.targetOnly);
  const defaultDescription: MatrixRelationshipDescription = {
    source: { name: "Rows", text: "deal damage. Hover or focus a row header or matrix button to inspect the source." },
    target: { name: "Columns", text: "receive damage. Hover or focus a column header or matrix button to inspect the target." }
  };
  const [description, setDescription] = createSignal<MatrixRelationshipDescription>(defaultDescription);
  const [selected, setSelected] = createSignal<{ source: typeof ACTORS[number]; target: typeof ACTORS[number] } | null>(null);
  const effectiveOf = (source: string, target: string) => props.matrix[source]?.[target] ?? 0;
  const rawOf = (source: string, target: string): CombatOverride => props.isMode ? effectiveOf(source, target) : props.overrideFor(source, target);
  // Area cells cycle Default -> Allow (1) -> Deny (0) -> Default; mode cells toggle 1 <-> 0.
  const next = (raw: CombatOverride, effective: number): CombatOverride => props.isMode ? (effective === 0 ? 1 : 0) : raw === null ? 1 : raw === 1 ? 0 : null;
  const applyMultiplier = (source: string, target: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) { if (!props.isMode) props.onChange(source, target, null); return; }
    const value = Number(trimmed);
    if (Number.isFinite(value) && value >= 0 && value <= MAX_DAMAGE_MULTIPLIER) props.onChange(source, target, value);
  };
  const definition = (actor: { label: string; description?: string }): MatrixActorDefinition => ({ name: actor.label, text: actor.description ?? actor.label });
  const describeSource = (source: { label: string; description?: string }) => { setDescription({ source: definition(source), target: defaultDescription.target }); };
  const describeTarget = (target: { label: string; description?: string }) => { setDescription({ source: defaultDescription.source, target: definition(target) }); };
  const describeRelationship = (source: { id: string; label: string; description?: string }, target: { id: string; label: string; description?: string }) => {
    setDescription(source.id === target.id
      ? { source: definition(source) }
      : { source: definition(source), target: definition(target) });
  };
  return <>
    <div class="matrix-toolbar"><p>Rows deal damage. Columns receive it.{props.isMode ? "" : ` Default follows the ${props.modeName ?? "selected"} mode.`}</p></div>
    <div class="matrix-wrap"><table class="combat-matrix">
      <thead><tr><th class="matrix-corner" scope="col"><span class="matrix-corner-label" tabindex="0" aria-label="Targets run across columns. Sources run down rows." onMouseEnter={() => { setDescription(defaultDescription); }} onFocus={() => { setDescription(defaultDescription); }}><span><strong>Target</strong><span class="hero-icon hero-icon-arrow-right matrix-axis-icon" aria-hidden="true" /></span><span><strong>Source</strong><span class="hero-icon hero-icon-arrow-down matrix-axis-icon" aria-hidden="true" /></span></span></th>
        <For each={ACTORS}>{(target) => <th scope="col"><span class="matrix-actor-label" tabindex="0" aria-label={`${target.label}. ${target.description}`} onMouseEnter={() => { describeTarget(target); }} onFocus={() => { describeTarget(target); }}>{target.matrixLabel ?? target.label}</span></th>}</For>
      </tr></thead>
      <tbody><For each={sources}>{(source, row) => <tr><th scope="row"><span class="matrix-actor-label" tabindex="0" aria-label={`${source.label}. ${source.description}`} onMouseEnter={() => { describeSource(source); }} onFocus={() => { describeSource(source); }}>{source.matrixLabel ?? source.label}</span></th>
        <For each={ACTORS}>{(target, column) => {
          const effective = () => effectiveOf(source.id, target.id);
          const raw = () => rawOf(source.id, target.id);
          const primary = () => raw() === null ? "Default" : multiplierLabel(effective());
          const accessible = () => `${source.label} to ${target.label}: ${raw() === null ? `Default, effective ${effective()}×` : props.isMode ? `${effective()}×` : `${effective()}× override`}. Activate to change.`;
          return <td><button type="button" classList={{ "matrix-cell": true, allowed: effective() === 1, denied: effective() === 0, scaled: effective() !== 0 && effective() !== 1, "is-default": raw() === null, "is-override": !props.isMode && raw() !== null }} aria-label={accessible()} data-combat-row={row()} data-combat-column={column()} onMouseEnter={() => { describeRelationship(source, target); }} onFocus={() => { describeRelationship(source, target); setSelected({ source, target }); }} onClick={() => { setSelected({ source, target }); props.onChange(source.id, target.id, next(raw(), effective())); }}><span class="matrix-cell-primary">{primary()}</span>{!props.isMode && <span class="matrix-cell-secondary">{raw() === null ? multiplierLabel(effective()) : "Override"}</span>}</button></td>;
        }}</For>
      </tr>}</For></tbody>
    </table></div>
    <div class="matrix-actor-description">
      <div class="matrix-definition-list"><strong>{description().source.name}</strong><span>{description().source.text}</span><Show when={description().target}>{(target) => <><strong>{target().name}</strong><span>{target().text}</span></>}</Show></div>
      <Show when={selected()}>{(cell) => <label class="matrix-multiplier"><span>Damage multiplier</span><input type="number" min="0" max={MAX_DAMAGE_MULTIPLIER} step="0.05" aria-label={`${cell().source.label} to ${cell().target.label} damage multiplier`} placeholder={props.isMode ? undefined : `Default ${effectiveOf(cell().source.id, cell().target.id)}`} value={rawOf(cell().source.id, cell().target.id) ?? ""} onChange={(event) => { applyMultiplier(cell().source.id, cell().target.id, event.currentTarget.value); }} /><small>{cell().source.label} to {cell().target.label}. 0 cancels damage, 1 keeps vanilla damage.{props.isMode ? "" : " Clear the field to use the mode default."}</small></label>}</Show>
    </div>
  </>;
}
