import { For, Show, createSignal } from "solid-js";
import { ACTIONS, ACTORS, fastTravelPolicies } from "../domain/rules";

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

export type CombatMatrixValue = Readonly<Record<string, Readonly<Record<string, boolean | undefined>> | undefined>>;
export type CombatOverride = "default" | "allow" | "deny";

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
  const next = (value: CombatOverride): CombatOverride => value === "default" ? "allow" : value === "allow" ? "deny" : "default";
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
          const effective = () => props.matrix[source.id]?.[target.id] === true;
          const raw = () => props.isMode ? (effective() ? "allow" : "deny") : props.overrideFor(source.id, target.id);
          const primary = () => !props.isMode && raw() === "default" ? "Default" : effective() ? "Allow" : "Deny";
          const accessible = () => `${source.label} to ${target.label}: ${raw() === "default" ? `Default, effective ${effective() ? "Allow" : "Deny"}` : `${effective() ? "Allow" : "Deny"} override`}. Activate to change.`;
          return <td><button type="button" classList={{ "matrix-cell": true, allowed: effective(), denied: !effective(), "is-default": props.isMode || raw() === "default", "is-override": !props.isMode && raw() !== "default" }} aria-label={accessible()} data-combat-row={row()} data-combat-column={column()} onMouseEnter={() => { describeRelationship(source, target); }} onFocus={() => { describeRelationship(source, target); }} onClick={() => { props.onChange(source.id, target.id, props.isMode ? (effective() ? "deny" : "allow") : next(raw())); }}><span class="matrix-cell-primary">{primary()}</span>{!props.isMode && <span class="matrix-cell-secondary">{raw() === "default" ? (effective() ? "Allow" : "Deny") : "Override"}</span>}</button></td>;
        }}</For>
      </tr>}</For></tbody>
    </table></div>
    <div class="matrix-actor-description"><div class="matrix-definition-list"><strong>{description().source.name}</strong><span>{description().source.text}</span><Show when={description().target}>{(target) => <><strong>{target().name}</strong><span>{target().text}</span></>}</Show></div></div>
  </>;
}
