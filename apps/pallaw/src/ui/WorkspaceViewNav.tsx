import { For, createEffect, createSignal } from "solid-js";
import { render } from "solid-js/web";
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

interface WorkspaceViewNavState {
  readonly section: EditorSection;
  readonly view: WorkspaceView;
  readonly messageLabel?: string;
}

export function mountWorkspaceViewNav(
  element: HTMLElement,
  initial: WorkspaceViewNavState,
  onSelect: (view: WorkspaceView) => void
): { update(next: WorkspaceViewNavState): void; dispose(): void } {
  const [state, setState] = createSignal(initial);
  const dispose = render(() => {
    createEffect(() => { element.hidden = availableViews(state().section).length === 0; });
    return (
      <WorkspaceViewNav
        section={state().section}
        view={state().view}
        messageLabel={state().messageLabel}
        onSelect={onSelect}
      />
    );
  }, element);
  return { update: setState, dispose };
}
