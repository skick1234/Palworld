# PalLaw configuration

PalLaw reads one runtime file:

```text
Pal/Binaries/Win64/Mods/PalLaw/PalLaw.json
```

The file is plain JSON. JSON is used because the DLL and the browser editor can share the same data model, the bundled JSON Schema can validate it, and no additional parser dependency is required in the production mod.

Configuration Version 3 accepts UTF-8 with or without a UTF-8 BOM. The raw file is limited to 4 MiB inclusive, the BOM counts toward that limit, JSON container nesting is limited to 32, and duplicate object keys are rejected at every depth before object construction. UTF-16, UTF-32, and invalid UTF-8 are rejected.

Every current document carries its ordered mode definitions. Rules Studio creates
the Safe, PvE, and PvP starter modes for a new document; they are ordinary
configuration-owned modes and may then be reordered, renamed, duplicated, or
deleted.

## Minimal file

See [`examples/minimal/PalLaw.json`](examples/minimal/PalLaw.json) for a complete
one-mode document. Mode action and combat defaults are intentionally dense, so
the example is longer than an area-only fragment.

This is the level/action-only profile. Global callbacks remain installed for
minimum-level, fast-travel, mount, build, and other world rules, but damage
callbacks return before PalLaw final-damage, emergency-gate, or runtime-health
processing. Set `regionalCombat.enabled` to `true` to make PalLaw manage
regional final damage and regional PvP. Targeting and attack progression remain
vanilla in PalLaw 0.2.0. When a configured PvP
area needs player damage, PalLaw transactionally enables the required Palworld
setting and restores its original value when combat authority is disabled,
released, or unloaded.

## Top-level fields

- `$schema`: optional relative path used by editors.
- `version`: required and currently `3`.
- `regionalCombat`: optional master combat-authority control. It defaults to enabled.
- `settings`: optional runtime tuning.
- `messages`: optional global player-message defaults.
- `modes`: required ordered array containing 1 to 128 complete mode definitions.
- `wilderness`: required named Wilderness.
- `stageAreas`: required shared policy for every Palworld stage area.
- `regions`: optional ordered array of polygon areas.

Unknown fields are rejected. A failed hot reload leaves the previous valid configuration active.

## Areas and overlap order

An **area** is Wilderness, the shared Stage Areas policy, or a polygon Region.

Stage Areas applies with fixed, exclusive priority whenever Palworld identifies
an actor as inside a Dungeon, Boss Battle, Arena, Room, or Raid Boss stage. In
that case polygon Regions and Wilderness are not evaluated, even when the
stage's hidden world coordinates overlap a Region. Configuration Version 3 has
one shared Stage Areas policy; it does not configure stage types or instances
separately.

Wilderness applies to every non-stage point that is not inside an enabled region. A document may contain at most 1,024 raw regions. Every region requires a unique, non-empty `name` and a polygon with 3 to 1,024 raw `[X, Y]` points; all raw polygons together may contain at most 65,536 points. A final point equal to the first may explicitly close a polygon, counts toward both limits, and is removed during normalization. Other consecutive duplicate points are rejected.

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
  "name": "Protected Settlement",
  "enabled": true,
  "mode": "pvp",
  "minimumLevel": 20,
  "map": "world",
  "polygon": [[0, 0], [100, 0], [100, 100]],
  "actions": {},
  "combat": [],
  "messages": {}
}
```

`map` is editor metadata. A region has no color field: its effective mode is the
sole color authority for badges and polygons. Runtime area selection is based
on polygon coordinates and file order.

## Modes

`modes` is ordered by display position. Each entry requires:

- an immutable unique lowercase-slug `id`;
- a case-insensitively unique `name` of at most 96 characters;
- a `#RRGGBB` color;
- a `minimumLevel` default containing `null` or an integer from 1 to 999;
- every Player Action value, including Fast Travel Departure and Arrival policies;
- every source and target cell in the dense binary combat matrix;
- optional sparse message overrides.

Rules Studio owns the new-document starter definitions named Safe, PvE, and
PvP. The current-version parser has no fallback definitions and attaches no
reserved meaning to those IDs. A server may replace them with its own modes.
Every Wilderness, Stage Areas, and Region `mode` must reference an existing ID.

A combat event uses only the target's current physical area. The source actor's
kind selects the combat row, but source position, projectile launch position,
and effect creation position do not participate. Protected areas therefore
protect targets standing inside them without restricting attacks against
targets outside them.

## Action overrides

Mode definitions contain complete action defaults. An area may sparsely override
individual actions:

```json
"actions": {
  "build": false,
  "dismantle": false,
  "ride": true,
  "fly": false,
  "editSign": false,
  "editLock": false,
  "fastTravelDeparture": "all",
  "fastTravelArrival": "baseOnly",
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
- `fastTravelDeparture`: control trips started while physically inside the area with `"all"`, `"baseOnly"`, or `"none"`
- `fastTravelArrival`: control landing destinations with `"all"`, `"baseOnly"`, or `"none"`
- `decay`

For either direction, `"baseOnly"` admits only trips whose destination is
positively identified by Palworld as a base camp; it never guesses from
coordinate proximity. `"none"` disables that direction.

An area action set to **Default** is omitted and inherits its selected mode.
Editing or switching a mode never removes an area override.

## Combat overrides

Combat overrides are ordered and applied after the mode. Later matching entries win. Rules Studio presents the resulting relationships as an editable matrix. When a matrix cell is changed, grouped and bidirectional entries are normalized into deterministic one-source, one-target entries while preserving every effective relationship. A cell set to **Default** removes its explicit entry and restores the selected mode preset for that relationship. Wilderness, Stage Areas, and each Region may contain at most 128 raw combat entries; the matrix editor needs at most 48.

```json
"combat": [
  {
    "source": ["player", "partnerPal"],
    "target": "wildPal",
    "allow": true
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

Map-object behavior comes from the effective configured matrix. PalLaw applies
the `environment` target when builder attribution cannot be read; it does not
maintain a separate ownership database.

`source` and `target` may be a string or an array. Each entry contains one binary `allow` decision:

- `"allow": true` enables targeting and preserves normal Palworld damage.
- `"allow": false` prevents targeting and damage.

The Version 2 contract rejects `damage` multipliers. When a Version 1 file is migrated, `damage <= 0` becomes `allow: false` and `damage > 0` becomes `allow: true`; the migration report records every converted entry and the immutable source backup preserves the original value.

`bidirectional: true` also applies the reverse relationship when the target can be a combat source.

## Level requirements

Every mode defines a nullable minimum player level. Wilderness and Stage Areas
inherit it. A Region inherits that setting when it omits `minimumLevel`, or
replaces it with an explicit value:

```json
"minimumLevel": null
```

```json
"minimumLevel": 20
```

A lower-level non-admin player is moved back to the last safe transform outside the denied area. Fast travel checks the requested destination before Palworld begins the trip, so a known under-level destination is blocked without entering its loading flow. PalLaw checks the physical landing again; a late denial returns the player to the exact transform captured at departure. If the player's first observed position is already denied, PalLaw computes a nearby permitted point rather than accepting the denied position as a fallback. The `levelDenied` message uses the configured cooldown to avoid chat or alert spam.

## Messages

All player messages are configurable. The master object is:

```json
"messages": {
  "enabled": true,
  "actionNames": {},
  "regionChanged": {},
  "actionDenied": {},
  "levelDenied": {}
}
```

`actionNames` customizes Player Action Display Names. A mode's player-facing
display name is its `name` field and is used by `{mode}`.

```json
"actionNames": {
  "build": "Xây dựng",
  "fly": "Bay"
}
```

Supported `actionNames` keys are `build`, `dismantle`, `ride`, `fly`, `editSign`, `editLock`, `fastTravelDeparture`, `fastTravelArrival`, and `decay`.

Events:

- `regionChanged`: sent when a player enters another named region or returns to wilderness.
- `actionDenied`: sent when an action is blocked.
- `levelDenied`: sent when a player fails a region level requirement.

After a successful fast travel that changes areas, PalLaw sends the normal entry messages once at the physical landing. It then retries only enabled brief/activity tips every ten seconds for up to 120 seconds, independently of each event's ordinary cooldown. System chat is never repeated. The retry cadence stops on direct player movement input, an area change, disconnect, another fast travel, or configuration reload.

The first resolved location after a player joins or rules reload is treated as a region change and uses the same event and output switches.

Each event supports three independent outputs: system chat plus two player-specific Palworld left-side tip lanes. Every output has its own enable switch and text, so one event may send any combination of presentations:

```json
"regionChanged": {
  "enabled": true,
  "cooldownSeconds": 0,
  "chat": {
    "enabled": false,
    "text": "Player combat is enabled in {region}."
  },
  "alerts": {
    "brief": {
      "enabled": true,
      "text": "Entered {region}.",
      "tone": "negative"
    }
  }
}
```

Supported alert keys:

- `brief`: short queued left-side tip using Palworld's important lane;
- `activity`: immediate, stacking left-side tip using Palworld's normal lane.

`brief` also accepts `tone`: `normal` (blue) or `negative` (red). `activity` has no tone option and always uses Palworld's normal light style.

`actionDenied` and `levelDenied` default to `brief`; `regionChanged` defaults to
`activity`. Modes and areas may sparsely override those same events.

Short forms are accepted:

```json
"chat": false
```

```json
"chat": "Entered {region}."
```

```json
"regionChanged": false
```

A wilderness or region `messages` object overrides only specified global events. Events shown as **Default** in Rules Studio use the current global event; delete a local override to return to that default.

### Placeholders

- `{region}`: destination area name.
- `{previousRegion}`: previous area name when available.
- `{mode}`: the effective mode's configured `name`.
- `{action}`: the configured Player Action Display Name for the denied action.
- `{minimumLevel}`: configured minimum level.
- `{playerLevel}`: current player level when available.

Unknown placeholders remain literal. Keep chat messages to 512 characters or less and Palworld alerts to 256 characters or less.

### Configuration version

PalLaw Configuration Version 1 was released with PalLaw software `0.1.0` and
remains frozen. Software `0.2.0` uses Configuration Version 2, which adds one
explicit regional-combat authority switch and binary combat overrides. Version 2
publicly removes positive scaling, diagnostic damage modes, and separate target
filtering controls. Configuration Version 3 replaces both Fast Travel booleans
with `"all"`, `"baseOnly"`, and `"none"` policies, makes modes
configuration-owned, and adds one shared Stage Areas policy with fixed priority
over Regions and Wilderness. The Version 2→3 migration materializes the
complete starter modes, moves old display names into `mode.name`, removes
reported Region colors, merges old PvP-warning outputs into `regionChanged`,
and copies Wilderness into a uniquely named Stage Areas fallback.
Pre-release Version 3 drafts are not accepted.

Rules Studio and the DLL migrate every released older Configuration Version forward through each adjacent version. The declared source and every intermediate result must validate before the migrated document can be used. A document without `version` is reported and treated as version 1 only when it passes the complete version-1 contract. Invalid, unknown, and newer versions are rejected; reverse migration is not supported.

Rules Studio immediately replaces imported older JSON in its editor model with the current-version result and displays every migration fallback by JSON path. The DLL applies the same migration on startup and hot reload. Before replacing `PalLaw.json`, it preserves the exact source in a uniquely named immutable backup and atomically writes the fully validated current document. A failed or capability-rejected hot reload leaves both the source file and previous active rules unchanged. An already-current valid file is never rewritten merely by loading it.

## Runtime settings

Defaults are suitable for most dedicated servers:

```json
  "settings": {
  "hotReload": true,
  "hotReloadSeconds": 1.0,
  "worldRules": true,
  "adminBypass": true,
  "playerSweepSeconds": 0.25,
  "mountGraceSeconds": 15.0,
  "debugLogging": false
}
```

- `hotReload`: watch the configuration file.
- `hotReloadSeconds`: timestamp-check interval, 0.1-60 seconds.
- `worldRules`: enforce actions, mounts, level requirements, and decay rules.
  Keep this `true` for level-restriction-only servers.
- `adminBypass`: allow admins to bypass world action and level restrictions.
- `playerSweepSeconds`: player location and area transition interval, 0.05-10 seconds.
- `mountGraceSeconds`: delay between the action-denied tip and forced dismount where ground riding or flying is denied, 0-120 seconds.
- `debugLogging`: verbose area-rule and unresolved-combat diagnostics. Ordinary
  warning logs report the first unresolved event and aggregate repeats every
  60 seconds; debug logging records every unresolved event with route evidence.

## Editing workflow

The static Rules Studio under `site/pallaw/` imports and exports this exact
format. Its Modes tab owns ordered mode definitions, and its Regions tab pins
Wilderness followed by Stage Areas before polygon Regions. Message localization contains Player Action
names; mode names are edited on the mode itself. The editor makes no network
requests with configuration data.

Each map's hover readout shows the coordinates displayed by Palworld in-game. Region polygons remain stored as Unreal world `[X, Y]` coordinates because those are the authoritative actor positions used by the server. Rules Studio applies each map's axis swap, scale, and offsets when positioning polygons on the bundled maps.

For manual editing, you may place `PalLaw.schema.json` beside `PalLaw.json` and use an editor with JSON Schema support. That file is the latest-schema alias; immutable historical contract locations live under `site/pallaw/schemas/`, beginning with `PalLaw.v1.schema.json`. Schemas are not read by the DLL, so they are intentionally omitted from the runtime package. Save atomically when possible. If a save is invalid, PalLaw logs the error and continues using the previous valid rules.
