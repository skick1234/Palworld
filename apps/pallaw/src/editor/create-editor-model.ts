import { createStore } from "solid-js/store";
import type { EditorDocument, EditorSnapshot } from "../document/create-editor-document";

export type EditorSection = "regions" | "modes" | "messages" | "settings" | "json";
export type WorkspaceView = "list" | "map" | "edit";

interface EditorConfigurationShape {
  readonly regions: readonly unknown[];
  readonly modes: readonly unknown[];
}

export interface EditorViewState<TConfig> {
  readonly snapshot: EditorSnapshot<TConfig>;
  readonly activeSection: EditorSection;
  readonly workspaceView: WorkspaceView;
  readonly selectedRegionIndex: number | null;
  readonly selectedModeIndex: number;
  readonly regionSearch: string;
  readonly modeSearch: string;
}

interface MutableEditorViewState<TConfig> {
  snapshot: EditorSnapshot<TConfig>;
  activeSection: EditorSection;
  workspaceView: WorkspaceView;
  selectedRegionIndex: number | null;
  selectedModeIndex: number;
  regionSearch: string;
  modeSearch: string;
}

export interface EditorModel<TConfig> {
  readonly state: EditorViewState<TConfig>;
  setSection(section: EditorSection): void;
  setWorkspaceView(view: WorkspaceView): void;
  selectRegion(index: number | null): void;
  selectMode(index: number): void;
  setRegionSearch(value: string): void;
  setModeSearch(value: string): void;
  dispose(): void;
}

export function createEditorModel<TConfig extends EditorConfigurationShape>(document: EditorDocument<TConfig>): EditorModel<TConfig> {
  const initial = document.read();
  const [state, setState] = createStore<MutableEditorViewState<TConfig>>({
    snapshot: initial,
    activeSection: "regions",
    workspaceView: "list",
    selectedRegionIndex: initial.config.regions.length ? 0 : null,
    selectedModeIndex: 0,
    regionSearch: "",
    modeSearch: ""
  });

  const unsubscribe = document.subscribe((snapshot) => {
    const regionIndex = snapshot.config.regions.length === 0
      ? null
      : Math.min(state.selectedRegionIndex ?? 0, snapshot.config.regions.length - 1);
    const modeIndex = Math.max(0, Math.min(state.selectedModeIndex, snapshot.config.modes.length - 1));
    setState("snapshot", snapshot);
    setState("selectedRegionIndex", regionIndex);
    setState("selectedModeIndex", modeIndex);
  });

  const model: EditorModel<TConfig> = {
    state: state as EditorViewState<TConfig>,
    setSection: (activeSection: EditorSection) => { setState("activeSection", activeSection); },
    setWorkspaceView: (workspaceView: WorkspaceView) => { setState("workspaceView", workspaceView); },
    selectRegion: (index: number | null) => { setState("selectedRegionIndex", index); },
    selectMode: (index: number) => { setState("selectedModeIndex", index); },
    setRegionSearch: (value: string) => { setState("regionSearch", value); },
    setModeSearch: (value: string) => { setState("modeSearch", value); },
    dispose: unsubscribe
  };
  return Object.freeze(model);
}
