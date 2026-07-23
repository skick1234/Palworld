# PalLaw configuration

PalLaw reads one runtime file:

```text
Pal/Binaries/Win64/Mods/PalLaw/PalLaw.json
```

The file is plain JSON. JSON is used because the DLL and the browser editor can share the same data model, the bundled JSON Schema can validate it, and no additional parser dependency is required in the production mod.

Configuration Version 1 accepts UTF-8 with or without a UTF-8 BOM. The raw file is limited to 4 MiB inclusive, the BOM counts toward that limit, JSON container nesting is limited to 32, and duplicate object keys are rejected at every depth before object construction. UTF-16, UTF-32, and invalid UTF-8 are rejected.

Most servers only need a wilderness mode and a list of named regions. Advanced action, combat, and message overrides are optional.

## Minimal file

```json
{
  "$schema": "./PalLaw.schema.json",
  "version": 1,
  "wilderness": {
    "name": "Wilderness",
    "mode": "pve"
  },
  "regions": [
    {
      "name": "Arena Island",
      "mode": "pvp",
      "polygon": [
        [-240000, 90000],
        [-210000, 125000],
        [-160000, 100000],
        [-180000, 55000]
      ]
    }
  ]
}
```

## Top-level fields

- `$schema`: optional relative path used by editors.
- `version`: required and currently `1`.
- `settings`: optional runtime tuning.
- `messages`: optional global player-message defaults.
- `wilderness`: required named Wilderness.
- `regions`: optional ordered array of polygon areas.

Unknown fields are rejected. A failed hot reload leaves the previous valid configuration active.

## Areas and overlap order

An **area** is either wilderness or a region.

Wilderness applies to every point that is not inside an enabled region. A document may contain at most 1,024 raw regions. Every region requires a unique, non-empty `name` and a polygon with 3 to 1,024 raw `[X, Y]` points; all raw polygons together may contain at most 65,536 points. A final point equal to the first may explicitly close a polygon, counts toward both limits, and is removed during normalization. Other consecutive duplicate points are rejected.

Regions are evaluated in array order. When enabled regions overlap, the **last matching region wins**. There is no hidden numeric priority:

```json
"regions": [
  { "name": "Large PvP Island", "mode": "pvp", "polygon": [] },
  { "name": "Safe Market", "mode": "safe", "polygon": [] }
]
```

Inside the overlapping market polygon, `Safe Market` wins because it appears later.

Each region supports:

```json
{
  "name": "Arena Island",
  "enabled": true,
  "mode": "pvp",
  "minimumLevel": 20,
  "map": "world",
  "color": "#F43F5E",
  "polygon": [[0, 0], [100, 0], [100, 100]],
  "actions": {},
  "combat": [],
  "messages": {}
}
```

`map` and `color` are editor metadata. Runtime area selection is based on the polygon coordinates and file order. The obsolete Region `notes` field is not part of the pre-release Version 1 contract and is rejected as an unknown property.

## Mode presets

Every area selects one mode:

### `safe`

Combat involving a player, partner Pal, or base Pal is denied in both directions. Environmental actors may still fight each other. Damage to Player-Built Structures and Environmental Map Objects keeps vanilla `1.0` behavior unless an explicit override changes it. Use this for markets, hubs, spawn areas, and protected events.

### `pve`

Combat between player groups is denied. Environmental combat remains active, so players can fight wild Pals and NPCs, and wild enemies can fight players. A projectile or area attack is evaluated independently for every target, so collateral hits against protected players or owned Pals are ignored.

### `pvp`

All recognized combat relationships are enabled unless an explicit combat override changes one.

A combat event must be allowed by the area at the source endpoint **and** the area at the target endpoint. The lower positive damage multiplier is used. This prevents attacks from crossing a protected boundary merely because the attacker stands in a PvP region.

## Action overrides

Mode presets allow world actions by default. An area may override individual actions:

```json
"actions": {
  "build": false,
  "dismantle": false,
  "ride": true,
  "fly": false,
  "editSign": false,
  "editLock": false,
  "fastTravelDeparture": true,
  "fastTravelArrival": false,
  "decay": false
}
```

Supported actions:

- `build`
- `dismantle`
- `ride`: remain on a non-flying mount
- `fly`: remain on a flying mount after the configured grace period
- `editSign`
- `editLock`
- `fastTravelDeparture`: start fast travel while physically inside the area
- `fastTravelArrival`: land in the area by fast travel, including base-camp destinations
- `decay`

An action set to **Default** in Rules Studio is omitted from `actions` and uses the selected mode default, which currently allows every action. Administrators bypass action and level rules when `settings.adminBypass` is true.

## Combat overrides

Combat overrides are ordered and applied after the mode. Later matching entries win. A relationship set to **Default** in Rules Studio has no dedicated quick override: its effective value comes from any remaining ordered override, or from the mode preset when none matches. Wilderness and each region may contain at most 128 raw combat entries.

```json
"combat": [
  {
    "source": ["player", "partnerPal"],
    "target": "wildPal",
    "damage": 0.5
  },
  {
    "source": "npc",
    "target": "player",
    "allow": false,
    "bidirectional": true
  }
]
```

Supported actor names:

- `player`
- `partnerPal`
- `basePal`
- `wildPal`
- `npc`
- `structure` as a target: a Player-Built Structure with valid Palworld builder attribution
- `environment` as a target: an Environmental Map Object, including a map object whose builder attribution is empty or unavailable

Map-object damage keeps vanilla `1.0` behavior in Safe, PvE, and PvP modes until an override changes the applicable source/target relationship. PalLaw deliberately applies the `environment` policy when builder attribution cannot be read; it does not maintain a separate ownership database.

`source` and `target` may be a string or an array. Each entry must contain exactly one decision:

- `"allow": true` enables targeting and normal `1.0` damage.
- `"allow": false` prevents targeting and damage.
- `"damage": 0.5` enables targeting at half damage.
- `"damage": 0` prevents targeting and damage.

`bidirectional: true` also applies the reverse relationship when the target can be a combat source.

## Level requirements

A region may require a minimum player level:

```json
"minimumLevel": 20
```

A lower-level non-admin player is moved back to the last safe transform outside the denied region. Fast travel checks the requested destination before Palworld begins the trip, so a known under-level destination is blocked without entering its loading flow. PalLaw checks the physical landing again; a late denial returns the player to the exact transform captured at departure. If the player's first observed position is already denied, PalLaw computes a nearby permitted point outside the region rather than accepting the denied position as a fallback. The `levelDenied` message uses the configured cooldown to avoid chat or alert spam.

## Messages

All player messages are configurable. The master object is:

```json
"messages": {
  "enabled": true,
  "actionNames": {},
  "modeNames": {},
  "regionChanged": {},
  "pvpWarning": {},
  "actionDenied": {},
  "levelDenied": {}
}
```

`actionNames` and `modeNames` customize the global Player Action Display Names and Area Mode Display Names inserted by notification placeholders. Each supplied value must be non-empty UTF-8 text of at most 96 characters. Omitted entries keep their English defaults, unknown keys are rejected, and area message overrides cannot redefine these names.

```json
"actionNames": {
  "build": "Xây dựng",
  "fly": "Bay"
},
"modeNames": {
  "safe": "An toàn",
  "pvp": "Đối kháng"
}
```

Supported `actionNames` keys are `build`, `dismantle`, `ride`, `fly`, `editSign`, `editLock`, `fastTravelDeparture`, `fastTravelArrival`, and `decay`. Supported `modeNames` keys are `safe`, `pve`, and `pvp`.

Events:

- `regionChanged`: sent when a player enters another named region or returns to wilderness.
- `pvpWarning`: sent in addition to `regionChanged` when the destination mode is PvP.
- `actionDenied`: sent when an action is blocked.
- `levelDenied`: sent when a player fails a region level requirement.

After a successful fast travel that changes areas, PalLaw sends the normal entry messages once at the physical landing. It then retries only enabled brief/activity tips every ten seconds for up to 120 seconds, independently of each event's ordinary cooldown. System chat is never repeated. The retry cadence stops on direct player movement input, an area change, disconnect, another fast travel, or configuration reload.

The first resolved location after a player joins or rules reload is treated as a region change and uses the same event and output switches.

Each event supports three independent outputs: system chat plus two player-specific Palworld left-side tip lanes. Every output has its own enable switch and text, so one event may send any combination of presentations:

```json
"pvpWarning": {
  "enabled": true,
  "cooldownSeconds": 0,
  "chat": {
    "enabled": false,
    "text": "Warning: PvP is enabled in {region}."
  },
  "alerts": {
    "brief": {
      "enabled": true,
      "text": "PvP is active in {region}.",
      "tone": "negative"
    }
  }
}
```

Supported alert keys:

- `brief`: short queued left-side tip using Palworld's important lane;
- `activity`: immediate, stacking left-side tip using Palworld's normal lane.

`brief` also accepts `tone`: `normal` (blue) or `negative` (red). `activity` has no tone option and always uses Palworld's normal light style. Palworld does not provide a distinct positive rendering for either supported lane, so `positive` is rejected instead of silently falling back to normal. PvP warnings and denied actions default to negative brief tips.

`pvpWarning`, `actionDenied`, and `levelDenied` default to `brief`; `regionChanged` defaults to `activity`. Palworld's very-important priority lane is intentionally unsupported because its tip can remain visible indefinitely. Palworld controls each supported native lane's lifetime and queue behavior; arbitrary per-message duration and targeted full-screen text are not supported.

Short forms are accepted:

```json
"chat": false
```

```json
"chat": "Entered {region}."
```

```json
"pvpWarning": false
```

A wilderness or region `messages` object overrides only specified global events. Events shown as **Default** in Rules Studio use the current global event; delete a local override to return to that default.

### Placeholders

- `{region}`: destination area name.
- `{previousRegion}`: previous area name when available.
- `{mode}`: the configured Area Mode Display Name for `safe`, `pve`, or `pvp`.
- `{action}`: the configured Player Action Display Name for the denied action.
- `{minimumLevel}`: configured minimum level.
- `{playerLevel}`: current player level when available.

Unknown placeholders remain literal. Keep chat messages to 512 characters or less and Palworld alerts to 256 characters or less.

### Configuration version

PalLaw Configuration Version 1 was released with PalLaw software `0.1.0`. Its `PalLaw.json` contract is frozen: any later change to configuration structure, defaults, constraints, or meaning uses the next integer version. Schema descriptions, ordering, and corrections that only align validation with the released runtime may remain within the same Configuration Version.

Rules Studio and the DLL migrate every released older Configuration Version forward through each adjacent version. The declared source and every intermediate result must validate before the migrated document can be used. A document without `version` is reported and treated as version 1 only when it passes the complete version-1 contract. Invalid, unknown, and newer versions are rejected; reverse migration is not supported.

Rules Studio immediately replaces imported older JSON in its editor model with the current-version result and displays every migration fallback by JSON path. The DLL applies the same migration on startup and hot reload. Before replacing `PalLaw.json`, it preserves the exact source in a uniquely named immutable backup and atomically writes the fully validated current document. A failed or capability-rejected hot reload leaves both the source file and previous active rules unchanged. An already-current valid file is never rewritten merely by loading it.

## Runtime settings

Defaults are suitable for most dedicated servers:

```json
"settings": {
  "hotReload": true,
  "hotReloadSeconds": 1.0,
  "targetFiltering": true,
  "targetSweepSeconds": 0.5,
  "worldRules": true,
  "adminBypass": true,
  "playerSweepSeconds": 0.25,
  "mountGraceSeconds": 15.0,
  "debugLogging": false
}
```

- `hotReload`: watch the configuration file.
- `hotReloadSeconds`: timestamp-check interval, 0.1-60 seconds.
- `targetFiltering`: block and remove denied AI targets.
- `targetSweepSeconds`: stale-target cleanup interval, 0.05-10 seconds.
- `worldRules`: enforce actions, mounts, level requirements, and decay rules.
- `adminBypass`: allow admins to bypass world action and level restrictions.
- `playerSweepSeconds`: player location and area transition interval, 0.05-10 seconds.
- `mountGraceSeconds`: delay between the action-denied tip and forced dismount where ground riding or flying is denied, 0-120 seconds.
- `debugLogging`: verbose area-rule diagnostics plus one aggregated performance profile every 60 seconds. Fast-travel diagnostics include request/completion correlation, physical-arrival acceptance, reminder movement-state transitions and stop reasons, and per-channel alert delivery results; unchanged stationary sweeps remain silent. The profile reports player work and bounded AI-target/deterioration queue time and object counts; ProcessEvent relevant-call ratios; combat evaluations; actor-classification cache effectiveness; removed AI targets; fast-travel lifecycle/delivery counters; and suppressed detail lines. Detailed blocked-decision logging is capped at 100 lines per profile window so diagnostics cannot create an unbounded log or I/O load.

## Editing workflow

The static Rules Studio under `site/pallaw/` imports and exports this exact format. Its editor pins the Wilderness first in the Regions list, keeps polygon Regions in their runtime overlap order, and provides global Player Action and Area Mode Display Names through the Messages Localization card. It runs entirely in the browser and includes its own scripts plus bundled Palworld world and World Tree maps. The editor makes no network requests with configuration data. The surrounding page separately loads the Ko-fi support widget from Ko-fi's CDN.

Each map's hover readout shows the coordinates displayed by Palworld in-game. Region polygons remain stored as Unreal world `[X, Y]` coordinates because those are the authoritative actor positions used by the server. Rules Studio applies each map's axis swap, scale, and offsets when positioning polygons on the bundled maps.

For manual editing, you may place `PalLaw.schema.json` beside `PalLaw.json` and use an editor with JSON Schema support. That file is the latest-schema alias; immutable historical contract locations live under `site/pallaw/schemas/`, beginning with `PalLaw.v1.schema.json`. Schemas are not read by the DLL, so they are intentionally omitted from the runtime package. Save atomically when possible. If a save is invalid, PalLaw logs the error and continues using the previous valid rules.
