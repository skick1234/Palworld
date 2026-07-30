import { For, Show, createMemo, createSignal } from "solid-js";
import type { JSX } from "solid-js";
import type { EditorSection } from "../editor/create-editor-model";
import { ModeBadge, type ModeSummary } from "./ModeBadge";
import { utcWeekdayAndTimeToLocal } from "../domain/schedules";
export type { ModeSummary } from "./ModeBadge";

export interface AreaSummary {
  readonly name: string;
  readonly mode: string;
}

export interface RegionSummary extends AreaSummary {
  readonly enabled?: boolean;
  readonly map?: string;
}

interface IconProps { readonly name: string; }
function Icon(props: IconProps) {
  return <span class={`hero-icon hero-icon-${props.name}`} aria-hidden="true" />;
}

function CardHeader(props: { readonly title: string; readonly children?: JSX.Element }) {
  return <span class="sidebar-card-header"><span class="sidebar-card-title">{props.title}</span>{props.children}</span>;
}

function CardDetail(props: { readonly parts: readonly string[] }) {
  return <span class="sidebar-card-detail">{props.parts.join(" · ")}</span>;
}

function activateOnKeyboard(event: KeyboardEvent, action: () => void): void {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
}

export interface RegionSidebarProps {
  readonly wilderness: AreaSummary;
  readonly stageAreas: AreaSummary;
  readonly regions: readonly RegionSummary[];
  readonly modes: readonly ModeSummary[];
  readonly selectedIndex: number | null;
  readonly onSelect: (index: number) => void;
  readonly onOpenWilderness: (trigger: HTMLElement) => void;
  readonly onOpenStageAreas: (trigger: HTMLElement) => void;
  readonly onOpenRegion: (index: number, trigger: HTMLElement) => void;
  readonly onMove: (index: number, direction: number) => void;
  readonly onDuplicate: (index: number, trigger: HTMLElement) => void;
  readonly onDelete: (index: number, trigger: HTMLElement) => void;
}

export function RegionSidebar(props: RegionSidebarProps) {
  const [query, setQuery] = createSignal("");
  const visible = createMemo(() => {
    const needle = query().trim().toLocaleLowerCase();
    return props.regions
      .map((region, index) => ({ region, index }))
      .filter(({ region }) => !needle || `${region.name} ${region.map ?? ""} ${region.mode}`.toLocaleLowerCase().includes(needle));
  });

  return <>
    <div class="panel-heading"><div><h2>Regions</h2><p>Later polygon entries win overlaps. The Wilderness applies only when none match.</p></div></div>
    <div class="search-row"><input type="search" placeholder="Search regions" aria-label="Search regions" value={query()} onInput={(event) => { setQuery(event.currentTarget.value); }} /></div>
    <div class="list-stack">
      <article
        class="sidebar-card wilderness-card"
        data-wilderness
        tabindex="0"
        aria-label={`Edit Wilderness ${props.wilderness.name}`}
        onClick={(event) => { props.onOpenWilderness(event.currentTarget); }}
        onKeyDown={(event) => { activateOnKeyboard(event, () => { props.onOpenWilderness(event.currentTarget); }); }}
      >
        <CardHeader title={props.wilderness.name}><ModeBadge modeId={props.wilderness.mode} modes={props.modes} /></CardHeader>
        <CardDetail parts={[props.wilderness.name.trim().toLocaleLowerCase() === "wilderness" ? "Outside region" : "Wilderness"]} />
        <footer class="sidebar-card-footer wilderness-footer">
          <div class="sidebar-card-actions">
            <button type="button" class="sidebar-card-icon settings" title="Wilderness settings" aria-label={`Open settings for Wilderness ${props.wilderness.name}`} onClick={(event) => { event.stopPropagation(); props.onOpenWilderness(event.currentTarget); }}><Icon name="cog-6-tooth" /></button>
          </div>
        </footer>
      </article>
      <article
        class="sidebar-card wilderness-card stage-areas-card"
        data-stage-areas
        tabindex="0"
        aria-label={`Edit Stage Areas ${props.stageAreas.name}`}
        onClick={(event) => { props.onOpenStageAreas(event.currentTarget); }}
        onKeyDown={(event) => { activateOnKeyboard(event, () => { props.onOpenStageAreas(event.currentTarget); }); }}
      >
        <CardHeader title={props.stageAreas.name}><ModeBadge modeId={props.stageAreas.mode} modes={props.modes} /></CardHeader>
        <CardDetail parts={["Fixed stage priority"]} />
        <footer class="sidebar-card-footer wilderness-footer">
          <div class="sidebar-card-actions">
            <button type="button" class="sidebar-card-icon settings" title="Stage Areas settings" aria-label={`Open settings for Stage Areas ${props.stageAreas.name}`} onClick={(event) => { event.stopPropagation(); props.onOpenStageAreas(event.currentTarget); }}><Icon name="cog-6-tooth" /></button>
          </div>
        </footer>
      </article>
      <For each={visible()}>{({ region, index }) => (
        <article
          classList={{ "sidebar-card": true, selected: index === props.selectedIndex, disabled: region.enabled === false }}
          tabindex="0"
          aria-label={`Select ${region.name}`}
          aria-current={index === props.selectedIndex ? "true" : undefined}
          onClick={() => { props.onSelect(index); }}
          onKeyDown={(event) => { activateOnKeyboard(event, () => { props.onSelect(index); }); }}
        >
          <CardHeader title={region.name}><ModeBadge modeId={region.mode} modes={props.modes} /></CardHeader>
          <footer class="sidebar-card-footer">
            <div class="order-controls">
              <button type="button" class="sidebar-card-icon order-button" title="Move earlier" aria-label={`Move ${region.name} earlier`} disabled={index === 0} onClick={(event) => { event.stopPropagation(); props.onMove(index, -1); }}><Icon name="arrow-up" /></button>
              <button type="button" class="sidebar-card-icon order-button" title="Move later" aria-label={`Move ${region.name} later`} disabled={index === props.regions.length - 1} onClick={(event) => { event.stopPropagation(); props.onMove(index, 1); }}><Icon name="arrow-down" /></button>
            </div>
            <div class="sidebar-card-actions">
              <button type="button" class="sidebar-card-icon settings" title="Region settings" aria-label={`Open settings for ${region.name}`} onClick={(event) => { event.stopPropagation(); props.onOpenRegion(index, event.currentTarget); }}><Icon name="cog-6-tooth" /></button>
              <button type="button" class="sidebar-card-icon" title="Duplicate region" aria-label={`Duplicate ${region.name}`} onClick={(event) => { event.stopPropagation(); props.onDuplicate(index, event.currentTarget); }}><Icon name="square-2-stack" /></button>
              <button type="button" class="sidebar-card-icon danger" title="Delete region" aria-label={`Delete ${region.name}`} onClick={(event) => { event.stopPropagation(); props.onDelete(index, event.currentTarget); }}><Icon name="trash" /></button>
            </div>
          </footer>
        </article>
      )}</For>
      <Show when={visible().length === 0}><div class="empty-state"><div><strong>No matching regions</strong><span>Clear the search to show every region.</span></div></div></Show>
    </div>
  </>;
}

interface ModeSidebarProps {
  readonly modes: readonly ModeSummary[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly onMove: (index: number, direction: number) => void;
  readonly onDuplicate: (index: number, trigger: HTMLElement) => void;
  readonly onDelete: (index: number, trigger: HTMLElement) => void;
}

function ModeSidebar(props: ModeSidebarProps) {
  const [query, setQuery] = createSignal("");
  const visible = createMemo(() => {
    const needle = query().trim().toLocaleLowerCase();
    return props.modes.map((mode, index) => ({ mode, index })).filter(({ mode }) => !needle || `${mode.name} ${mode.id}`.toLocaleLowerCase().includes(needle));
  });
  return <>
    <div class="panel-heading"><div><h2>Modes</h2><p>Ordered presets for area actions, combat, color, and messages.</p></div></div>
    <div class="search-row"><input type="search" placeholder="Search modes" aria-label="Search modes" value={query()} onInput={(event) => { setQuery(event.currentTarget.value); }} /></div>
    <div class="list-stack">
      <For each={visible()}>{({ mode, index }) => (
        <article classList={{ "sidebar-card": true, selected: index === props.selectedIndex }} tabindex="0" aria-label={`Select ${mode.name}`} aria-current={index === props.selectedIndex ? "true" : undefined} onClick={() => { props.onSelect(index); }} onKeyDown={(event) => { activateOnKeyboard(event, () => { props.onSelect(index); }); }}>
          <CardHeader title={mode.name}><ModeBadge modeId={mode.id} modes={props.modes} /></CardHeader>
          <footer class="sidebar-card-footer">
            <div class="order-controls">
              <button type="button" class="sidebar-card-icon order-button" aria-label={`Move ${mode.name} earlier`} disabled={index === 0} onClick={(event) => { event.stopPropagation(); props.onMove(index, -1); }}><Icon name="arrow-up" /></button>
              <button type="button" class="sidebar-card-icon order-button" aria-label={`Move ${mode.name} later`} disabled={index === props.modes.length - 1} onClick={(event) => { event.stopPropagation(); props.onMove(index, 1); }}><Icon name="arrow-down" /></button>
            </div>
            <div class="sidebar-card-actions">
              <button type="button" class="sidebar-card-icon" aria-label={`Duplicate ${mode.name}`} onClick={(event) => { event.stopPropagation(); props.onDuplicate(index, event.currentTarget); }}><Icon name="square-2-stack" /></button>
              <button type="button" class="sidebar-card-icon danger" aria-label={`Delete ${mode.name}`} disabled={props.modes.length === 1} onClick={(event) => { event.stopPropagation(); props.onDelete(index, event.currentTarget); }}><Icon name="trash" /></button>
            </div>
          </footer>
        </article>
      )}</For>
      <Show when={visible().length === 0}><div class="empty-state"><div><strong>No matching modes</strong><span>Clear the search to show every mode.</span></div></div></Show>
    </div>
  </>;
}

interface ScheduleSummary {
  readonly name: string;
  readonly enabled: boolean;
  readonly days: readonly string[];
  readonly startTime: string;
  readonly mode: string | null;
  readonly announcements: readonly unknown[];
}

function ScheduleSidebar(props: {
  readonly schedules: readonly ScheduleSummary[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly onAdd: () => void;
  readonly onMove: (index: number, direction: number) => void;
  readonly onDuplicate: (index: number) => void;
  readonly onDelete: (index: number) => void;
}) {
  const computerTime = (schedule: ScheduleSummary) => utcWeekdayAndTimeToLocal(
    schedule.days[0] ?? "mon", schedule.startTime)?.time ?? schedule.startTime;
  return <>
    <div class="panel-heading"><div><h2>Schedules</h2><p>Recurring UTC rules and broadcasts. Later active mode windows win overlaps.</p></div></div>
    <div class="schedule-list-actions"><button type="button" class="button small primary" onClick={props.onAdd}>Add schedule</button></div>
    <div class="list-stack">
      <For each={props.schedules}>{(schedule, index) => <article classList={{ "sidebar-card": true, selected: index() === props.selectedIndex, disabled: !schedule.enabled }} tabindex="0" onClick={() => { props.onSelect(index()); }} onKeyDown={(event) => { activateOnKeyboard(event, () => { props.onSelect(index()); }); }}>
        <CardHeader title={schedule.name}><span classList={{ badge: true, pve: schedule.enabled }}>{schedule.enabled ? "On" : "Off"}</span></CardHeader>
        <CardDetail parts={[schedule.mode ? "Mode window" : "Announcements only", `${schedule.announcements.length} notice${schedule.announcements.length === 1 ? "" : "s"}`, `${schedule.days.length} days`, `${computerTime(schedule)} local`]} />
        <footer class="sidebar-card-footer"><div class="order-controls"><button type="button" class="sidebar-card-icon order-button" aria-label={`Move ${schedule.name} earlier`} disabled={index() === 0} onClick={(event) => { event.stopPropagation(); props.onMove(index(), -1); }}><Icon name="arrow-up" /></button><button type="button" class="sidebar-card-icon order-button" aria-label={`Move ${schedule.name} later`} disabled={index() === props.schedules.length - 1} onClick={(event) => { event.stopPropagation(); props.onMove(index(), 1); }}><Icon name="arrow-down" /></button></div><div class="sidebar-card-actions"><button type="button" class="sidebar-card-icon" aria-label={`Duplicate ${schedule.name}`} onClick={(event) => { event.stopPropagation(); props.onDuplicate(index()); }}><Icon name="square-2-stack" /></button><button type="button" class="sidebar-card-icon danger" aria-label={`Delete ${schedule.name}`} onClick={(event) => { event.stopPropagation(); props.onDelete(index()); }}><Icon name="trash" /></button></div></footer>
      </article>}</For>
      <Show when={props.schedules.length === 0}><div class="empty-state"><div><strong>No schedules yet</strong><span>Add a broadcast or a recurring mode window.</span></div></div></Show>
    </div>
  </>;
}

interface MessageSummary { readonly id: string; readonly label: string; readonly enabled: boolean; readonly outputCount: number; readonly cooldownSeconds: number; }

function MessageSidebar(props: { readonly messages: readonly MessageSummary[]; readonly selectedId: string; readonly onSelect: (id: string) => void }) {
  return <>
    <div class="panel-heading"><div><h2>Global messages</h2><p>Each event and output channel can be enabled and customized independently.</p></div></div>
    <div class="list-stack">
      <For each={props.messages}>{(message) => (
        <button type="button" classList={{ "sidebar-card": true, "message-nav-item": true, selected: props.selectedId === message.id, disabled: !message.enabled }} onClick={() => { props.onSelect(message.id); }}>
          <CardHeader title={message.label}><span classList={{ badge: true, pve: message.enabled }}>{message.enabled ? "On" : "Off"}</span></CardHeader>
          <CardDetail parts={[`${message.outputCount} output${message.outputCount === 1 ? "" : "s"}`, `${message.cooldownSeconds}s cooldown`]} />
        </button>
      )}</For>
      <button type="button" classList={{ "sidebar-card": true, "message-nav-item": true, selected: props.selectedId === "localization" }} onClick={() => { props.onSelect("localization"); }}>
        <CardHeader title="Localization" />
        <CardDetail parts={["Action names"]} />
      </button>
    </div>
    <p class="help">A region uses these global defaults unless it overrides an event.</p>
  </>;
}

interface SidebarConfig {
  readonly wilderness: AreaSummary;
  readonly stageAreas: AreaSummary;
  readonly regions: readonly RegionSummary[];
  readonly modes: readonly ModeSummary[];
  readonly schedules: readonly ScheduleSummary[];
  readonly settings: { readonly hotReload: boolean; readonly hotReloadSeconds: number; readonly worldRules: boolean; readonly adminBypass: boolean };
  readonly regionalCombat: { readonly enabled: boolean };
}

export interface SidebarState {
  readonly section: EditorSection;
  readonly config: SidebarConfig;
  readonly selectedRegionIndex: number | null;
  readonly selectedModeIndex: number;
  readonly selectedScheduleIndex: number;
  readonly selectedMessageId: string;
  readonly messages: readonly MessageSummary[];
}

export interface SidebarActions {
  readonly selectRegion: (index: number) => void;
  readonly openWilderness: (trigger: HTMLElement) => void;
  readonly openStageAreas: (trigger: HTMLElement) => void;
  readonly openRegion: (index: number, trigger: HTMLElement) => void;
  readonly moveRegion: (index: number, direction: number) => void;
  readonly duplicateRegion: (index: number, trigger: HTMLElement) => void;
  readonly deleteRegion: (index: number, trigger: HTMLElement) => void;
  readonly selectMode: (index: number) => void;
  readonly moveMode: (index: number, direction: number) => void;
  readonly duplicateMode: (index: number, trigger: HTMLElement) => void;
  readonly deleteMode: (index: number, trigger: HTMLElement) => void;
  readonly selectSchedule: (index: number) => void;
  readonly addSchedule: () => void;
  readonly moveSchedule: (index: number, direction: number) => void;
  readonly duplicateSchedule: (index: number) => void;
  readonly deleteSchedule: (index: number) => void;
  readonly selectMessage: (id: string) => void;
}

export function Sidebar(props: { readonly state: SidebarState; readonly actions: SidebarActions }) {
  return <>
    <Show when={props.state.section === "regions"}><RegionSidebar wilderness={props.state.config.wilderness} stageAreas={props.state.config.stageAreas} regions={props.state.config.regions} modes={props.state.config.modes} selectedIndex={props.state.selectedRegionIndex} onSelect={props.actions.selectRegion} onOpenWilderness={props.actions.openWilderness} onOpenStageAreas={props.actions.openStageAreas} onOpenRegion={props.actions.openRegion} onMove={props.actions.moveRegion} onDuplicate={props.actions.duplicateRegion} onDelete={props.actions.deleteRegion} /></Show>
    <Show when={props.state.section === "modes"}><ModeSidebar modes={props.state.config.modes} selectedIndex={props.state.selectedModeIndex} onSelect={props.actions.selectMode} onMove={props.actions.moveMode} onDuplicate={props.actions.duplicateMode} onDelete={props.actions.deleteMode} /></Show>
    <Show when={props.state.section === "schedules"}><ScheduleSidebar schedules={props.state.config.schedules} selectedIndex={props.state.selectedScheduleIndex} onSelect={props.actions.selectSchedule} onAdd={props.actions.addSchedule} onMove={props.actions.moveSchedule} onDuplicate={props.actions.duplicateSchedule} onDelete={props.actions.deleteSchedule} /></Show>
    <Show when={props.state.section === "messages"}><MessageSidebar messages={props.state.messages} selectedId={props.state.selectedMessageId} onSelect={props.actions.selectMessage} /></Show>
    <Show when={props.state.section === "settings"}>
      <div class="panel-heading"><div><h2>Runtime settings</h2><p>Safe defaults are supplied; most servers only need regions and modes.</p></div></div>
      <div class="list-stack">
        <div class="sidebar-card"><CardHeader title="Hot reload"><span classList={{ badge: true, pve: props.state.config.settings.hotReload }}>{props.state.config.settings.hotReload ? "On" : "Off"}</span></CardHeader><CardDetail parts={[`Every ${props.state.config.settings.hotReloadSeconds}s`]} /></div>
        <div class="sidebar-card"><CardHeader title="Regional combat authority"><span classList={{ badge: true, pve: props.state.config.regionalCombat.enabled }}>{props.state.config.regionalCombat.enabled ? "On" : "Off"}</span></CardHeader><CardDetail parts={[props.state.config.regionalCombat.enabled ? "PalLaw manages regional final damage and regional PvP" : "All combat remains vanilla"]} /></div>
        <div class="sidebar-card"><CardHeader title="World actions"><span classList={{ badge: true, pve: props.state.config.settings.worldRules }}>{props.state.config.settings.worldRules ? "On" : "Off"}</span></CardHeader><CardDetail parts={[props.state.config.settings.adminBypass ? "Admins bypass restrictions" : "Admins follow restrictions"]} /></div>
      </div>
    </Show>
    <Show when={props.state.section === "json"}>
      <div class="panel-heading"><div><h2>Raw configuration</h2><p>The form and JSON editor modify the same <code>PalLaw.json</code> document.</p></div></div>
      <div class="section-card"><div class="section-card-body"><p class="help">JSON was selected because it can be parsed identically by the DLL and browser, validated with the bundled schema, and edited without additional runtime dependencies.</p></div></div>
    </Show>
  </>;
}
