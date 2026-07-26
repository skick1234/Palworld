import { For } from "solid-js";
import { ACTIONS } from "../domain/rules";

export function LocalizationInspector(props: { readonly names: Readonly<Record<string, string | undefined>>; readonly onChange: (actionId: string, value: string) => void }) {
  return <>
    <div class="inspector-header"><h2>Localization</h2><p>Customize player-facing action names. Mode display names are edited in the Modes tab.</p></div>
    <div class="section-card localization-card">
      <div class="section-card-header"><div><h3>Player Action Display Names</h3><p>Used by {"{action}"} in Action denied messages.</p></div></div>
      <div class="section-card-body"><div class="form-grid one localization-grid"><For each={ACTIONS}>{(action) => <label class="field"><span>{action.label}</span><input aria-label={action.label} type="text" required maxlength="96" value={props.names[action.id] ?? action.label} onChange={(event) => { props.onChange(action.id, event.currentTarget.value); }} /><small>Player-facing name for the {action.id} action, up to 96 Unicode characters.</small></label>}</For></div></div>
    </div>
  </>;
}
