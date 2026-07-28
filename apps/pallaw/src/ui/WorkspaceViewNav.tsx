import { For } from "solid-js";
import type { EditorSection, WorkspaceView } from "../editor/create-editor-model";

interface WorkspaceViewNavProps {
  readonly section: EditorSection;
  readonly view: WorkspaceView;
  readonly messageLabel?: string;
  readonly onSelect: (view: WorkspaceView) => void;
}

function availableViews(section: EditorSection, messageLabel = "Message"): ReadonlyArray<readonly [WorkspaceView, string]> {
  if (section === "regions") return [["list", "Regions"], ["map", "Map"]];
  if (section === "modes") return [["list", "Modes"], ["edit", "Mode"]];
  if (section === "schedules") return [["list", "Schedules"], ["edit", "Schedule"]];
  if (section === "messages") return [["list", "Events"], ["edit", messageLabel]];
  return [];
}

export function WorkspaceViewNav(props: WorkspaceViewNavProps) {
  return (
    <For each={availableViews(props.section, props.messageLabel)}>
      {([id, label]) => (
        <button
          type="button"
          data-workspace-view={id}
          classList={{ active: props.view === id }}
          aria-pressed={props.view === id}
          onClick={() => { props.onSelect(id); }}
        >
          {label}
        </button>
      )}
    </For>
  );
}
