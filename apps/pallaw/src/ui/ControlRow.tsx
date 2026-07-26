import type { JSX, ParentProps } from "solid-js";

interface CommonControlRowProps {
  readonly label: string;
  readonly accessibleLabel?: string;
  readonly description?: string;
  readonly disabled?: boolean;
  readonly variant?: "grouped" | "standalone";
  readonly class?: string;
}

interface BooleanControlRowProps extends CommonControlRowProps {
  readonly kind: "boolean";
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
}

interface NumberControlRowProps extends CommonControlRowProps {
  readonly kind: "number";
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}

export type ControlRowProps = BooleanControlRowProps | NumberControlRowProps;

function classes(...values: readonly (string | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export function ControlRow(props: ControlRowProps): JSX.Element {
  const grouped = () => props.variant !== "standalone";
  const rowClass = () => classes(
    grouped() ? "control-row" : "toggle-row",
    props.kind === "number" ? "control-row-number" : undefined,
    props.class
  );
  return <label class={rowClass()}>
    <span class="control-row-copy">
      <strong>{props.label}</strong>
      {props.description ? <span>{props.description}</span> : null}
    </span>
    {props.kind === "boolean"
      ? <span class="switch"><input aria-label={props.accessibleLabel ?? props.label} type="checkbox" checked={props.checked} disabled={props.disabled} onChange={(event) => { props.onChange(event.currentTarget.checked); }} /><span class="switch-track" /></span>
      : <input aria-label={props.accessibleLabel ?? props.label} type="number" min={props.min} max={props.max} step={props.step} value={props.value} disabled={props.disabled} onChange={(event) => {
        const value = Number(event.currentTarget.value);
        props.onChange(Math.max(props.min, Math.min(props.max, value)));
      }} />}
  </label>;
}

export function ControlRowGroup(props: ParentProps<{ readonly class?: string }>): JSX.Element {
  return <div class={classes("control-row-group", props.class)}>{props.children}</div>;
}
