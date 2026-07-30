import { For, Index, Show, createMemo } from "solid-js";
import type { AreaValue, ModeValue, RegionValue, ScheduleValue } from "../domain/types";
import { WEEKDAYS, localWeekdayAndTimeToUtc, nextOccurrence, utcWeekdayAndTimeToLocal } from "../domain/schedules";
import { ControlRow } from "./ControlRow";
import { ModeBadge } from "./ModeBadge";

interface ScheduleArea {
  readonly kind: "wilderness" | "stageAreas" | "region";
  readonly index: number;
  readonly area: AreaValue | RegionValue;
}

export function ScheduleInspector(props: {
  readonly schedule: ScheduleValue;
  readonly modes: readonly ModeValue[];
  readonly wilderness: AreaValue;
  readonly stageAreas: AreaValue;
  readonly regions: readonly RegionValue[];
  readonly onUpdate: (apply: (schedule: ScheduleValue) => void) => void;
  readonly onAssign: (kind: ScheduleArea["kind"], index: number, assigned: boolean) => void;
}) {
  let modeSelect: HTMLDetailsElement | undefined;
  const reference = new Date();
  const localStart = createMemo(() => {
    const day = props.schedule.days[0] ?? "mon";
    return utcWeekdayAndTimeToLocal(day, props.schedule.startTime, reference)?.time ?? props.schedule.startTime;
  });
  const localDays = createMemo(() => new Set(props.schedule.days.map((day) => utcWeekdayAndTimeToLocal(day, props.schedule.startTime, reference)?.day ?? day)));
  const localEnd = createMemo(() => props.schedule.endTime
    ? utcWeekdayAndTimeToLocal(props.schedule.days[0] ?? "mon", props.schedule.endTime, reference)?.time ?? props.schedule.endTime
    : "");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "computer time";
  const occurrence = createMemo(() => nextOccurrence(props.schedule));
  const areas = createMemo<ScheduleArea[]>(() => [
    { kind: "wilderness", index: 0, area: props.wilderness },
    { kind: "stageAreas", index: 0, area: props.stageAreas },
    ...props.regions.map((area, index) => ({ kind: "region" as const, index, area }))
  ]);
  const updateLocalSchedule = (days: readonly string[], time: string) => {
    const converted = days.map((day) => localWeekdayAndTimeToUtc(day, time, reference)).filter((value): value is { day: string; time: string } => !!value);
    props.onUpdate((schedule) => {
      schedule.days = [...new Set(converted.map((value) => value.day))];
      if (converted[0]) schedule.startTime = converted[0].time;
    });
  };
  const updateLocalEnd = (time: string) => {
    if (!time) {
      props.onUpdate((schedule) => { schedule.endTime = null; });
      return;
    }
    const converted = localWeekdayAndTimeToUtc([...localDays()][0] ?? "mon", time, reference);
    if (converted) props.onUpdate((schedule) => { schedule.endTime = converted.time; });
  };

  return <div class="schedule-inspector">
    <div class="panel-heading"><div><h2>{props.schedule.name}</h2><p>Times use {timezone} and your computer's current UTC offset; PalLaw.json stores the equivalent recurring UTC time.</p></div></div>
    <div class="schedule-form-stack">
      <section class="section-card"><div class="section-card-header"><div><h3>Schedule</h3><p>Choose when this repeats and whether it changes an Area mode.</p></div></div><div class="section-card-body schedule-fields">
        <ControlRow kind="boolean" variant="standalone" label="Enabled" description="Keep this schedule in the file without running it." checked={props.schedule.enabled} onChange={(value) => { props.onUpdate((schedule) => { schedule.enabled = value; }); }} />
        <div class="schedule-id-mode-grid"><label class="field"><span>ID</span><input aria-label="ID" maxlength="64" value={props.schedule.id} onChange={(event) => { props.onUpdate((schedule) => { schedule.id = event.currentTarget.value.trim(); }); }} /></label><div class="field schedule-mode-field"><span>Assign mode</span><details ref={modeSelect} class="mode-select schedule-mode-select"><summary aria-label={props.schedule.mode ? `Assigned mode: ${props.modes.find((mode) => mode.id === props.schedule.mode)?.name ?? props.schedule.mode}. Change mode` : "Announcements only. Assign mode"}><Show when={props.schedule.mode} fallback={<span class="badge announcement-only-badge">Announcements only</span>}>{(modeId) => <ModeBadge modeId={modeId()} modes={props.modes} />}</Show></summary><div class="mode-select-options schedule-mode-options" role="radiogroup" aria-label="Assign mode"><button type="button" role="radio" aria-checked={!props.schedule.mode} onClick={() => { props.onUpdate((schedule) => { schedule.mode = null; }); if (modeSelect) { modeSelect.open = false; modeSelect.querySelector<HTMLElement>("summary")?.focus(); } }}><span class="badge announcement-only-badge">Announcements only</span></button><For each={props.modes}>{(mode) => <button type="button" role="radio" aria-checked={props.schedule.mode === mode.id} onClick={() => { props.onUpdate((schedule) => { schedule.mode = mode.id; schedule.endTime ??= "13:00"; }); if (modeSelect) { modeSelect.open = false; modeSelect.querySelector<HTMLElement>("summary")?.focus(); } }}><ModeBadge modeId={mode.id} modes={props.modes} /></button>}</For></div></details></div></div>
        <label class="field"><span>Name</span><input maxlength="96" value={props.schedule.name} onChange={(event) => { props.onUpdate((schedule) => { schedule.name = event.currentTarget.value.trim(); }); }} /></label>
        <div class="field schedule-repeat-field"><span id="schedule-repeat-label">Repeats on</span><div class="weekday-picker" role="group" aria-labelledby="schedule-repeat-label"><For each={WEEKDAYS}>{(day) => <button type="button" classList={{ active: localDays().has(day.id) }} aria-pressed={localDays().has(day.id)} onClick={() => { const days = new Set(localDays()); if (days.has(day.id)) days.delete(day.id); else days.add(day.id); updateLocalSchedule([...days], localStart()); }}>{day.label}</button>}</For></div></div>
        <div class="schedule-time-grid"><label class="field"><span>Starts ({timezone})</span><input type="time" value={localStart()} onChange={(event) => { updateLocalSchedule([...localDays()], event.currentTarget.value); }} /><small>Stored as {props.schedule.startTime} UTC.</small></label><label class="field"><span>Ends ({timezone}, optional)</span><input type="time" value={localEnd()} onChange={(event) => { updateLocalEnd(event.currentTarget.value); }} /><small>{props.schedule.endTime ? props.schedule.endTime === props.schedule.startTime ? `Stored as ${props.schedule.endTime} UTC. Same time means 24 hours.` : `Stored as ${props.schedule.endTime} UTC. Earlier means next day.` : props.schedule.mode ? "An end time is required for a mode window." : "Add an end time to announce before or at the end."}</small></label></div>
        <Show when={occurrence()} fallback={<p class="schedule-preview">No next occurrence. Select at least one weekday.</p>}>{(next) => <p class="schedule-preview"><strong>Next:</strong> {next().startsAt.toLocaleString()}<Show when={next().endsAt}> → {next().endsAt!.toLocaleString()}</Show></p>}</Show>
      </div></section>

      <Show when={props.schedule.mode}><section class="section-card"><div class="section-card-header"><div><h3>Assigned Areas</h3><p>During this window, the selected mode fully replaces local rules in each Area.</p></div></div><div class="section-card-body area-assignment-flow"><Index each={areas()}>{(entry) => { const selected = () => entry().area.schedules.includes(props.schedule.id); return <button type="button" class="assignment-button" aria-pressed={selected()} onClick={() => { props.onAssign(entry().kind, entry().index, !selected()); }}><span><strong>{entry().area.name}</strong><small>{entry().kind === "region" ? "Region" : entry().kind === "stageAreas" ? "Stage Areas" : "Wilderness"}</small></span></button>; }}</Index></div></section></Show>

      <section class="section-card"><div class="section-card-header schedule-announcement-heading"><div><h3>Broadcast notices</h3><p>Rows run independently and may be duplicated. Messages are skipped when global messages are disabled.</p></div><button type="button" class="button small primary" onClick={() => { props.onUpdate((schedule) => { schedule.announcements.push({ enabled: true, relativeTo: "start", minutesBefore: 0, globalChat: { enabled: true, text: "{schedule} is starting now." }, serverNotice: { enabled: false, text: "" } }); }); }}>Add notice</button></div><div class="section-card-body announcement-stack">
        <Index each={props.schedule.announcements}>{(announcement, index) => <article class="announcement-row"><div class="announcement-row-header"><strong>Notice {index + 1}</strong><div class="sidebar-card-actions"><button type="button" class="button small ghost" onClick={() => { props.onUpdate((schedule) => { schedule.announcements.splice(index + 1, 0, structuredClone(schedule.announcements[index]!)); }); }}>Duplicate</button><button type="button" class="button small ghost danger-button" onClick={() => { props.onUpdate((schedule) => { schedule.announcements.splice(index, 1); }); }}>Remove</button></div></div>
          <ControlRow kind="boolean" variant="standalone" label="Enabled" description="Disabled rows remain editable." checked={announcement().enabled} onChange={(value) => { props.onUpdate((schedule) => { schedule.announcements[index]!.enabled = value; }); }} />
          <div class="announcement-timing-grid"><label class="field"><span>Relative to</span><select value={announcement().relativeTo} onChange={(event) => { props.onUpdate((schedule) => { schedule.announcements[index]!.relativeTo = event.currentTarget.value as "start" | "end"; }); }}><option value="start">Start</option><option value="end" disabled={!props.schedule.endTime}>End</option></select></label><label class="field"><span>Minutes before</span><input type="number" min="0" max="60" step="1" value={announcement().minutesBefore} onChange={(event) => { props.onUpdate((schedule) => { schedule.announcements[index]!.minutesBefore = Math.max(0, Math.min(60, Math.trunc(event.currentTarget.valueAsNumber || 0))); }); }} /></label></div>
          <div class="announcement-channel-fields"><div class="field announcement-channel-field"><ControlRow kind="boolean" variant="standalone" label="Global chat" description="Broadcast by PalLaw to server chat." checked={announcement().globalChat.enabled} onChange={(value) => { props.onUpdate((schedule) => { schedule.announcements[index]!.globalChat.enabled = value; }); }} /><textarea aria-label="Global chat message" maxlength="512" rows="3" disabled={!announcement().globalChat.enabled} value={announcement().globalChat.text} onInput={(event) => { props.onUpdate((schedule) => { schedule.announcements[index]!.globalChat.text = event.currentTarget.value; }); }} /></div><div class="field announcement-channel-field"><ControlRow kind="boolean" variant="standalone" label="Server notice" description="Use Palworld's native server red alert." checked={announcement().serverNotice.enabled} onChange={(value) => { props.onUpdate((schedule) => { schedule.announcements[index]!.serverNotice.enabled = value; }); }} /><textarea aria-label="Server notice message" maxlength="256" rows="3" disabled={!announcement().serverNotice.enabled} value={announcement().serverNotice.text} onInput={(event) => { props.onUpdate((schedule) => { schedule.announcements[index]!.serverNotice.text = event.currentTarget.value; }); }} /></div></div>
          <p class="help">Placeholders: <code>{"{schedule}"}</code>, <code>{"{startTime}"}</code>, <code>{"{endTime}"}</code>, <code>{"{minutes}"}</code>, <code>{"{mode}"}</code>, <code>{"{areas}"}</code>.</p>
        </article>}</Index>
        <Show when={props.schedule.announcements.length === 0}><div class="empty-state"><div><strong>No notices</strong><span>This schedule can still change modes without broadcasting.</span></div></div></Show>
      </div></section>
    </div>
  </div>;
}
