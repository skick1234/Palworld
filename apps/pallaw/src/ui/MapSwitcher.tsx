import { For } from "solid-js";

interface MapOption { readonly id: string; readonly label: string; }

export function MapSwitcher(props: { readonly maps: readonly MapOption[]; readonly activeId: string; readonly onSelect: (id: string) => void }) {
  return <For each={props.maps}>{(map) => (
    <button type="button" classList={{ active: map.id === props.activeId }} aria-pressed={map.id === props.activeId} onClick={() => { props.onSelect(map.id); }}>{map.label}</button>
  )}</For>;
}
