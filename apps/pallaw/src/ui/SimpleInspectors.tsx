import { For, createEffect, createSignal } from "solid-js";
import { ControlRow, ControlRowGroup } from "./ControlRow";

export interface RuntimeSettings {
  readonly hotReload: boolean;
  readonly hotReloadSeconds: number;
  readonly worldRules: boolean;
  readonly adminBypass: boolean;
  readonly playerSweepSeconds: number;
  readonly mountGraceSeconds: number;
  readonly refundDeniedSpheres: boolean;
  readonly disableCaptureAim: boolean;
  readonly debugLogging: boolean;
}

export interface RegionalCombatSettings { readonly enabled: boolean; }
export type SettingScope = "settings" | "regionalCombat";

interface SettingDefinition {
  readonly group: string;
  readonly scope: SettingScope;
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly type: "boolean" | "number";
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

const DEFINITIONS: readonly SettingDefinition[] = [
  { group: "Configuration", scope: "settings", id: "hotReload", label: "Hot reload", description: "Watch PalLaw.json and automatically apply valid changes.", type: "boolean" },
  { group: "Configuration", scope: "settings", id: "hotReloadSeconds", label: "Reload interval", description: "Seconds between file timestamp checks.", type: "number", min: 0.1, max: 60, step: 0.1 },
  { group: "Enforcement", scope: "regionalCombat", id: "enabled", label: "Regional combat authority", description: "Let PalLaw manage regional final damage and the player-damage setting.", type: "boolean" },
  { group: "Enforcement", scope: "settings", id: "worldRules", label: "World action rules", description: "Enforce actions, decay, mounts, fast travel, and level restrictions.", type: "boolean" },
  { group: "Enforcement", scope: "settings", id: "adminBypass", label: "Administrator bypass", description: "Allow administrators to bypass action and level restrictions.", type: "boolean" },
  { group: "Enforcement", scope: "settings", id: "refundDeniedSpheres", label: "Refund denied capture spheres", description: "Authoritatively return a consumed Pal Sphere to the player's inventory when capture is denied.", type: "boolean" },
  { group: "Enforcement", scope: "settings", id: "disableCaptureAim", label: "Disable capture aim in denied zones", description: "Suppress weapon aiming input while inside a region where Pal capture is denied.", type: "boolean" },
  { group: "Player tracking", scope: "settings", id: "playerSweepSeconds", label: "Player sweep interval", description: "Seconds between location, region, mount, and level checks.", type: "number", min: 0.05, max: 10, step: 0.05 },
  { group: "Player tracking", scope: "settings", id: "mountGraceSeconds", label: "Mount denial grace period", description: "Safe-dismount seconds for a player already mounted when riding becomes denied.", type: "number", min: 0, max: 120, step: 0.5 },
  { group: "Diagnostics", scope: "settings", id: "debugLogging", label: "Debug logging", description: "Write verbose rule decisions and missing reflected symbols to the UE4SS log.", type: "boolean" }
];

export function SettingsInspector(props: {
  readonly settings: RuntimeSettings;
  readonly regionalCombat: RegionalCombatSettings;
  readonly onChange: (scope: SettingScope, id: string, value: boolean | number) => void;
}) {
  const groups = [...new Set(DEFINITIONS.map((definition) => definition.group))];
  const value = (definition: SettingDefinition): boolean | number => definition.scope === "regionalCombat"
    ? props.regionalCombat.enabled
    : props.settings[definition.id as keyof RuntimeSettings];
  return <>
    <div class="inspector-header"><h2>Server behavior</h2><p>The defaults balance responsive enforcement with dedicated-server cost.</p></div>
    <div class="settings-groups"><For each={groups}>{(group) => (
      <section class="settings-group">
        <h3>{group}</h3>
        <ControlRowGroup class="settings-row-group"><For each={DEFINITIONS.filter((definition) => definition.group === group)}>{(definition) => definition.type === "boolean"
          ? <ControlRow kind="boolean" label={definition.label} description={definition.description} checked={Boolean(value(definition))} onChange={(next) => { props.onChange(definition.scope, definition.id, next); }} />
          : <ControlRow kind="number" label={definition.label} description={definition.description} value={Number(value(definition))} min={definition.min!} max={definition.max!} step={definition.step!} onChange={(next) => { props.onChange(definition.scope, definition.id, next); }} />
        }</For></ControlRowGroup>
      </section>
    )}</For></div>
  </>;
}

export function JsonInspector(props: {
  readonly value: string;
  readonly onValue: (value: string) => void;
  readonly onApply: (value: string) => void;
  readonly onToast: (message: string, type: "success" | "error") => void;
}) {
  const [value, setValue] = createSignal(props.value);
  createEffect(() => { if (props.value !== value()) setValue(props.value); });
  const update = (next: string) => { setValue(next); props.onValue(next); };
  return <div class="json-editor-shell">
    <div class="inspector-header"><h2>PalLaw.json</h2><p>Apply validates the document before replacing the form state. Invalid edits never affect the current configuration.</p></div>
    <textarea class="code-editor" spellcheck={false} value={value()} onInput={(event) => { update(event.currentTarget.value); }} onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      event.currentTarget.setRangeText("  ", event.currentTarget.selectionStart, event.currentTarget.selectionEnd, "end");
      update(event.currentTarget.value);
    }} />
    <div class="code-actions">
      <button type="button" class="button primary" onClick={() => { props.onApply(value()); }}>Apply JSON</button>
      <button type="button" class="button ghost" onClick={() => {
        try { update(`${JSON.stringify(JSON.parse(value()) as unknown, null, 2)}\n`); }
        catch (error) { props.onToast(`Cannot format: ${error instanceof Error ? error.message : String(error)}`, "error"); }
      }}>Format current</button>
      <button type="button" class="button ghost" onClick={async () => {
        try { await navigator.clipboard.writeText(value()); props.onToast("Configuration copied.", "success"); }
        catch { props.onToast("Copy is unavailable in this browser.", "error"); }
      }}>Copy</button>
      <button type="button" class="button ghost" onClick={() => { update(props.value); }}>Discard edits</button>
    </div>
  </div>;
}
