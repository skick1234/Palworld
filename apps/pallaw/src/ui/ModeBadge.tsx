export interface ModeSummary {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export function ModeBadge(props: { readonly modeId: string; readonly modes: readonly ModeSummary[] }) {
  const definition = () => props.modes.find((mode) => mode.id === props.modeId) ?? props.modes[0];
  return (
    <span class="badge mode-badge" style={{ "--mode-color": definition()?.color ?? "#64748b" }}>
      {definition()?.name ?? props.modeId}
    </span>
  );
}
