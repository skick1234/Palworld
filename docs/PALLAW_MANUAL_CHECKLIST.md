# PalLaw Rules Studio release checklist

The automated domain, document, Solid component, map-adapter, contract, and static-site suites cover configuration semantics and intent dispatch. Before publishing a frontend change, the maintainer owns the following real-browser checks that depend on native dialogs, downloads, responsive layout, shared scripts, or interactive Leaflet rendering.

## Document lifecycle

- Restore an existing local draft, including a Version 1 or Version 2 draft, and confirm the migrated Raw JSON is Version 3.
- Create a new configuration, cancel once, then confirm; verify the new document is dirty and Undo/Redo remains coherent after the next edit.
- Import valid current and migrated files, reject an invalid file without changing the document, export `PalLaw.json`, and confirm the unload warning clears only after export.
- Exercise Undo/Redo after a form edit, a map move, a vertex edit, a drawn region, a mode deletion/replacement, an import, and a new-document replacement.

## Regions, modes, messages, and JSON

- Filter, select, reorder, duplicate, edit, and delete Regions; verify overlap order, map choice, minimum level, actions, combat, and message overrides.
- Edit Wilderness and verify it remains outside polygon priority.
- Filter, select, reorder, duplicate, and delete Modes; for an in-use mode, choose each available replacement and verify reference reassignment is one undo step.
- Verify global, Mode, Region, and Wilderness messages: override/default labels, placeholders, multiline chat/alerts, brief tones, activity alerts, cooldowns, localization, and previews.
- Apply valid Raw JSON, reject invalid JSON and invalid polygon text accessibly, format/copy/discard, and verify serialization remains deterministic.

## Map and responsive behavior

- Switch World and World Tree maps; verify tiles, coordinates, selected polygon color, disabled styling, and Fit behavior.
- Draw/cancel/finish a polygon, drag a selected polygon, edit/delete vertices, press Escape while drawing, and verify each completed operation creates one undo step.
- At desktop, intermediate, and narrow mobile widths, verify list/map/edit navigation, stable input focus/cursor, dialog sizing, and no hidden or overlapping required controls.
- Open and close the Region and every confirmation dialog by mouse and keyboard; verify focus returns to the invoking control.

## Shared/static behavior

- Toggle every theme and reload; confirm the choice persists and all previews remain legible.
- Open Donate, confirm Ko-fi is not loaded before interaction, close/reopen the dialog, and confirm editor controls are unobscured when closed.
- Open Discord and Legal links and confirm the Pocketpair non-affiliation notice remains visible at supported desktop widths.
- Confirm the deployed Pages artifact contains only `site/`, has no source maps, and works at the repository subpath with browser networking showing no configuration, telemetry, or upload requests.
