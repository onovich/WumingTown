# WM-0084 Reviewed M6 Product Gate DAG Draft

Status: draft artifact for independent review.

This document defines the M6 task DAG to be instantiated by a future M6 root
goal after WM-0084 is reviewed, integrated and closed. WM-0084 deliberately does
not create WM-0085+ task JSON because `taskctl done` auto-promotes proposed
tasks whose dependencies are done. This keeps M6 implementation unstarted until
the project owner explicitly starts the M6 goal.

## Roadmap Authority

The current repository roadmap is authoritative:

- M6 is Web / Windows Product Gate.
- M7 is Early Access / public playtest preparation.
- M8 is 1.0.

Old M6/M7/M8/M9 inferences are deprecated. M6 is not a contract, town-rule,
faction, Story Director or new-core-systems milestone unless a future reviewed
roadmap change says otherwise.

## DAG Overview

```text
WM-0085 M6 execution packet and baseline audit
  -> WM-0086 Web build and release-gate harness
      -> WM-0087 Chrome/Edge performance, memory and loading gate
      -> WM-0088 Web storage, OPFS save/import/export and quota gate
      -> WM-0089 SharedArrayBuffer-unavailable fallback gate
  -> WM-0090 Windows Electron package gate
      -> WM-0091 Electron security and preload audit
  -> WM-0092 Input and accessibility baseline
  -> WM-0093 Crash and diagnostic package path
      -> WM-0094 External test build smoke
      -> WM-0095 Long-run scenario and benchmark consolidation
          -> WM-0096 Product gate decision report
              -> WM-0097 M6 closeout and future M7 entry prompt
```

`WM-0094` also depends on WM-0087, WM-0088, WM-0089, WM-0090, WM-0091,
WM-0092 and WM-0093. `WM-0095` also depends on WM-0087, WM-0088, WM-0089,
WM-0090, WM-0091, WM-0092 and WM-0093.

The graph is acyclic. Future task JSON may adjust IDs if the next available ID
differs, but must preserve dependency intent and review gates.

## Common M6 Rules

All M6 tasks must preserve:

- Simulation Worker or Node headless as the only authoritative world writer.
- UI, Pixi, React, Electron, platform storage and diagnostics as consumers or
  platform surfaces, not simulation authority.
- `sim-core` isolation from DOM, React, PixiJS, Electron, Node filesystem,
  real time and ambient randomness.
- M5 final hashes for the alpha content framework unless a reviewed migration
  explicitly accepts a changed baseline.
- Benchmark warning/blocking thresholds: 10 percent warning and 20 percent
  blocking regression.
- No M7 store, privacy, public marketing, tutorial/balance expansion or
  public save compatibility promise unless a specific M6 task gates it.

## WM-0085 - Create M6 Execution Packets And Baseline Audit

- Milestone: M6
- Owner: project-director
- Reviewer: reviewer
- Dependencies: WM-0084
- Branch: `task/WM-0085-create-m6-execution-packets`
- Allowed paths:
  - `coordination/tasks/WM-0085.json`
  - `coordination/tasks/WM-0086.json` through future M6 closeout packet
  - `coordination/reports/WM-0085*.md`
  - `docs/07_roadmap/*`
  - `coordination/project-state.json`
- Forbidden paths:
  - `packages/**`
  - `apps/**`
  - `tools/**`
  - product implementation
  - benchmark artifact rewrites
  - M7 or M8 work
- Acceptance:
  - Creates concrete M6 task JSON from this reviewed DAG.
  - Records startup audit from M5 closeout and current main.
  - Confirms no M6 implementation starts in WM-0085.
  - Keeps downstream M6 packets proposed until normal taskctl promotion after
    WM-0085 is reviewed and closed.
- Validation commands:
  - `node tools/validate-handoff.mjs`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
  - `git diff --check`
  - `pnpm quality`
- Risks:
  - Downstream packets too broad or too tiny.
  - Old roadmap inference leaks back in.
- Owner gates:
  - Block if any packet defines M6 as non-product-gate work.
  - Block if taskctl would promote implementation before WM-0085 review.
- M0-M5 regression scope:
  - Preserve all closed task states and M5 final hashes.
- File ownership:
  - Coordination and roadmap planning files only.

## WM-0086 - Add Web Build And Release-Gate Harness

- Milestone: M6
- Owner: client-engineer
- Reviewer: reviewer
- Dependencies: WM-0085
- Branch: `task/WM-0086-web-build-release-gate-harness`
- Allowed paths:
  - `apps/web/**`
  - `packages/ui-react/**`
  - `packages/renderer-pixi/**`
  - `packages/platform/**`
  - `tools/**web**`
  - `docs/05_tech/**`
  - `docs/07_roadmap/**`
  - `coordination/reports/WM-0086.md`
  - `coordination/tasks/WM-0086.json`
- Forbidden paths:
  - `packages/sim-core/**` unless separately approved
  - public Worker protocol redesign
  - public save compatibility promise
  - content expansion
  - M7 store/public playtest material
- Acceptance:
  - Web build has a repeatable release-gate command or documented harness.
  - Harness runs against real M5/M4-derived vertical-slice content, not an
    empty map.
  - Chrome/Edge target assumptions are recorded.
  - Build strategy records bundle-size, asset and cross-origin-isolation
    assumptions.
- Validation commands:
  - `pnpm typecheck`
  - `pnpm build --filter web`
  - `pnpm test:e2e --filter web`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  - `git diff --check`
  - `pnpm quality`
- Risks:
  - Harness proves shell behavior but not product gate.
  - Web build requires new dependency or hosting assumption.
- Owner gates:
  - Block on new runtime dependency, protocol change or server requirement.
- M0-M5 regression scope:
  - No authoritative simulation changes.
- File ownership:
  - Web app, UI/renderer/platform web surfaces and docs.

## WM-0087 - Chrome/Edge Performance, Memory And Loading Gate

- Milestone: M6
- Owner: qa-performance
- Reviewer: reviewer
- Dependencies: WM-0086
- Branch: `task/WM-0087-web-performance-memory-loading`
- Allowed paths:
  - `packages/benchmarks/**`
  - `apps/web/**`
  - `tools/**`
  - `docs/05_tech/03_performance_budget.md`
  - `docs/07_roadmap/04_web_release_gate.md`
  - `coordination/reports/WM-0087.md`
  - `coordination/tasks/WM-0087.json`
- Forbidden paths:
  - threshold weakening
  - product behavior fixes inside benchmark task
  - M5 benchmark artifact rewrites
  - simulation authority changes
- Acceptance:
  - Chrome and Edge evidence covers 30 TPS P95 <= 12 ms target, main-thread
    P95 <= 12 ms target, memory no-growth and initial compressed download
    target or documented failure.
  - Evidence uses the product gate scale from Web release gate:
    192 x 192, 40 active actors, 20k entities, lamp network, dossiers/events
    and 90 TPS requests where implemented.
  - Records whether Web is same-spec, lower fast-forward, lower cap, demo-only
    or cancellation candidate.
- Validation commands:
  - `pnpm bench`
  - `pnpm test:e2e --filter web`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  - `git diff --check`
  - `pnpm quality`
- Risks:
  - Local hardware variance.
  - Browser tooling cannot capture stable memory metrics.
- Owner gates:
  - Block on >20 percent regression without accepted explanation.
  - Block if evidence uses empty-world results.
- M0-M5 regression scope:
  - Run M5 invariant and final hash checks when product behavior changes.
- File ownership:
  - Benchmarks, web gate tooling and performance docs.

## WM-0088 - Web Storage, OPFS Save/Import/Export And Quota Gate

- Milestone: M6
- Owner: client-engineer
- Reviewer: reviewer
- Dependencies: WM-0086
- Branch: `task/WM-0088-web-storage-opfs-import-export`
- Allowed paths:
  - `packages/persistence/**`
  - `packages/platform/**`
  - `apps/web/**`
  - `packages/ui-react/**`
  - `docs/05_tech/04_persistence_mods_security.md`
  - `docs/05_tech/06_platform_matrix.md`
  - `coordination/reports/WM-0088.md`
  - `coordination/tasks/WM-0088.json`
- Forbidden paths:
  - public save compatibility promise beyond M6 gate
  - arbitrary code mods
  - platform secret handling
  - simulation authority changes
- Acceptance:
  - OPFS save, load, export, import and quota-failure recovery are tested.
  - Windows/Web save container interoperability is either proven or a blocker
    is recorded for product-gate decision.
  - Error states produce user-facing and diagnostic structured reasons.
- Validation commands:
  - `pnpm typecheck`
  - `pnpm test --filter persistence`
  - `pnpm test:e2e --filter web-storage`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  - `git diff --check`
  - `pnpm quality`
- Risks:
  - Browser quota APIs are inconsistent.
  - Save export may expose local paths or sensitive diagnostics.
- Owner gates:
  - Block on public save migration/codec change without ADR.
- M0-M5 regression scope:
  - Save/load changes must preserve M5 focused save/replay evidence or provide
    reviewed migration evidence.
- File ownership:
  - Persistence, platform and web storage UI surfaces.

## WM-0089 - SharedArrayBuffer-Unavailable Fallback Gate

- Milestone: M6
- Owner: systems-architect
- Reviewer: reviewer
- Dependencies: WM-0086
- Branch: `task/WM-0089-sharedarraybuffer-fallback`
- Allowed paths:
  - `packages/sim-worker/**`
  - `packages/sim-protocol/**`
  - `packages/platform/**`
  - `apps/web/**`
  - `docs/05_tech/02_worker_protocol.md`
  - `docs/05_tech/06_platform_matrix.md`
  - `coordination/reports/WM-0089.md`
  - `coordination/tasks/WM-0089.json`
- Forbidden paths:
  - UI authority
  - public protocol redesign without ADR
  - real-time or ambient-random authority
  - M7 hosting assumptions
- Acceptance:
  - Web runtime behaves correctly without SharedArrayBuffer.
  - Transferable snapshot or documented fallback path preserves authority and
    read-only projections.
  - Cross-origin isolation assumptions are recorded.
- Validation commands:
  - `pnpm typecheck`
  - `pnpm test --filter worker`
  - `pnpm test:e2e --filter worker-smoke`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  - `git diff --check`
  - `pnpm quality`
- Risks:
  - Fallback lowers fast-forward or entity caps.
- Owner gates:
  - Block on new protocol family, schema version or UI repair path.
- M0-M5 regression scope:
  - Worker parity and M5 read-model projections must remain read-only.
- File ownership:
  - Worker/protocol/platform fallback surfaces.

## WM-0090 - Windows Electron Package Gate

- Milestone: M6
- Owner: client-engineer
- Reviewer: reviewer
- Dependencies: WM-0085
- Branch: `task/WM-0090-windows-electron-package-gate`
- Allowed paths:
  - `apps/desktop-electron/**`
  - `packages/platform/**`
  - `packages/ui-react/**`
  - `packages/renderer-pixi/**`
  - `docs/05_tech/06_platform_matrix.md`
  - `coordination/reports/WM-0090.md`
  - `coordination/tasks/WM-0090.json`
- Forbidden paths:
  - adding packaging dependencies without ADR
  - enabling renderer Node integration
  - exposing generic fs/shell IPC
  - M7 installer/store work
- Acceptance:
  - Windows package or unpacked external-test build is reproducible.
  - Build opens the current product shell and M5 scenario surfaces.
  - Package metadata, artifact path, size and known warnings are recorded.
- Validation commands:
  - `pnpm build --filter desktop-electron`
  - `pnpm test:e2e --filter electron`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  - `git diff --check`
  - `pnpm quality`
- Risks:
  - Packaging tool download brittleness.
  - Package size or smoke coverage insufficient for external test.
- Owner gates:
  - Block on installer/signing/updater scope.
- M0-M5 regression scope:
  - Electron remains a platform shell, not simulation authority.
- File ownership:
  - Desktop Electron app and platform shell docs.

## WM-0091 - Electron Security And Preload Audit

- Milestone: M6
- Owner: systems-architect
- Reviewer: reviewer
- Dependencies: WM-0090
- Branch: `task/WM-0091-electron-security-preload-audit`
- Allowed paths:
  - `apps/desktop-electron/**`
  - `packages/platform/**`
  - `docs/05_tech/04_persistence_mods_security.md`
  - `docs/06_engineering/06_dependency_security_policy.md`
  - `coordination/reports/WM-0091.md`
  - `coordination/tasks/WM-0091.json`
- Forbidden paths:
  - `nodeIntegration=true`
  - `contextIsolation=false`
  - `sandbox=false`
  - generic `fs`, `shell` or arbitrary IPC exposure
  - secret handling
- Acceptance:
  - Electron settings are audited and locked to nodeIntegration false,
    contextIsolation true and sandbox true.
  - Preload surface is minimal and typed.
  - Storage/diagnostic APIs expose only whitelisted operations.
- Validation commands:
  - `pnpm typecheck`
  - `pnpm test:e2e --filter electron`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  - `git diff --check`
  - `pnpm quality`
- Risks:
  - External test diagnostics tempt broad IPC.
- Owner gates:
  - Block on any broad host API exposure.
- M0-M5 regression scope:
  - Renderer remains read-only to simulation authority.
- File ownership:
  - Electron main/preload/platform security docs.

## WM-0092 - Input And Accessibility Baseline

- Milestone: M6
- Owner: client-engineer
- Reviewer: reviewer
- Dependencies: WM-0085
- Branch: `task/WM-0092-input-accessibility-baseline`
- Allowed paths:
  - `apps/web/**`
  - `apps/desktop-electron/**`
  - `packages/ui-react/**`
  - `packages/renderer-pixi/**`
  - `docs/01_design/05_ui_ux_information_design.md`
  - `coordination/reports/WM-0092.md`
  - `coordination/tasks/WM-0092.json`
- Forbidden paths:
  - UI-authoritative simulation repair
  - inaccessible color-only states
  - M7 tutorial expansion
- Acceptance:
  - Keyboard/mouse basics work for product gate surfaces.
  - UI scaling, long text, Chinese/English layout, reduced flashing and
    non-color danger/lamp cues are checked.
  - Key audio cues have visual alternatives or documented blockers.
- Validation commands:
  - `pnpm typecheck`
  - `pnpm test:e2e --filter accessibility`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  - `git diff --check`
  - `pnpm quality`
- Risks:
  - Accessibility scope expands into full tutorial.
- Owner gates:
  - Block on player-critical state conveyed by color or sound alone.
- M0-M5 regression scope:
  - UI remains a read-model consumer.
- File ownership:
  - UI, renderer input and accessibility docs.

## WM-0093 - Crash And Diagnostic Package Path

- Milestone: M6
- Owner: client-engineer
- Reviewer: reviewer
- Dependencies: WM-0085
- Branch: `task/WM-0093-crash-diagnostic-package-path`
- Allowed paths:
  - `apps/web/**`
  - `apps/desktop-electron/**`
  - `packages/platform/**`
  - `packages/persistence/**`
  - `docs/05_tech/05_testing_observability_ci.md`
  - `coordination/reports/WM-0093.md`
  - `coordination/tasks/WM-0093.json`
- Forbidden paths:
  - telemetry or network upload
  - secrets or complete personal save dumps in logs
  - simulation authority changes
  - M7 public feedback system
- Acceptance:
  - Local diagnostic package captures build, platform, scenario id, hashes,
    recent structured errors and safe logs.
  - Crash/recovery path works for Web and Windows or records platform-specific
    blockers.
  - No private paths, secrets or full save contents are written to reports.
- Validation commands:
  - `pnpm typecheck`
  - `pnpm test --filter diagnostics`
  - `pnpm test:e2e --filter diagnostics`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  - `git diff --check`
  - `pnpm quality`
- Risks:
  - Diagnostic scope becomes telemetry.
- Owner gates:
  - Block on network upload, PII leakage or broad file access.
- M0-M5 regression scope:
  - Diagnostics are derived from structured state and cannot mutate authority.
- File ownership:
  - Platform diagnostics and safe reporting docs.

## WM-0094 - External Test Build Smoke

- Milestone: M6
- Owner: qa-performance
- Reviewer: reviewer
- Dependencies: WM-0087, WM-0088, WM-0089, WM-0090, WM-0091, WM-0092, WM-0093
- Branch: `task/WM-0094-external-test-build-smoke`
- Allowed paths:
  - `apps/**`
  - `packages/platform/**`
  - `tools/**`
  - `docs/05_tech/**`
  - `coordination/reports/WM-0094.md`
  - `coordination/tasks/WM-0094.json`
- Forbidden paths:
  - storefront material
  - public release upload
  - signing credentials
  - telemetry
- Acceptance:
  - Windows external-test build starts from a clean artifact path.
  - Web build starts from a product-gate target.
  - Smoke covers launch, load, save/export/import where available, basic input
    and diagnostics.
- Validation commands:
  - `pnpm test:e2e`
  - `node tools/validate-handoff.mjs`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  - `git diff --check`
  - `pnpm quality`
- Risks:
  - Build smoke passes without meaningful scenario.
- Owner gates:
  - Block if smoke does not exercise product gate surfaces.
- M0-M5 regression scope:
  - Smoke does not alter simulation baselines.
- File ownership:
  - Smoke tooling, docs and reports.

## WM-0095 - Long-Run Scenario And Benchmark Consolidation

- Milestone: M6
- Owner: qa-performance
- Reviewer: reviewer
- Dependencies: WM-0087, WM-0088, WM-0089, WM-0090, WM-0091, WM-0092, WM-0093
- Branch: `task/WM-0095-m6-long-run-benchmark-consolidation`
- Allowed paths:
  - `packages/benchmarks/**`
  - `tools/headless-runner/**`
  - `tools/**`
  - `docs/05_tech/03_performance_budget.md`
  - `docs/05_tech/05_testing_observability_ci.md`
  - `docs/07_roadmap/01_milestones_and_quality_gates.md`
  - `coordination/reports/WM-0095.md`
  - `coordination/tasks/WM-0095.json`
- Forbidden paths:
  - threshold weakening
  - product fixes inside QA task
  - artifact rewrites from verified M5
  - M7 work
- Acceptance:
  - M6 consolidates headless, Worker, Web and Windows evidence.
  - Runs M5 alpha content long-run and M6 product-gate checks without M0-M5
    regression.
  - Records performance, memory, loading, save/import/export and diagnostic
    evidence needed for product-gate verdict.
- Validation commands:
  - `pnpm test --filter m5-invariants`
  - `pnpm bench`
  - `pnpm sim:run -- --seed 5 --scenario m5-alpha-content-framework --ticks 100000`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  - `git diff --check`
  - `pnpm quality`
- Risks:
  - Product-gate results legally change hashes; requires reviewed migration
    evidence.
- Owner gates:
  - Block on unexplained hash drift, threshold weakening or benchmark artifact
    ambiguity.
- M0-M5 regression scope:
  - M5 final world/read-model hashes `0xfba70a5c` / `0x9ba83cb7` remain
    protected unless reviewed migration changes them.
- File ownership:
  - Benchmarks, headless runner diagnostics and observability docs.

## WM-0096 - Product Gate Decision Report

- Milestone: M6
- Owner: project-director
- Reviewer: reviewer
- Dependencies: WM-0094, WM-0095
- Branch: `task/WM-0096-product-gate-decision-report`
- Allowed paths:
  - `coordination/reports/WM-0096.md`
  - `coordination/tasks/WM-0096.json`
  - `docs/07_roadmap/04_web_release_gate.md`
  - `docs/05_tech/06_platform_matrix.md`
  - `coordination/project-state.json`
- Forbidden paths:
  - product implementation
  - benchmark threshold edits
  - M7 store/privacy/marketing material
- Acceptance:
  - Web tier verdict is one of: same-spec, lower fast-forward, lower cap,
    demo-only or cancel.
  - Windows external-test build verdict is explicit.
  - Known blockers and residual risks are enumerated.
  - Decision cites WM-0087 through WM-0095 evidence.
- Validation commands:
  - `node tools/validate-handoff.mjs`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
  - `git diff --check`
  - `pnpm quality`
- Risks:
  - Verdict overclaims external readiness.
- Owner gates:
  - Owner approval required before public release, store submission or paid
    asset/service decisions.
- M0-M5 regression scope:
  - Decision cannot waive failed regression gates.
- File ownership:
  - Decision report and narrow roadmap/platform status markers.

## WM-0097 - M6 Closeout And Future M7 Entry Prompt

- Milestone: M6
- Owner: project-director
- Reviewer: reviewer
- Dependencies: WM-0096
- Branch: `task/WM-0097-m6-closeout-future-m7-entry`
- Allowed paths:
  - `coordination/reports/WM-0097.md`
  - `coordination/reports/WM-0097-future-m7-entry-prompt.md`
  - `coordination/tasks/WM-0097.json`
  - `docs/07_roadmap/00_roadmap.md`
  - `docs/07_roadmap/01_milestones_and_quality_gates.md`
  - `coordination/project-state.json`
- Forbidden paths:
  - M7 task creation, promotion, claim, implementation or review
  - public release upload
  - store material production
  - privacy policy commitments beyond readiness prompt
- Acceptance:
  - Closes M6 only after all M6 tasks are done and independently reviewed.
  - Records Web tier verdict, Windows external-test verdict, performance and
    memory baselines, save/import/export results, blockers and M7 readiness.
  - Writes a non-executable future M7 entry prompt.
  - Does not start M7.
- Validation commands:
  - `node tools/validate-handoff.mjs`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
  - `git diff --check`
  - `pnpm quality`
  - `pnpm test --filter m5-invariants`
  - `pnpm bench`
  - `pnpm sim:run -- --seed 5 --scenario m5-alpha-content-framework --ticks 100000`
- Risks:
  - M7 readiness prompt becomes M7 implementation.
- Owner gates:
  - Do not create, promote, claim or implement M7.
  - Block if any M6 task remains unverified or any required gate is missing.
- M0-M5 regression scope:
  - Final M6 closeout must preserve or explicitly migrate all prior milestone
    baseline evidence.
- File ownership:
  - Closeout report, future M7 prompt and narrow roadmap/project-state markers.
