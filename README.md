# Palworld Mods

I use this public repository for browser-based tools that support my Palworld mods. The static site is deployed through GitHub Pages and keeps imported configuration in the browser.

## Unofficial project and third-party assets

I created PalLaw Rules Studio as an unofficial project. It is not affiliated with, endorsed by, sponsored by, or approved by Pocketpair, Inc. Palworld and all related names, trademarks, map imagery, and game assets are the property of their respective owners. I do not claim ownership of those materials.

The Apache License 2.0 applies only to this project's original source code and documentation. It does not license or grant rights to Palworld trademarks, map imagery, or other third-party assets. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for provenance and license details.

Pocketpair's current fan-content terms are available in its [Guidelines for Derivative Works](https://www.pocketpair.jp/en/guidelines-derivativework-en/). Rights holders may report concerns through this repository's issue tracker.

## Static-site development

The landing page, Legal notices, and PalLaw Rules Studio are one multi-page SolidJS application built by a single TypeScript/Vite project. Run all static-site commands from this repository with Bun:

```powershell
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
```

Page source lives under `apps/landing/`, `apps/legal/`, and `apps/pallaw/`; shared Solid controls live under `apps/shared/`. PalLaw's deeper application source lives under `apps/pallaw/src/`:

- `domain/` parses, migrates, hydrates, validates, evaluates, and serializes the public configuration contract without DOM, storage, Solid, or Leaflet dependencies.
- `document/` owns immutable snapshots, bounded undo/redo history, dirty state, import/export, validation, and draft persistence. Accepted commands publish and persist at most once.
- `editor/` adapts document snapshots to Solid view state and reconciles selection after document changes.
- `map/` is the only module that accesses `window.L`. Its `MapController` interface accepts PalLaw coordinates and owns Leaflet listeners, layers, drawing, editing, moving, fitting, resize observation, and disposal.
- `ui/` contains the single Solid application root and feature components. Components emit intent-level actions rather than mutating document snapshots.

One Vite build writes deterministic page entries, shared chunks, and PalLaw CSS to the ignored `site/build/` directory. Never commit that directory. The production budgets are 160 kB for all generated JavaScript and 60 kB for PalLaw CSS, excluding vendored Leaflet and map imagery; `tests/public-web/verify-site.mjs` builds, reports gzip sizes, and enforces these limits.

GitHub Pages installs, type-checks, tests, and runs the single Vite build with pinned stable Bun 1.4.0, then uploads only `site/`. Keep `bun.lock` readable by that version; do not regenerate it with a newer canary lockfile format. Every tracked page retains `script-src 'self'` and `connect-src 'none'`; do not add inline executable scripts, runtime configuration requests, telemetry, or unapproved remote hosts. Theme and Donate behavior are shared Solid components, and the Ko-fi iframe is created only after user interaction.

The Pages workflow stamps every local CSS and JavaScript asset link with one `Date.now()` publish timestamp immediately before validation and build. Keep cache-busting under `tools/stamp-site-cache.mjs`; do not edit individual `?v=` values by hand.

If the Solid cutover must be rolled back, revert the public migration commits to `706f7d0` and revert the corresponding parent-repository submodule pointer. Rebuild generated assets rather than editing or restoring files under `site/build/`.

Automated checks do not replace native browser, responsive, download, shared-script, or interactive-map verification. Complete [`docs/PALLAW_MANUAL_CHECKLIST.md`](docs/PALLAW_MANUAL_CHECKLIST.md) before publishing a frontend change.
