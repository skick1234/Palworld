import { For, Show, createSignal } from "solid-js";
import { MessageInspector, type MessageCollection, type MessageIntent } from "./MessageInspector";
import { ActionsEditor, CombatMatrix, type ActionValue, type ActionValues, type CombatMatrixValue, type CombatOverride } from "./RuleEditors";
import type { ModeSummary } from "./Sidebar";
import type { AreaIntent } from "../editor/intents";
import { ControlRow } from "./ControlRow";
export type { AreaIntent } from "../editor/intents";

export interface AreaEditorValue {
  readonly name: string;
  readonly mode: string;
  readonly enabled?: boolean;
  readonly map?: string;
  readonly minimumLevel?: number | null;
  readonly polygon?: readonly (readonly [number, number])[];
  readonly actions: ActionValues;
  readonly combat: readonly unknown[];
  readonly messages?: Readonly<Record<string, unknown>>;
}

export function AreaEditor(props: {
  readonly area: AreaEditorValue;
  readonly isRegion: boolean;
  readonly modes: readonly ModeSummary[];
  readonly maps: readonly { readonly id: string; readonly label: string }[];
  readonly effectiveActions: ActionValues;
  readonly effectiveCombat: CombatMatrixValue;
  readonly modeName: string;
  readonly modeMinimumLevel?: number | null;
  readonly regionalCombatEnabled?: boolean;
  readonly messages: MessageCollection;
  readonly resolvedMessages: Readonly<Record<string, never>>;
  readonly overrideFor: (source: string, target: string) => CombatOverride;
  readonly onChange: (intent: AreaIntent) => void;
}) {
  const [tab, setTab] = createSignal<"general" | "rules" | "messages">("general");
  const [polygonText, setPolygonText] = createSignal(JSON.stringify(props.area.polygon ?? [], null, 2));
  const [polygonError, setPolygonError] = createSignal("");
  const setLevel = (raw: string) => props.onChange({ type: "set-minimum-level", value: raw.trim() ? Math.max(1, Math.min(999, Math.trunc(Number(raw)))) : null });
  const applyPolygon = () => {
    try {
      const parsed = JSON.parse(polygonText()) as unknown;
      if (!Array.isArray(parsed) || parsed.length < 3 || parsed.some((point) => !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite))) throw new Error();
      setPolygonError("");
      props.onChange({ type: "set-polygon", value: parsed as [number, number][] });
    } catch {
      setPolygonError("Polygon coordinates must contain valid JSON with at least three [X, Y] number pairs.");
    }
  };
  return <>
    <p class="region-editor-context">{props.isRegion ? "Order controls overlap precedence. Lower in the list means higher precedence." : "The Wilderness applies only where no enabled polygon Region matches and stays outside overlap priority."}</p>
    <div class="tab-strip" role="tablist" aria-label="Editor sections">
      <For each={["general", "rules", "messages"] as const}>{(id) => <button type="button" role="tab" aria-selected={tab() === id} classList={{ active: tab() === id }} onClick={() => { setTab(id); }}>{id[0]!.toUpperCase() + id.slice(1)}</button>}</For>
    </div>
    <Show when={tab() === "general"}>
      <div class={`form-grid ${props.isRegion ? "region-general-grid" : ""}`}>
        <label class="field area-name-field"><span>Name</span><input aria-label="Name" maxlength="96" value={props.area.name} onChange={(event) => { props.onChange({ type: "set-name", value: event.currentTarget.value.trim() }); }} /><small>Names must be unique, ignoring letter case. This value appears in messages.</small></label>
        <label class="field area-mode-field"><span>Mode</span><select aria-label="Mode" value={props.area.mode} onChange={(event) => { props.onChange({ type: "set-mode", value: event.currentTarget.value }); }}><For each={props.modes}>{(mode) => <option value={mode.id}>{mode.name}</option>}</For></select><small>Changing mode preserves explicit overrides.</small></label>
        <Show when={props.isRegion}>
          <div class="field region-enabled-field"><span>Enabled</span><ControlRow kind="boolean" variant="standalone" label="Use this region" description="Disabled regions remain in the file." checked={props.area.enabled !== false} onChange={(value) => { props.onChange({ type: "set-enabled", value }); }} /></div>
          <label class="field region-map-field"><span>Coordinate map</span><select aria-label="Coordinate map" value={props.area.map} onChange={(event) => { props.onChange({ type: "set-map", value: event.currentTarget.value }); }}><For each={props.maps}>{(map) => <option value={map.id}>{map.label}</option>}</For></select></label>
          <label class="field region-level-field"><span>Minimum player level</span><input aria-label="Minimum player level" type="number" min="1" max="999" step="1" value={props.area.minimumLevel ?? ""} placeholder={props.modeMinimumLevel == null ? "Mode: no requirement" : `Mode: level ${props.modeMinimumLevel}`} onChange={(event) => { setLevel(event.currentTarget.value); }} /><small>Leave blank to use the mode setting.</small></label>
        </Show>
      </div>
      <Show when={props.isRegion}><div class="section-card"><div class="section-card-header"><h3>Polygon</h3><span class="badge">{props.area.polygon?.length ?? 0} vertices</span></div><div class="section-card-body"><label class="field"><span>Runtime world coordinates</span><textarea aria-label="Runtime world coordinates" class="mono" spellcheck={false} value={polygonText()} onInput={(event) => { setPolygonText(event.currentTarget.value); setPolygonError(""); }} /><small>Each point is an Unreal-world [X, Y] pair used by the server.</small></label><Show when={polygonError()}><p class="help combat-inactive" role="alert">{polygonError()}</p></Show><div class="code-actions"><button type="button" class="button small ghost" onClick={applyPolygon}>Apply coordinates</button><button type="button" class="button small ghost" onClick={() => { props.onChange({ type: "fit-region" }); }}>Fit region</button></div></div></div></Show>
    </Show>
    <Show when={tab() === "rules"}>
      <div class="rules-stack">
        <Show when={props.regionalCombatEnabled === false}><p class="help combat-inactive">Combat rules are saved but currently inactive. Level and world-action rules remain enabled.</p></Show>
        <div class="section-card rules-actions"><div class="section-card-header"><div><h3>Player actions</h3><p>Control building, dismantling, mounts, and other regional actions.</p></div></div><div class="section-card-body"><ActionsEditor actions={props.area.actions} effective={props.effectiveActions} isMode={false} onChange={(actionId, value) => { props.onChange({ type: "set-action", actionId, value }); }} /></div></div>
        <div class="section-card combat-matrix-card"><div class="section-card-header"><div><h3>Combat matrix</h3><p>Choose Default, Allow, or Deny for every combat relationship.</p></div><button type="button" class="button small ghost" disabled={props.area.combat.length === 0} onClick={() => { props.onChange({ type: "reset-combat" }); }}>Reset overrides</button></div><div class="section-card-body"><CombatMatrix matrix={props.effectiveCombat} isMode={false} modeName={props.modeName} overrideFor={props.overrideFor} onChange={(source, target, value) => { props.onChange({ type: "set-combat", source, target, value }); }} /></div></div>
      </div>
    </Show>
    <Show when={tab() === "messages"}><MessageInspector messages={props.messages} resolved={props.resolvedMessages} areaName={props.area.name} modeName={props.modeName} overrides={props.area.messages} onChange={(intent) => { props.onChange({ type: "message", intent }); }} /></Show>
  </>;
}
