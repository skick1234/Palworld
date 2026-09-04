import { For, Show, createEffect, createMemo, createSignal, lazy, onCleanup, onMount } from "solid-js";
import type { EditorDocument } from "../document/create-editor-document";
import type { PalLawConfig } from "../document/create-pallaw-document";
import { createEditorModel, type EditorSection, type WorkspaceView } from "../editor/create-editor-model";
import {
  MAPS, MESSAGE_EVENTS, createDefaultConfig, effectiveActions, effectiveCombat,
  effectiveMinimumLevel, enabledMessageOutputCount, modeDefinition, combatOverride,
  resolveAreaMessages, stringifyConfig
} from "../domain/rules";
import { createLeafletMap, type MapCallbacks, type MapController } from "../map/create-leaflet-map";
import type { AreaIntent } from "../editor/intents";
import { LocalizationInspector } from "./LocalizationInspector";
import { MapSwitcher } from "./MapSwitcher";
import { MessageInspector, type MessageCollection, type MessageIntent } from "./MessageInspector";
import type { ModeIntent } from "../editor/intents";
import { SettingsInspector, JsonInspector, type SettingScope } from "./SimpleInspectors";
import { Sidebar, type SidebarActions, type SidebarState } from "./Sidebar";
import { WorkspaceViewNav } from "./WorkspaceViewNav";
import { createPalLawCommands } from "../editor/create-pallaw-commands";
import { SupportControl, ThemeToggle } from "../../../shared/src/SiteControls";

const ScheduleInspector = lazy(async () => {
  const module = await import("./ScheduleInspector");
  return { default: module.ScheduleInspector };
});
const ModeInspector = lazy(async () => {
  const module = await import("./ModeInspector");
  return { default: module.ModeInspector };
});
const AreaEditor = lazy(async () => {
  const module = await import("./AreaEditor");
  return { default: module.AreaEditor };
});

const LOCALIZATION = "localization";
type ToastKind = "success" | "error";
interface Toast { readonly id: number; readonly message: string; readonly kind: ToastKind; }
type ActionDialogState =
  | { readonly kind: "new" }
  | { readonly kind: "delete-region"; readonly index: number; readonly name: string }
  | { readonly kind: "duplicate-mode"; readonly index: number }
  | { readonly kind: "delete-mode"; readonly index: number; readonly used: boolean };

export interface AppProps {
  readonly editorDocument: EditorDocument<PalLawConfig>;
  readonly createMap?: (element: HTMLElement, callbacks: MapCallbacks) => MapController;
}

function download(name: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function App(props: AppProps) {
  const model = createEditorModel(props.editorDocument);
  const commands = createPalLawCommands(props.editorDocument, model);
  const selectedMessage = () => model.state.selectedMessageId;
  const setSelectedMessage = (id: string) => { model.setSelectedMessage(id); };
  const activeMapId = () => model.state.activeMapId;
  const setActiveMapId = (id: string) => { model.setActiveMap(id); };
  const editingShape = () => model.state.editingShape;
  const setEditingShape = (value: boolean) => { model.setEditingShape(value); };
  const [drawing, setDrawing] = createSignal(false);
  const [drawPointCount, setDrawPointCount] = createSignal(0);
  const [coordinateReadout, setCoordinateReadout] = createSignal("Map X - | Y -");
  const editingWilderness = () => model.state.editingWilderness;
  const editingStageAreas = () => model.state.editingStageAreas;
  const areaDialogOpen = () => model.state.areaDialogOpen;
  const [rawValue, setRawValue] = createSignal(model.state.snapshot.serialized);
  const [toasts, setToasts] = createSignal<readonly Toast[]>([]);
  const [actionDialogState, setActionDialogState] = createSignal<ActionDialogState | null>(null);
  const [duplicateName, setDuplicateName] = createSignal("");
  const [duplicateId, setDuplicateId] = createSignal("");
  const [replacementMode, setReplacementMode] = createSignal("");
  let toastId = 0;
  let mapElement!: HTMLDivElement;
  let importInput!: HTMLInputElement;
  let areaDialog!: HTMLDialogElement;
  let actionDialog!: HTMLDialogElement;
  let areaCloseButton!: HTMLButtonElement;
  let actionDialogTrigger: HTMLElement | null = null;
  let mapController: MapController | undefined;

  const snapshot = () => model.state.snapshot;
  const config = () => snapshot().config as PalLawConfig;
  const selectedRegion = () => model.state.selectedRegionIndex === null ? null : config().regions[model.state.selectedRegionIndex] ?? null;
  const selectedMode = () => config().modes[model.state.selectedModeIndex] ?? null;
  const selectedSchedule = () => config().schedules[model.state.selectedScheduleIndex] ?? null;
  const area = () => editingWilderness()
    ? config().wilderness
    : editingStageAreas()
      ? config().stageAreas
      : selectedRegion();
  const messageCollection = () => config().messages as unknown as MessageCollection;
  const messageResolved = (subject: Pick<PalLawConfig["wilderness"], "mode" | "messages">) => resolveAreaMessages(config(), subject) as never;

  const toast = (message: string, kind: ToastKind = "success") => {
    const id = ++toastId;
    setToasts((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => { setToasts((current) => current.filter((entry) => entry.id !== id)); }, 3600);
  };
  const setSection = (section: EditorSection) => {
    model.setSection(section);
    model.setWorkspaceView(["regions", "modes", "schedules", "messages"].includes(section) ? "list" : "edit");
    setEditingShape(false);
    if (section === "json") setRawValue(snapshot().serialized);
  };
  const selectMap = (id: string) => {
    if (!MAPS.some((entry) => entry.id === id)) return;
    setActiveMapId(id);
    setEditingShape(false);
    const current = selectedRegion();
    if (current && current.map !== id) {
      const candidate = config().regions.findIndex((region) => region.map === id);
      model.selectRegion(candidate >= 0 ? candidate : null);
    }
  };
  const openArea = (kind: "wilderness" | "stageAreas" | "region", index: number | null, trigger?: HTMLElement) => {
    model.setAreaDialog(true, kind);
    if (kind === "region" && index !== null) {
      model.selectRegion(index);
      const region = config().regions[index];
      if (region?.map) setActiveMapId(region.map);
    }
    queueMicrotask(() => { areaDialog.showModal?.(); areaCloseButton.focus(); });
    if (trigger) areaDialog.addEventListener("close", () => { if (trigger.isConnected) trigger.focus(); }, { once: true });
  };
  const closeArea = () => { areaDialog.close?.(); model.setAreaDialog(false); };
  const openActionDialog = (state: ActionDialogState, trigger?: HTMLElement) => {
    actionDialogTrigger = trigger ?? null;
    if (state.kind === "duplicate-mode") {
      const source = config().modes[state.index];
      setDuplicateName(source ? `${source.name} Copy` : "");
      setDuplicateId(source ? `${source.id}-copy` : "");
    }
    if (state.kind === "delete-mode") setReplacementMode(config().modes.find((_, index) => index !== state.index)?.id ?? "");
    setActionDialogState(state);
    queueMicrotask(() => { actionDialog.showModal?.(); });
  };
  const closeActionDialog = () => { actionDialog.close?.(); setActionDialogState(null); const trigger = actionDialogTrigger; actionDialogTrigger = null; if (trigger?.isConnected) trigger.focus(); };
  const confirmActionDialog = () => {
    const state = actionDialogState();
    if (!state) return;
    if (state.kind === "new") {
      props.editorDocument.import(stringifyConfig(createDefaultConfig()));
      toast("New configuration created.");
    } else if (state.kind === "delete-region") commands.deleteRegion(state.index);
    else if (state.kind === "duplicate-mode") {
      if (!duplicateName().trim() || !commands.duplicateMode(state.index, duplicateName().trim(), duplicateId().trim())) { toast("Mode name and ID must be valid and unique.", "error"); return; }
    } else commands.deleteMode(state.index, replacementMode());
    closeActionDialog();
  };

  const nextRegionName = () => {
    const names = new Set([config().wilderness.name.toLocaleLowerCase(), config().stageAreas.name.toLocaleLowerCase(), ...config().regions.map((region) => region.name.toLocaleLowerCase())]);
    let number = config().regions.length + 1;
    while (names.has(`region ${number}`)) number += 1;
    return `Region ${number}`;
  };

  const applyAreaIntent = (intent: AreaIntent) => {
    if (intent.type === "fit-region") { mapController?.dispatch({ type: "fit-selected" }); return; }
    commands.applyArea(
      editingWilderness()
        ? { kind: "wilderness" }
        : editingStageAreas()
          ? { kind: "stageAreas" }
          : { kind: "region", index: model.state.selectedRegionIndex! },
      intent
    );
    if (intent.type === "set-map") selectMap(intent.value);
  };

  const applyModeIntent = (intent: ModeIntent) => {
    commands.applyMode(model.state.selectedModeIndex, intent);
  };

  const messageSummaries = createMemo(() => MESSAGE_EVENTS.map((event) => {
    const message = config().messages[event.id as "regionChanged" | "actionDenied" | "levelDenied"];
    const outputCount = enabledMessageOutputCount(message);
    return { id: event.id, label: event.label, enabled: config().messages.enabled && message.enabled && outputCount > 0, outputCount, cooldownSeconds: message.cooldownSeconds };
  }));
  const sidebarState = (): SidebarState => ({
    section: model.state.activeSection, config: config(), selectedRegionIndex: model.state.selectedRegionIndex,
    selectedModeIndex: model.state.selectedModeIndex, selectedScheduleIndex: model.state.selectedScheduleIndex,
    selectedMessageId: selectedMessage(), messages: messageSummaries()
  });
  const sidebarActions: SidebarActions = {
    selectRegion: (index) => { model.selectRegion(index); model.setWorkspaceView("map"); const region = config().regions[index]; if (region?.map) setActiveMapId(region.map); },
    openWilderness: (trigger) => { openArea("wilderness", null, trigger); },
    openStageAreas: (trigger) => { openArea("stageAreas", null, trigger); },
    openRegion: (index, trigger) => { openArea("region", index, trigger); },
    moveRegion: commands.moveRegion,
    duplicateRegion: (index) => { commands.duplicateRegion(index); },
    deleteRegion: (index, trigger) => { const region = config().regions[index]; if (region) openActionDialog({ kind: "delete-region", index, name: region.name }, trigger); },
    selectMode: (index) => { model.selectMode(index); model.setWorkspaceView("edit"); },
    moveMode: commands.moveMode,
    duplicateMode: (index, trigger) => { openActionDialog({ kind: "duplicate-mode", index }, trigger); },
    deleteMode: (index, trigger) => {
      if (config().modes.length <= 1) return;
      const source = config().modes[index]; if (!source) return;
      const used = [config().wilderness, config().stageAreas, ...config().regions].some((area) => area.mode === source.id);
      openActionDialog({ kind: "delete-mode", index, used }, trigger);
    },
    selectSchedule: (index) => { model.selectSchedule(index); model.setWorkspaceView("edit"); },
    addSchedule: () => { commands.addSchedule(); model.setWorkspaceView("edit"); },
    moveSchedule: commands.moveSchedule,
    duplicateSchedule: (index) => { commands.duplicateSchedule(index); model.setWorkspaceView("edit"); },
    deleteSchedule: (index) => { commands.deleteSchedule(index); },
    selectMessage: (id) => { setSelectedMessage(id); model.setWorkspaceView("edit"); }
  };

  const changeSetting = (scope: SettingScope, id: string, value: boolean | number) => { commands.changeSetting(scope, id, value); };
  const applyJson = (value: string) => {
    const result = props.editorDocument.import(value);
    if (result.accepted) { setRawValue(props.editorDocument.read().serialized); toast("JSON applied."); }
    else toast(result.errors.join("\n"), "error");
  };

  onMount(() => {
    const factory = props.createMap ?? createLeafletMap;
    mapController = factory(mapElement, {
      onSelect: (index) => { model.selectRegion(index); },
      onPolygonChange: commands.setRegionPolygon,
      onDrawn: (polygon) => {
        commands.addRegion(nextRegionName(), activeMapId(), polygon);
        toast("Region created. Name and configure it in the inspector.");
      },
      onCoordinate: setCoordinateReadout,
      onDrawingChange: (active, count) => { setDrawing(active); setDrawPointCount(count); }
    });
    createEffect(() => { mapController?.update({ maps: MAPS, activeMapId: activeMapId(), modes: config().modes, regions: config().regions, selectedRegionIndex: model.state.selectedRegionIndex, editingShape: editingShape() }); });
    queueMicrotask(() => { mapController?.dispatch({ type: "fit-visible" }); });
  });

  const keyboard = (event: KeyboardEvent) => {
    const target = event.target;
    if (event.key === "Escape" && drawing()) mapController?.dispatch({ type: "cancel-drawing" });
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLocaleLowerCase() === "z") { event.preventDefault(); props.editorDocument.dispatch({ type: "undo" }); }
    if ((event.ctrlKey || event.metaKey) && (event.key.toLocaleLowerCase() === "y" || event.shiftKey && event.key.toLocaleLowerCase() === "z")) { event.preventDefault(); props.editorDocument.dispatch({ type: "redo" }); }
  };
  const beforeUnload = (event: BeforeUnloadEvent) => { if (snapshot().dirty) event.preventDefault(); };
  document.addEventListener("keydown", keyboard);
  window.addEventListener("beforeunload", beforeUnload);
  onCleanup(() => { document.removeEventListener("keydown", keyboard); window.removeEventListener("beforeunload", beforeUnload); mapController?.dispose(); model.dispose(); });

  const sections: readonly [EditorSection, string][] = [["regions", "Regions"], ["modes", "Modes"], ["schedules", "Schedules"], ["messages", "Messages"], ["settings", "Settings"], ["json", "Raw JSON"]];
  const workspaceView = () => model.state.workspaceView;
  const selectedEvent = () => MESSAGE_EVENTS.find((event) => event.id === selectedMessage()) ?? MESSAGE_EVENTS[0]!;
  const selectedArea = () => area();

  return <>
    <a class="skip-link" href="#workspace">Skip to editor</a>
    <div class="app-shell">
      <header class="topbar"><div class="topbar-main"><div class="brand-block"><div><div class="eyebrow">PalLaw</div><h1>Rules Studio</h1></div></div><p class="non-affiliation">Unofficial fan project · Not affiliated with Pocketpair</p>
        <div class="top-actions">
          <div class="history-actions" aria-label="Change history">
            <button class="icon-button history-button" type="button" aria-label="Undo" disabled={!snapshot().canUndo} onClick={() => { props.editorDocument.dispatch({ type: "undo" }); }}><span class="hero-icon hero-icon-arrow-uturn-left" aria-hidden="true" /></button>
            <button class="icon-button history-button" type="button" aria-label="Redo" disabled={!snapshot().canRedo} onClick={() => { props.editorDocument.dispatch({ type: "redo" }); }}><span class="hero-icon hero-icon-arrow-uturn-right" aria-hidden="true" /></button>
          </div>
          <button class="button ghost" type="button" onClick={(event) => { openActionDialog({ kind: "new" }, event.currentTarget); }}>New</button>
          <button class="button ghost" type="button" onClick={() => { importInput.click(); }}>Import</button>
          <button class="button primary" type="button" aria-label="Export PalLaw.json" disabled={!snapshot().validation.valid} onClick={() => { const exported = props.editorDocument.export(); download(exported.fileName, exported.contents); props.editorDocument.dispatch({ type: "mark-exported" }); toast(`${exported.fileName} exported.`); }}><span class="export-label-full">Export PalLaw.json</span><span class="export-label-short">Export</span></button>
          <div class="top-actions-divider" aria-hidden="true" />
          <a class="discord-link" href="https://discord.gg/zzhK54aaYz" target="_blank" rel="noreferrer">Discord</a>
          <SupportControl />
          <ThemeToggle />
        </div></div>
        <nav class="section-nav" aria-label="Configuration sections"><For each={sections}>{([id, label]) => <button type="button" classList={{ "section-tab": true, active: model.state.activeSection === id }} onClick={() => { setSection(id); }}><span>{label}</span><Show when={id === "regions" || id === "modes" || id === "schedules"}><span class="count-badge">{id === "regions" ? config().regions.length : id === "modes" ? config().modes.length : config().schedules.length}</span></Show></button>}</For></nav>
        <nav class="workspace-view-nav" aria-label="Workspace view"><WorkspaceViewNav section={model.state.activeSection} view={workspaceView()} messageLabel={selectedMessage() === LOCALIZATION ? "Localization" : "Message"} onSelect={(view) => { model.setWorkspaceView(view); }} /></nav>
      </header>
      <main id="workspace" class="workspace" data-section={model.state.activeSection} data-view={workspaceView()} data-layout={["regions", "modes", "schedules", "messages"].includes(model.state.activeSection) ? "split" : "single"}>
        <aside class="workspace-pane workspace-sidebar navigation-panel" data-workspace-pane="list" aria-label="Configuration sections"><section class="sidebar-content"><Sidebar state={sidebarState()} actions={sidebarActions} /></section></aside>
        <section class="workspace-pane workspace-content map-panel" data-workspace-pane="map" aria-label="Area map"><div class="map-core"><div class="map-toolbar"><div class="segmented" aria-label="Coordinate map"><MapSwitcher maps={MAPS} activeId={activeMapId()} onSelect={selectMap} /></div><p class="map-guide">{model.state.activeSection === "schedules" ? selectedRegion() ? "The first assigned Region is highlighted while you edit this schedule." : "Use Area assignments in the schedule settings; polygon Regions remain visible here for context." : drawing() ? `${drawPointCount()} points added` : editingShape() ? "Drag the round handles to reshape the selected region." : selectedRegion() ? "Drag the selected region to move it. Choose Edit shape to move vertices." : "Select a region to move or reshape it."}</p><div class="map-toolbar-actions">
          <button class="button compact ghost" type="button" aria-pressed={editingShape()} disabled={!selectedRegion() || drawing()} hidden={drawing() || model.state.activeSection === "schedules"} onClick={() => { setEditingShape(!editingShape()); }}>{editingShape() ? "Done" : "Edit shape"}</button>
          <button class="button compact primary" type="button" hidden={drawing() || model.state.activeSection === "schedules"} onClick={() => { setEditingShape(false); mapController?.dispatch({ type: "start-drawing" }); }}>Draw region</button>
          <button class="button compact success" type="button" hidden={!drawing()} disabled={drawPointCount() < 3} onClick={() => { mapController?.dispatch({ type: "finish-drawing" }); }}>Finish</button>
          <button class="button compact danger" type="button" hidden={!drawing()} onClick={() => { mapController?.dispatch({ type: "cancel-drawing" }); }}>Cancel</button><button class="button compact ghost" type="button" onClick={() => { mapController?.dispatch({ type: "fit-visible" }); }}>Fit</button></div></div>
          <div ref={mapElement} class="map" tabindex="0" aria-label="Interactive coordinate map" /><div class="draw-hint" hidden={!drawing()} aria-live="polite">Click to add vertices. Double-click or choose Finish after at least three points. Press Escape to cancel.</div><div class="map-footer"><span id="coordinateReadout" class="mono">{coordinateReadout()}</span><a class="legal-link" href="../legal/">Unofficial | Map notice</a></div></div></section>
        <aside class="workspace-pane workspace-content inspector-panel" data-workspace-pane="edit" aria-label="Selected item editor"><div class="inspector-core"><div class="inspector-content">
          <Show when={model.state.activeSection === "modes"}>{selectedMode() ? <ModeInspector mode={selectedMode()!} messages={messageCollection()} resolvedMessages={messageResolved({ mode: selectedMode()!.id, messages: selectedMode()!.messages })} onChange={applyModeIntent} /> : null}</Show>
          <Show when={model.state.activeSection === "schedules"}>{selectedSchedule() ? <ScheduleInspector schedule={selectedSchedule()!} modes={config().modes} wilderness={config().wilderness} stageAreas={config().stageAreas} regions={config().regions} onUpdate={(apply) => { commands.updateSchedule(model.state.selectedScheduleIndex, apply); }} onAssign={(kind, index, assigned) => { commands.setScheduleArea(selectedSchedule()!.id, kind, index, assigned); }} /> : null}</Show>
          <Show when={model.state.activeSection === "messages"}>{selectedMessage() === LOCALIZATION ? <LocalizationInspector names={config().messages.actionNames} onChange={commands.setActionName} /> : <MessageInspector messages={messageCollection()} resolved={config().messages as never} selectedEventId={selectedEvent().id} modeName={config().modes[0]?.name ?? ""} showHeader onChange={(intent) => { commands.applyMessage({ kind: "global" }, intent); }} />}</Show>
          <Show when={model.state.activeSection === "settings"}><SettingsInspector settings={config().settings} regionalCombat={config().regionalCombat} onChange={changeSetting} /></Show>
          <Show when={model.state.activeSection === "json"}><JsonInspector value={rawValue()} onValue={setRawValue} onApply={applyJson} onToast={toast} /></Show>
        </div></div></aside>
      </main>
    </div>
    <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={async (event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (!file) return; const result = props.editorDocument.import(new Uint8Array(await file.arrayBuffer())); if (result.accepted) toast(`${file.name} imported.`); else toast(result.errors.join("\n"), "error"); }} />
    <div class="toast-region" aria-live="polite" aria-atomic="true"><For each={toasts()}>{(entry) => <div class={`toast ${entry.kind}`}>{entry.message}</div>}</For></div>
    <dialog ref={actionDialog} class="dialog" aria-labelledby="actionDialogTitle" onClose={() => { setActionDialogState(null); const trigger = actionDialogTrigger; actionDialogTrigger = null; if (trigger?.isConnected) trigger.focus(); }}>
      <div>
        <Show when={actionDialogState()?.kind === "new"}><h2 id="actionDialogTitle">Create a new configuration</h2><p>Replace the current editor state with a clean configuration containing only the Wilderness?</p></Show>
        <Show when={actionDialogState()?.kind === "delete-region"}><h2 id="actionDialogTitle">Delete region</h2><p>Delete “{(actionDialogState() as Extract<ActionDialogState, { kind: "delete-region" }>).name}”?</p></Show>
        <Show when={actionDialogState()?.kind === "duplicate-mode"}><h2 id="actionDialogTitle">Duplicate mode</h2><label class="field"><span>Unique name</span><input aria-label="Unique name" maxlength="96" value={duplicateName()} onInput={(event) => { setDuplicateName(event.currentTarget.value); }} /></label><label class="field"><span>Immutable ID</span><input aria-label="Immutable ID" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={duplicateId()} onInput={(event) => { setDuplicateId(event.currentTarget.value); }} /></label></Show>
        <Show when={actionDialogState()?.kind === "delete-mode"}>{(() => { const value = actionDialogState() as Extract<ActionDialogState, { kind: "delete-mode" }>; const source = () => config().modes[value.index]; return <><h2 id="actionDialogTitle">Delete mode</h2><p>{value.used ? `${source()?.name ?? "This mode"} is in use. Choose the mode that should receive every reference; area overrides remain unchanged.` : `Delete “${source()?.name ?? "this mode"}”?`}</p><Show when={value.used}><label class="field"><span>Replacement mode</span><select aria-label="Replacement mode" value={replacementMode()} onChange={(event) => { setReplacementMode(event.currentTarget.value); }}><For each={config().modes.filter((_, index) => index !== value.index)}>{(mode) => <option value={mode.id}>{mode.name} ({mode.id})</option>}</For></select></label></Show></>; })()}</Show>
        <div class="dialog-actions"><button type="button" class="button ghost" onClick={closeActionDialog}>Cancel</button><button type="button" classList={{ button: true, danger: actionDialogState()?.kind === "delete-region" || actionDialogState()?.kind === "delete-mode", primary: actionDialogState()?.kind === "new" || actionDialogState()?.kind === "duplicate-mode" }} onClick={confirmActionDialog}>{actionDialogState()?.kind === "duplicate-mode" ? "Duplicate" : actionDialogState()?.kind === "new" ? "Create" : "Confirm"}</button></div>
      </div>
    </dialog>
    <dialog ref={areaDialog} class="region-editor-dialog" onClose={() => { model.setAreaDialog(false); }}><div class="region-editor-shell"><header class="region-editor-header"><div><p>{editingWilderness() ? "Wilderness settings" : editingStageAreas() ? "Stage Areas settings" : "Region settings"}</p><h2>{selectedArea()?.name ?? "Region"}</h2></div><button ref={areaCloseButton} class="region-editor-close" type="button" aria-label="Close area settings" onClick={closeArea}><span class="hero-icon hero-icon-x-mark" aria-hidden="true" /></button></header><div class="region-editor-content"><Show when={areaDialogOpen() && selectedArea()}>{(current) => <AreaEditor area={current()} kind={editingWilderness() ? "wilderness" : editingStageAreas() ? "stageAreas" : "region"} modes={config().modes} maps={MAPS} effectiveActions={effectiveActions(current())} effectiveCombat={effectiveCombat(current())} modeName={modeDefinition(current().mode, config()).name} modeMinimumLevel={effectiveMinimumLevel({ mode: current().mode }, config())} regionalCombatEnabled={config().regionalCombat.enabled} messages={messageCollection()} resolvedMessages={messageResolved(current())} overrideFor={(source, target) => combatOverride(current(), source, target)} onChange={applyAreaIntent} />}</Show></div><footer class="region-editor-footer"><div class="dialog-actions" aria-label="Change history"><button class="icon-button history-button" type="button" aria-label="Undo" disabled={!snapshot().canUndo} onClick={() => { props.editorDocument.dispatch({ type: "undo" }); }}><span class="hero-icon hero-icon-arrow-uturn-left" aria-hidden="true" /></button><button class="icon-button history-button" type="button" aria-label="Redo" disabled={!snapshot().canRedo} onClick={() => { props.editorDocument.dispatch({ type: "redo" }); }}><span class="hero-icon hero-icon-arrow-uturn-right" aria-hidden="true" /></button></div><button class="button primary" type="button" onClick={closeArea}>Done</button></footer></div></dialog>
  </>;
}
