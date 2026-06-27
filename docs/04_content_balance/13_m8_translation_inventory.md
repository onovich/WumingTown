# WM-0115 Translation Inventory

Status: working inventory for the WM-0115 content-worker task. This document
separates player-facing shell UI from dev/debug diagnostics and records the
current hardcoded string surface after the WM-0114 localization pass.

## Player UI

The covered player-facing shell chrome is localized through
`packages/ui-react/src/localization.ts` and validated by
`validateLocalizationCatalogs()`.

Observed result:

- `packages/ui-react/src/shell-hud.ts` uses localization keys for the top bar,
  alerts, inspector labels, onboarding panel and language settings surface.
- `packages/ui-react/src/shell-settings-panel.ts` uses localized labels and
  locale display names.
- `packages/ui-react/src/shell-onboarding-panel.ts` uses localized onboarding
  copy and copy-limit warnings.
- `packages/ui-react/src/shell-hud.test.ts` now covers the zh-CN default path
  and confirms the covered surfaces do not fall back to English shell chrome.

Inventory result:

- No remaining hardcoded English player-shell labels were found in the covered
  default player surfaces.

## Dev / Debug Diagnostics

These surfaces remain diagnostics-only and may stay English-only because they
are hidden from the default player launch or explicitly gated.

Current hardcoded runtime strings:

- `packages/ui-react/src/shell-storage-panel.ts`
  - `Web storage gate`
  - `Storage Gate`
  - `Storage`
  - `Quota`
  - `Slots`
  - `Last action`
  - `Windows interoperability`
  - `Save fixture`
  - `Load save`
  - `Export save`
  - `Delete save`
  - `Refresh`
  - `Import save file`
  - `unknown`
  - `active slot(s)`
  - `available`
  - `usage`
  - `quota`
- `packages/ui-react/src/shell-hud.ts`
  - `Developer diagnostics`
  - `Canvas`
  - `Zoom`
  - `Input`
  - `none`
- `apps/web/src/web-storage-gate.ts`
  - `Booting storage gate`
  - `M6 gate envelope only. This stores read-only shell evidence and does not promise public save compatibility beyond the product gate.`
  - `Checking OPFS availability, quota estimate and existing save slots.`
  - `Preparing browser storage evidence.`
  - `OPFS ready`
  - `OPFS unavailable`
  - `Refresh storage`
  - `Web storage evidence is current.`
  - `Delete save`
  - `Removed the Web storage gate slot from OPFS.`
  - `Save fixture`
  - `Export save`
  - `Import save`
  - `Load save`
  - `Save m6-gate-slot does not exist.`
  - `There is no saved gate slot to export yet.`
  - `The save envelope could not be decoded.`
  - `That file is not a valid M6 gate save envelope.`
  - `The current platform bridge does not expose storage status.`
- `apps/web/src/diagnostic-package-gate.ts`
  - `Diagnostics`
  - `Diagnostics idle`
  - `M6 storage gate diagnostic summary.`
  - `Local diagnostics`
  - `M6 product gate shell ready.`
  - `A renderer diagnostic event was captured.`
  - `Unknown promise rejection reason.`
  - `Windows host file diagnostics remain blocked until a reviewed narrow diagnostics bridge exists.`
  - `Renderer-local diagnostic package is available; broad filesystem or IPC access is not exposed.`
- `apps/web/src/shell-bootstrap.ts`
  - `Renderer debug state was unavailable during diagnostic export.`
  - `Diagnostic package exported`
  - `Diagnostic export failed`
  - `Booting shell`
- `apps/web/src/web-storage-gate.ts`
  - `Blocked: the current Windows shell still exposes placeholder unavailable save ports, so Windows/Web container interoperability is not yet proven for M6.`
  - `Booting storage gate`
  - `M6 gate envelope only. This stores read-only shell evidence and does not promise public save compatibility beyond the product gate.`
  - `Checking OPFS availability, quota estimate and existing save slots.`
  - `Checking OPFS`
  - `Preparing browser storage evidence.`
  - `OPFS ready`
  - `OPFS unavailable`
  - `Refresh storage`
  - `Web storage evidence is current.`
  - `Delete save`
  - `Removed the Web storage gate slot from OPFS.`
  - `Deleted the local gate save.`
  - `Save fixture`
  - `Export save`
  - `Import save`
  - `Load save`
  - `Loaded <last input>`
  - `Save m6-gate-slot does not exist.`
  - `There is no saved gate slot to export yet.`
  - `The save envelope could not be decoded.`
  - `That file is not a valid M6 gate save envelope.`
  - `The current platform bridge does not expose storage status.`
  - `Exported the gate save as a browser download.`
  - `Imported the gate save into OPFS. Load it to restore the shell state.`
  - `Loaded the gate save and restored the shell selection.`
  - `Saved the current shell evidence envelope into OPFS.`
  - `This platform cannot report its storage status for the product gate yet.`
  - `save slot(s) visible in OPFS.`
  - `Selected entity <id> is not present in the current gate fixture.`

## Validation Notes

- `validateLocalizationCatalogs()` still fails closed on missing player-visible
  keys or missing zh-CN/en coverage.
- Dev/debug diagnostics remain isolated behind explicit `wmDiagnostics=1`
  launch gating and the default player launch does not show them.

## M8 Content And Public Text Inventory

WM-0124 treats M8 content text as a separate completeness surface from shell
chrome. The required player-facing M8 families are:

- anomaly labels, descriptions, review rows, counterevidence and scenario text;
- faction event, faction review and faction management text;
- endgame route availability, blocked-path and contested-path text;
- validation, rejection and recovery messages that explain why content failed
  closed.

The accepted M8 roster and endgame scope now define the content families that
must be localized in both `en` and `zh-CN`:

- `docs/04_content_balance/12_m8_anomaly_roster_spec.md`
- `docs/04_content_balance/11_m8_1_0_content_endgame_scope.md`

Current workflow evidence:

- content validation rejects unsafe paths, oversized assets, unsupported
  capabilities, missing references and missing localization before runtime
  consumption;
- M5/M8 content packs must declare and ship both `en` and a Chinese locale
  resource; `zh-CN` is the canonical target and must resolve to
  `locales/zh-CN.json` or `locales/zh-CN.json5` when it is declared, while
  legacy `zh` compatibility is only accepted when a protected pack explicitly
  declares `zh` rather than `zh-CN`;
- compiler validation keeps deterministic compile order and immutable
  catalogs;
- localization completeness for player-visible shell chrome remains gated by
  `validateLocalizationCatalogs()`, while content packs carry their own
  content-localization checks.

This inventory does not claim final public content strings. It records the
player-facing text families that must remain complete for M8 and the gates
that fail closed when coverage is incomplete.
