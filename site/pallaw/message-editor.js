import {
  ALERT_PRESENTATIONS,
  ALERT_TONES,
  MESSAGE_EVENTS,
  clone,
  enabledMessageOutputCount,
  formatTemplate,
  resolveAreaMessages
} from "./rules-core.js?v=3";

export function ensureMessageOverride(config, area, eventId) {
  area.messages ||= {};
  if (!Object.hasOwn(area.messages, eventId)) {
    area.messages[eventId] = clone(resolveAreaMessages(config, area)[eventId]);
  }
  return area.messages[eventId];
}

function channelPlaceholders(event, channel, usesDefault, escapeHtml, presentation = "") {
  return event.placeholders.map((placeholder) => `
    <button
      type="button"
      class="placeholder"
      data-insert-placeholder="${escapeHtml(placeholder)}"
      data-message-channel="${channel}"
      data-presentation="${escapeHtml(presentation)}"
      data-event-id="${escapeHtml(event.id)}"
      ${usesDefault ? "disabled" : ""}
    >${escapeHtml(placeholder)}</button>`).join("");
}

function messagePreview(message, values, escapeHtml) {
  const outputs = [];
  if (message.chat.enabled) {
    outputs.push(`<div class="preview-chat">Chat: ${escapeHtml(formatTemplate(message.chat.text, values))}</div>`);
  }
  for (const presentation of ALERT_PRESENTATIONS) {
    const alert = message.alerts[presentation.id];
    if (!alert.enabled) continue;
    const tone = presentation.id === "brief" ? alert.tone : "normal";
    outputs.push(`<div class="preview-alert ${escapeHtml(presentation.id)} tone-${escapeHtml(tone)}"><span class="preview-alert-icon" aria-hidden="true"><i>!</i></span><span class="preview-alert-text">${escapeHtml(formatTemplate(alert.text, values))}</span></div>`);
  }
  return `<div class="preview-box"><div class="eyebrow">Preview</div>${outputs.length ? outputs.join("") : '<div class="preview-empty">All outputs are disabled.</div>'}</div>`;
}

export function createMessageEditor({ getConfig, mutate, escapeHtml, getAreaKey }) {
  const disclosureState = new Map();

  function openEvents(area) {
    const key = getAreaKey(area);
    if (!disclosureState.has(key)) disclosureState.set(key, new Set([MESSAGE_EVENTS[0].id]));
    return disclosureState.get(key);
  }

  function reset() {
    disclosureState.clear();
  }

  function renameAreaKey(previousKey, nextKey) {
    if (previousKey === nextKey || !disclosureState.has(previousKey)) return;
    disclosureState.set(nextKey, disclosureState.get(previousKey));
    disclosureState.delete(previousKey);
  }

  function render(messages, area = null, selectedEventId = null) {
    const resolved = area ? resolveAreaMessages(getConfig(), area) : messages;
    const previewValues = {
      region: "Protected Settlement",
      previousRegion: "Wilderness",
      mode: getConfig().messages.modeNames.pvp,
      action: getConfig().messages.actionNames.build,
      minimumLevel: 20,
      playerLevel: 12
    };
    const expanded = openEvents(area);
    const globalControls = area ? `
      <p class="help">Events without a local override use the current global defaults. Customize only what this area needs.</p>` : `
      <div class="toggle-row"><div class="checkbox-copy"><strong>Enable all messages</strong><span>Master switch for every configured player message.</span></div><label class="switch"><input id="messagesEnabled" type="checkbox" ${messages.enabled ? "checked" : ""}><span class="switch-track"></span></label></div>`;

    const events = MESSAGE_EVENTS.filter((event) => !selectedEventId || event.id === selectedEventId).map((event) => {
      const usesDefault = Boolean(area) && !Object.hasOwn(area.messages || {}, event.id);
      const message = resolved[event.id];
      const outputCount = enabledMessageOutputCount(message);
      const stateLabel = usesDefault ? "Default" : message.enabled ? `${outputCount} output${outputCount === 1 ? "" : "s"}` : "Disabled";
      const alerts = ALERT_PRESENTATIONS.map((presentation) => {
        const alert = message.alerts[presentation.id];
        const toneOptions = ALERT_TONES.map((tone) => `<option value="${escapeHtml(tone.id)}" ${alert.tone === tone.id ? "selected" : ""}>${escapeHtml(tone.label)}</option>`).join("");
        const toneControl = presentation.id === "brief"
          ? `<label class="field"><span>Tone</span><select data-alert-tone="${escapeHtml(event.id)}" data-presentation="brief" ${usesDefault ? "disabled" : ""}>${toneOptions}</select><small>Normal is blue; negative is red.</small></label>`
          : `<p class="help compact-help">Activity tips always use Palworld's normal light style.</p>`;
        return `<div class="channel-card">
          <div class="channel-header"><div><strong>${escapeHtml(presentation.label)}</strong><small>${escapeHtml(presentation.description)}</small></div><label class="switch"><input data-alert-enabled="${escapeHtml(event.id)}" data-presentation="${escapeHtml(presentation.id)}" type="checkbox" ${alert.enabled ? "checked" : ""} ${usesDefault ? "disabled" : ""}><span class="switch-track"></span></label></div>
          <label class="field"><span>Message</span><textarea data-alert-text="${escapeHtml(event.id)}" data-presentation="${escapeHtml(presentation.id)}" maxlength="256" ${usesDefault ? "disabled" : ""}>${escapeHtml(alert.text)}</textarea></label>
          ${toneControl}
          <div class="placeholder-row">${channelPlaceholders(event, "alert", usesDefault, escapeHtml, presentation.id)}</div>
        </div>`;
      }).join("");

      return `<details class="message-event ${selectedEventId ? "selected-event" : ""}" data-message-event="${escapeHtml(event.id)}" ${selectedEventId || expanded.has(event.id) ? "open" : ""}>
        <summary><strong>${escapeHtml(event.label)}</strong><span>${escapeHtml(stateLabel)}</span>${usesDefault ? '<span class="badge">Global</span>' : ""}</summary>
        <div class="message-event-body">
          ${area ? `<div class="code-actions">${usesDefault ? `<button type="button" class="button small primary" data-message-customize="${escapeHtml(event.id)}">Customize for ${escapeHtml(area.name)}</button>` : `<button type="button" class="button small ghost" data-message-reset="${escapeHtml(event.id)}">Use global defaults</button>`}</div>` : ""}
          <div class="toggle-row"><div class="checkbox-copy"><strong>Enable event</strong><span>${escapeHtml(event.description)}</span></div><label class="switch"><input data-message-enabled="${escapeHtml(event.id)}" type="checkbox" ${message.enabled ? "checked" : ""} ${usesDefault ? "disabled" : ""}><span class="switch-track"></span></label></div>
          <label class="field"><span>Cooldown seconds</span><input data-message-cooldown="${escapeHtml(event.id)}" type="number" min="0" max="300" step="0.1" value="${message.cooldownSeconds}" ${usesDefault ? "disabled" : ""}></label>
          <div class="channel-card">
            <div class="channel-header"><div><strong>System chat</strong><small>Private system-chat message for the affected player.</small></div><label class="switch"><input data-chat-enabled="${escapeHtml(event.id)}" type="checkbox" ${message.chat.enabled ? "checked" : ""} ${usesDefault ? "disabled" : ""}><span class="switch-track"></span></label></div>
            <label class="field"><span>Message</span><textarea data-chat-text="${escapeHtml(event.id)}" maxlength="512" ${usesDefault ? "disabled" : ""}>${escapeHtml(message.chat.text)}</textarea></label>
            <div class="placeholder-row">${channelPlaceholders(event, "chat", usesDefault, escapeHtml)}</div>
          </div>
          <div class="alert-channel-list">${alerts}</div>
          ${messagePreview(message, previewValues, escapeHtml)}
        </div>
      </details>`;
    }).join("");

    return `${globalControls}<div class="message-event-list">${events}</div>`;
  }

  function bind(container, messages, area = null) {
    const disclosureKey = getAreaKey(area);
    container.querySelectorAll("details[data-message-event]").forEach((details) => details.addEventListener("toggle", () => {
      const expanded = disclosureState.get(disclosureKey) || new Set();
      if (details.open) expanded.add(details.dataset.messageEvent);
      else expanded.delete(details.dataset.messageEvent);
      disclosureState.set(disclosureKey, expanded);
    }));

    container.querySelector("#messagesEnabled")?.addEventListener("change", (event) => mutate(() => { messages.enabled = event.target.checked; }));
    container.querySelectorAll("[data-message-customize]").forEach((button) => button.addEventListener("click", () => mutate(() => {
      ensureMessageOverride(getConfig(), area, button.dataset.messageCustomize);
    })));
    container.querySelectorAll("[data-message-reset]").forEach((button) => button.addEventListener("click", () => mutate(() => {
      delete area.messages[button.dataset.messageReset];
    })));

    const targetMessage = (eventId) => area
      ? ensureMessageOverride(getConfig(), area, eventId)
      : messages[eventId];
    container.querySelectorAll("[data-message-enabled]").forEach((input) => input.addEventListener("change", () => mutate(() => {
      targetMessage(input.dataset.messageEnabled).enabled = input.checked;
    })));
    container.querySelectorAll("[data-message-cooldown]").forEach((input) => input.addEventListener("change", () => mutate(() => {
      targetMessage(input.dataset.messageCooldown).cooldownSeconds = Math.max(0, Math.min(300, Number(input.value)));
    })));
    container.querySelectorAll("[data-chat-enabled]").forEach((input) => input.addEventListener("change", () => mutate(() => {
      targetMessage(input.dataset.chatEnabled).chat.enabled = input.checked;
    })));
    container.querySelectorAll("[data-chat-text]").forEach((input) => input.addEventListener("change", () => mutate(() => {
      targetMessage(input.dataset.chatText).chat.text = input.value;
    })));
    container.querySelectorAll("[data-alert-enabled]").forEach((input) => input.addEventListener("change", () => mutate(() => {
      targetMessage(input.dataset.alertEnabled).alerts[input.dataset.presentation].enabled = input.checked;
    })));
    container.querySelectorAll("[data-alert-text]").forEach((input) => input.addEventListener("change", () => mutate(() => {
      targetMessage(input.dataset.alertText).alerts[input.dataset.presentation].text = input.value;
    })));
    container.querySelectorAll("[data-alert-tone]").forEach((input) => input.addEventListener("change", () => mutate(() => {
      targetMessage(input.dataset.alertTone).alerts[input.dataset.presentation].tone = input.value;
    })));
    container.querySelectorAll("[data-insert-placeholder]").forEach((button) => button.addEventListener("click", () => {
      const eventId = button.dataset.eventId;
      const selector = button.dataset.messageChannel === "chat"
        ? `[data-chat-text="${eventId}"]`
        : `[data-alert-text="${eventId}"][data-presentation="${button.dataset.presentation}"]`;
      const textarea = container.querySelector(selector);
      if (!textarea) return;
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? start;
      textarea.setRangeText(button.dataset.insertPlaceholder, start, end, "end");
      textarea.focus();
    }));
  }

  return { bind, render, renameAreaKey, reset };
}
