import { Show, createSignal } from "solid-js";
import { MessageInspector, type MessageCollection, type MessageIntent } from "./MessageInspector";
import { ActionsEditor, CombatMatrix, type ActionValue, type ActionValues, type CombatMatrixValue, type CombatOverride } from "./RuleEditors";
import type { ModeIntent } from "../editor/intents";
export type { ModeIntent } from "../editor/intents";

export interface ModeEditorValue {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly minimumLevel: number | null;
  readonly actions: ActionValues;
  readonly combat: CombatMatrixValue;
  readonly messages?: Readonly<Record<string, unknown>>;
}

export function ModeInspector(props: {
  readonly mode: ModeEditorValue;
  readonly messages: MessageCollection;
  readonly resolvedMessages: Readonly<Record<string, never>>;
  readonly onChange: (intent: ModeIntent) => void;
}) {
  const [tab, setTab] = createSignal<"rules" | "messages">("rules");
  return <>
    <div class="inspector-header"><h2>{props.mode.name}</h2></div>
    <div class="tab-strip" role="tablist" aria-label="Editor sections">
      <button type="button" role="tab" aria-selected={tab() === "rules"} classList={{ active: tab() === "rules" }} onClick={() => { setTab("rules"); }}>Rules</button>
      <button type="button" role="tab" aria-selected={tab() === "messages"} classList={{ active: tab() === "messages" }} onClick={() => { setTab("messages"); }}>Messages</button>
    </div>
    <div class="dialog-tab-content">
      <Show when={tab() === "rules"}>
        <div class="rules-stack">
          <div class="mode-rule-fields">
            <label class="field mode-id-field"><span>ID</span><input aria-label="ID" readonly value={props.mode.id} /></label>
            <label class="field mode-color-field"><span>Color</span><input aria-label="Color" type="color" value={props.mode.color} onChange={(event) => { props.onChange({ type: "set-color", value: event.currentTarget.value.toUpperCase() }); }} /></label>
            <label class="field mode-level-field"><span>Minimum level</span><input aria-label="Minimum level" type="number" min="1" max="999" step="1" value={props.mode.minimumLevel ?? ""} placeholder="No requirement" onChange={(event) => { const value = event.currentTarget.value.trim(); props.onChange({ type: "set-minimum-level", value: value ? Math.max(1, Math.min(999, Math.trunc(Number(value)))) : null }); }} /></label>
            <label class="field mode-name-field"><span>Name</span><input aria-label="Name" maxlength="96" value={props.mode.name} onChange={(event) => { props.onChange({ type: "set-name", value: event.currentTarget.value.trim() }); }} /></label>
          </div>
          <div class="section-card rules-actions"><div class="section-card-header"><div><h3>Player actions</h3><p>Every action is explicit for this mode.</p></div></div><div class="section-card-body"><ActionsEditor actions={props.mode.actions} effective={props.mode.actions} isMode={true} onChange={(actionId, value) => { props.onChange({ type: "set-action", actionId, value }); }} /></div></div>
          <div class="section-card combat-matrix-card"><div class="section-card-header"><div><h3>Combat matrix</h3><p>Every source and target relationship is explicit Allow or Deny.</p></div></div><div class="section-card-body"><CombatMatrix matrix={props.mode.combat} isMode={true} overrideFor={(source, target) => props.mode.combat[source]?.[target] ? "allow" : "deny"} onChange={(source, target, value) => { props.onChange({ type: "set-combat", source, target, value }); }} /></div></div>
        </div>
      </Show>
      <Show when={tab() === "messages"}><MessageInspector messages={props.messages} resolved={props.resolvedMessages} areaName={props.mode.name} modeName={props.mode.name} overrides={props.mode.messages} onChange={(intent) => { props.onChange({ type: "message", intent }); }} /></Show>
    </div>
  </>;
}
