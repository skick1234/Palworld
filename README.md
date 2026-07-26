# Palworld Mods

I use this public repository for browser-based tools that support my Palworld mods. The static site is deployed through GitHub Pages and keeps imported configuration in the browser.

## Unofficial project and third-party assets

I created PalLaw Rules Studio as an unofficial project. It is not affiliated with, endorsed by, sponsored by, or approved by Pocketpair, Inc. Palworld and all related names, trademarks, map imagery, and game assets are the property of their respective owners. I do not claim ownership of those materials.

The Apache License 2.0 applies only to this project's original source code and documentation. It does not license or grant rights to Palworld trademarks, map imagery, or other third-party assets. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for provenance and license details.

Pocketpair's current fan-content terms are available in its [Guidelines for Derivative Works](https://www.pocketpair.jp/en/guidelines-derivativework-en/). Rights holders may report concerns through this repository's issue tracker.

## PalLaw Rules Studio development

PalLaw Rules Studio is a static SolidJS application built with TypeScript and Vite. Run all commands from this repository with Bun:

```powershell
bun install --frozen-lockfile
bun run typecheck
bun run test:pallaw
bun run build:pallaw
```

Source lives under `apps/pallaw/src/`:

- `domain/` parses, migrates, hydrates, validates, evaluates, and serializes the public configuration contract without DOM, storage, Solid, or Leaflet dependencies.
- `document/` owns immutable snapshots, bounded undo/redo history, dirty state, import/export, validation, and draft persistence. Accepted commands publish and persist at most once.
- `editor/` adapts document snapshots to Solid view state and reconciles selection after document changes.
- `map/` is the only module that accesses `window.L`. Its `MapController` interface accepts PalLaw coordinates and owns Leaflet listeners, layers, drawing, editing, moving, fitting, resize observation, and disposal.
- `ui/` contains the single Solid application root and feature components. Components emit intent-level actions rather than mutating document snapshots.

Vite writes deterministic `app.js` and `app.css` files to the ignored `site/pallaw/build/` directory. Never commit that directory. The production budgets are 130 kB for application JavaScript and 60 kB for application CSS, excluding vendored Leaflet and map imagery; `tests/public-web/verify-site.mjs` builds, reports gzip sizes, and enforces these limits.

GitHub Pages installs, type-checks, tests, and builds with Bun, then uploads only `site/`. The tracked `site/pallaw/index.html` retains `script-src 'self'` and `connect-src 'none'`; do not add inline executable scripts, runtime configuration requests, telemetry, or unapproved remote hosts. Theme and Donate behavior remain first-party shared modules, and the Ko-fi iframe is created only after user interaction.

If the final Solid cutover must be rolled back, revert the public migration commits to `706f7d0` and revert the corresponding parent-repository submodule pointer. Rebuild generated assets rather than editing or restoring files under `site/pallaw/build/`.

Automated checks do not replace native browser, responsive, download, shared-script, or interactive-map verification. Complete [`docs/PALLAW_MANUAL_CHECKLIST.md`](docs/PALLAW_MANUAL_CHECKLIST.md) before publishing a frontend change.
