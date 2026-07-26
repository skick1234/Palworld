import { For, Show, createSignal } from "solid-js";
import { ALERT_PRESENTATIONS, ALERT_TONES, MESSAGE_EVENTS, formatTemplate } from "../domain/rules";
import type { MessageIntent } from "../editor/intents";
export type { MessageIntent } from "../editor/intents";

interface AlertMessage { readonly enabled: boolean; readonly text: string; readonly tone?: string; }
interface EventMessage {
  readonly enabled: boolean;
  readonly cooldownSeconds: number;
  readonly chat: { readonly enabled: boolean; readonly text: string };
  readonly alerts: Readonly<Record<string, AlertMessage>>;
}
export interface MessageCollection {
  readonly enabled: boolean;
  readonly actionNames: Readonly<Record<string, string>>;
  readonly [eventId: string]: unknown;
}

function enabledOutputCount(message: EventMessage): number {
  return Number(message.chat.enabled) + Object.values(message.alerts).filter((alert) => alert.enabled).length;
}

function Preview(props: { readonly message: EventMessage; readonly values: Readonly<Record<string, string | number>> }) {
  const outputs = () => enabledOutputCount(props.message);
  return <div class="preview-box">
    <div class="eyebrow">Preview</div>
    <Show when={props.message.chat.enabled}><div class="preview-chat">Chat: {formatTemplate(props.message.chat.text, props.values)}</div></Show>
    <For each={ALERT_PRESENTATIONS}>{(presentation) => {
      const alert = () => props.message.alerts[presentation.id]!;
      return <Show when={alert().enabled}><div class={`preview-alert ${presentation.id} tone-${presentation.id === "brief" ? alert().tone ?? "normal" : "normal"}`}><span class="preview-alert-icon" aria-hidden="true"><span class="hero-icon hero-icon-exclamation-circle" /></span><span class="preview-alert-text">{formatTemplate(alert().text, props.values)}</span></div></Show>;
    }}</For>
    <Show when={outputs() === 0}><div class="preview-empty">All outputs are disabled.</div></Show>
  </div>;
}

export function MessageInspector(props: {
  readonly messages: MessageCollection;
  readonly resolved: Readonly<Record<string, EventMessage>>;
  readonly selectedEventId?: string;
  readonly areaName?: string;
  readonly modeName: string;
  readonly overrides?: Readonly<Record<string, unknown>>;
  readonly showHeader?: boolean;
  readonly onChange: (intent: MessageIntent) => void;
}) {
  const textareas: Record<string, HTMLTextAreaElement | undefined> = {};
  const previewValues = () => ({ region: props.areaName ?? "Wilderness", previousRegion: "Wilderness", mode: props.modeName, action: props.messages.actionNames.build ?? "Building", minimumLevel: 20, playerLevel: 12 });
  const insert = (key: string, placeholder: string) => {
    const textarea = textareas[key];
    if (!textarea) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    textarea.setRangeText(placeholder, start, end, "end");
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    textarea.focus();
  };
  const events = () => MESSAGE_EVENTS.filter((event) => !props.selectedEventId || event.id === props.selectedEventId);
  const selectedDefinition = () => MESSAGE_EVENTS.find((event) => event.id === props.selectedEventId) ?? MESSAGE_EVENTS[0]!;
  return <>
    <Show when={Boolean(props.showHeader && props.selectedEventId)}><div class="inspector-header"><h2>{selectedDefinition().label}</h2><p>System chat and native Palworld alert presentations are configured independently for this event.</p></div></Show>
    <Show when={!props.areaName}><div class="toggle-row"><div class="checkbox-copy"><strong>Enable all messages</strong><span>Master switch for every configured player message.</span></div><label class="switch"><input aria-label="Enable all messages" type="checkbox" checked={props.messages.enabled} onChange={(event) => { props.onChange({ type: "set-messages-enabled", value: event.currentTarget.checked }); }} /><span class="switch-track" /></label></div></Show>
    <Show when={props.areaName}><p class="help">Events without a local override use the current global defaults. Customize only what this area needs.</p></Show>
    <div class="message-event-list"><For each={events()}>{(event) => {
      const message = () => props.resolved[event.id]!;
      const usesDefault = () => Boolean(props.areaName) && !Object.hasOwn(props.overrides ?? {}, event.id);
      const placeholders = (channel: "chat" | "alert", presentation = "") => <div class="placeholder-row"><For each={event.placeholders}>{(placeholder) => <button type="button" class="placeholder" disabled={usesDefault()} onClick={() => { insert(`${event.id}:${channel}:${presentation}`, placeholder); }}>{placeholder}</button>}</For></div>;
      return <details classList={{ "message-event": true, "selected-event": Boolean(props.selectedEventId), "uses-default": usesDefault() }} open={Boolean(props.selectedEventId)}>
        <summary><strong>{event.label}</strong><span>{usesDefault() ? "Default" : message().enabled ? `${enabledOutputCount(message())} outputs` : "Disabled"}</span><Show when={usesDefault()}><span class="badge">Global</span></Show></summary>
        <div class="message-event-body">
          <Show when={props.areaName}><div class="toggle-row message-override-toggle"><div class="checkbox-copy"><strong>Override global message</strong><span>Use custom settings for {props.areaName}.</span></div><label class="switch"><input aria-label={`Override ${event.label}`} type="checkbox" checked={!usesDefault()} onChange={(change) => { props.onChange({ type: "set-override", eventId: event.id, value: change.currentTarget.checked }); }} /><span class="switch-track" /></label></div></Show>
          <div class="control-row-group event-settings-card">
            <div class="control-row"><span class="checkbox-copy"><strong>Enable event</strong><span>{event.description}</span></span><label class="switch"><input aria-label={`Enable ${event.label}`} type="checkbox" checked={message().enabled} disabled={usesDefault()} onChange={(change) => { props.onChange({ type: "set-event-enabled", eventId: event.id, value: change.currentTarget.checked }); }} /><span class="switch-track" /></label></div>
            <label class="control-row control-row-number"><span class="checkbox-copy"><strong>Cooldown seconds</strong></span><input aria-label={`${event.label} cooldown seconds`} type="number" min="0" max="300" step="0.1" value={message().cooldownSeconds} disabled={usesDefault()} onChange={(change) => { props.onChange({ type: "set-cooldown", eventId: event.id, value: Math.max(0, Math.min(300, Number(change.currentTarget.value))) }); }} /></label>
          </div>
          <div class="channel-card">
            <div class="channel-header"><div><strong>System chat</strong><small>Private system-chat message for the affected player.</small></div><label class="switch"><input aria-label="Enable System chat" type="checkbox" checked={message().chat.enabled} disabled={usesDefault()} onChange={(change) => { props.onChange({ type: "set-chat-enabled", eventId: event.id, value: change.currentTarget.checked }); }} /><span class="switch-track" /></label></div>
            <label class="field"><span>Message</span><textarea ref={(element) => { textareas[`${event.id}:chat:`] = element; }} maxlength="512" disabled={usesDefault()} value={message().chat.text} onChange={(change) => { props.onChange({ type: "set-chat-text", eventId: event.id, value: change.currentTarget.value }); }} /></label>
            {placeholders("chat")}
          </div>
          <div class="alert-channel-list"><For each={ALERT_PRESENTATIONS}>{(presentation) => {
            const alert = () => message().alerts[presentation.id]!;
            return <div class="channel-card">
              <div class="channel-header"><div><strong>{presentation.label}</strong><small>{presentation.description}</small></div><label class="switch"><input aria-label={`Enable ${presentation.label}`} type="checkbox" checked={alert().enabled} disabled={usesDefault()} onChange={(change) => { props.onChange({ type: "set-alert-enabled", eventId: event.id, presentation: presentation.id, value: change.currentTarget.checked }); }} /><span class="switch-track" /></label></div>
              <label class="field"><span>Message</span><textarea ref={(element) => { textareas[`${event.id}:alert:${presentation.id}`] = element; }} maxlength="256" disabled={usesDefault()} value={alert().text} onChange={(change) => { props.onChange({ type: "set-alert-text", eventId: event.id, presentation: presentation.id, value: change.currentTarget.value }); }} /></label>
              <Show when={presentation.id === "brief"}><label class="field"><span>Tone</span><select disabled={usesDefault()} value={alert().tone ?? "normal"} onChange={(change) => { props.onChange({ type: "set-alert-tone", eventId: event.id, presentation: presentation.id, value: change.currentTarget.value }); }}><For each={ALERT_TONES}>{(tone) => <option value={tone.id}>{tone.label}</option>}</For></select><small>Normal is blue; negative is red.</small></label></Show>
              {placeholders("alert", presentation.id)}
            </div>;
          }}</For></div>
          <Preview message={message()} values={previewValues()} />
        </div>
      </details>;
    }}</For></div>
  </>;
}
