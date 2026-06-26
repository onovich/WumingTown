# WM-0083 Future M6 Entry Prompt

Status: executable handoff artifact after WM-0084 is reviewed, integrated and
closed. Do not execute this prompt during WM-0084. Do not start M7 from this
prompt.

## Roadmap Authority

The current repository roadmap is the authoritative milestone source.

- M6 is **Web / Windows Product Gate**.
- M7 is **Early Access / public playtest preparation**.
- M8 is **1.0**.

Old inferred M6/M7/M8/M9 structures are deprecated. M6 is not a contract,
town-rule, faction, Story Director, broad content, new anomaly roster or new
core-system milestone unless the current roadmap or a later reviewed roadmap
change explicitly says so.

## Starting Context

M5 is closed by WM-0083 with reviewed evidence for
`m5.alpha_content_framework.first_season.v1`:

- Requested seed: `5`
- Authoritative seed: `155`
- Command stream hash: `0x81d37435`
- Content manifest hash: `0xe55d3015`
- Final world hash: `0xfba70a5c`
- Final read-model hash: `0x9ba83cb7`
- Worker projection bytes: `1631`
- Worker projection hash at reviewed checkpoint: `0xc6420cb1`
- Benchmark artifact:
  `coordination/artifacts/WM-0083/benchmarks/benchmark-results.json`
- Artifact SHA-256:
  `04DB70ECD54022C298293BE9B00EDF404AC18122742F3ACB0C17AC21EE58D346`
- Canonical payload SHA-256:
  `4815D8AC685CC51AC53260C14C302E1C508584AF81EA261664283711A00F0BAC`
- Benchmark warning/blocking thresholds remain 10 percent and 20 percent.

M6 was not started by M5. WM-0083 records `m6Created: false` and
`m6StopSignVerdict: "stop_signs_only"`.

## M6 Product Goal

M6 verifies whether the current game core and alpha content framework can run
as an external-testable product build on Windows Electron and Chrome/Edge Web.

The product gate decides:

- whether Web can ship at the same specification;
- whether Web needs lower fast-forward or lower map/population caps;
- whether Web should be demo-only;
- whether Web should be canceled as a formal target;
- whether Windows has a reproducible external-test build.

## M6 Scope

M6 includes:

- Web product gate.
- Windows Electron product gate.
- Chrome and Edge validation.
- Headless validation.
- Worker parity validation.
- Performance, memory and loading gates.
- Save/load, replay and import/export gates.
- OPFS or Web storage validation.
- SharedArrayBuffer-unavailable fallback validation.
- Input and accessibility baseline.
- Packaging security and Electron preload audit.
- Crash recovery or local diagnostic package path.
- Web build strategy and external-test build strategy.
- Windows external-test build smoke.
- Web tier verdict: same-spec, lower fast-forward, lower cap, demo-only or
  cancel.
- Existing M0-M5 regression protection.
- Productization validation for the alpha content framework.

## M6 Non-Goals

M6 does not include:

- M7 Early Access store, marketing, privacy or public feedback materials.
- M8 1.0 content volume.
- New large simulation systems.
- Reworking M0-M5 core architecture.
- New anomaly roster, faction campaign, town-rule or Story Director expansion
  except when needed as regression evidence from existing systems.
- Public release upload, store submission, paid asset purchase or launch
  commitment.
- Arbitrary code mods, network mods or server/account dependencies.
- Native macOS commitment.
- Starting M7 or M8.

## M6 User Experience Goals

- A tester can launch the Windows build and Web build without editor steps.
- A tester can load into the alpha content framework and observe meaningful
  product surfaces, not an empty shell.
- Basic input works with keyboard and mouse.
- UI scaling, long text, Simplified Chinese/English layout, reduced flashing
  and non-color cues are checked.
- Critical audio cues have visual alternatives or explicit blockers.
- Save/export/import and failure states produce understandable messages.
- Local diagnostics can be generated without exposing secrets, personal paths
  or full saves.

## M6 System Capability Goals

- Web build and Windows Electron build are reproducible from documented
  commands.
- Chrome/Edge Web target runs product-gate scale or records a justified tier
  verdict.
- Windows Electron creates an external-testable build or records blockers.
- OPFS/Web storage and Windows storage paths can save, load, export/import and
  recover from expected errors.
- Worker authority remains isolated from UI, Pixi, React and Electron.
- SharedArrayBuffer unavailable behavior remains correct and measured.
- Local crash/diagnostic path records build, platform, scenario id, hashes,
  structured errors and safe logs.

## Preserved M0-M5 Capabilities

M6 must preserve:

- Fixed 30 TPS simulation semantics.
- Seeded deterministic streams and stable ordering.
- Headless reproducibility.
- Worker/headless parity.
- Focused save/replay discipline.
- M0-M5 benchmark thresholds: 10 percent warning and 20 percent blocking.
- M5 alpha content final hashes `0xfba70a5c` / `0x9ba83cb7` unless a reviewed
  migration explicitly accepts a new baseline.
- Data-only mod security and fail-closed validation.
- Simulation Worker or Node headless as the only authoritative world writer.
- UI, Pixi, React, Electron, storage and diagnostics as read-only or platform
  surfaces, never simulation authority.

## Required Startup Audit For M6

Before creating or claiming any M6 implementation task:

1. Read `AGENTS.md`, `CODEX_START_HERE.md`,
   `.agents/skills/wuming-town-agent-workflow/SKILL.md`,
   `coordination/project-state.json`, `coordination/thread-registry.json`,
   all `coordination/tasks/*.json`, `coordination/reports/WM-0083.md`, this
   prompt, `coordination/reports/WM-0084-m6-task-dag.md`,
   `docs/07_roadmap/00_roadmap.md`,
   `docs/07_roadmap/01_milestones_and_quality_gates.md`,
   `docs/07_roadmap/04_web_release_gate.md`,
   `docs/05_tech/03_performance_budget.md`,
   `docs/05_tech/06_platform_matrix.md`, `docs/06_engineering/*`,
   `docs/08_codex/*`, all ADRs and `PLANS.md`.
2. Confirm WM-0083 and WM-0084 are `done`, reviewed and integrated.
3. Confirm `main` and `origin/main` are synchronized.
4. Confirm the worktree is clean and inbox is 0.
5. Run:
   - `node tools/validate-handoff.mjs`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
   - `git diff --check`
   - `pnpm quality`
6. Confirm no M6 implementation task has already been claimed by another
   thread.

## M6 Task Planning Requirements

If WM-0085+ task JSON does not yet exist, instantiate M6 task packets from the
reviewed DAG in `coordination/reports/WM-0084-m6-task-dag.md` using the next
available task IDs. The task JSON must include:

- id
- title
- milestone: `M6`
- ownerRole
- reviewerRole
- dependencies
- allowedPaths
- forbiddenPaths
- branch
- acceptance
- validationCommands or requiredChecks
- risks and file ownership
- owner gates
- M0-M5 regression coverage
- benchmark impact
- rollback model
- Spark eligibility

Do not claim, promote or implement a downstream M6 task until its task packet
exists, dependencies are satisfied and normal taskctl workflow marks it ready.

## M6 Technical Constraints

- `sim-core` remains free of DOM, React, PixiJS, Electron, Node filesystem,
  true time and ambient randomness.
- Electron renderer must keep `nodeIntegration=false`,
  `contextIsolation=true` and `sandbox=true`.
- Preload exposes only whitelisted APIs; no generic `fs`, `shell` or arbitrary
  IPC.
- Web and Electron must use read models and protocol surfaces, not direct
  world mutation.
- Any new dependency, packaging tool, public protocol, public save format,
  schema migration, codec or security boundary requires a reviewed ADR or
  equivalent gate.
- Web performance work must not fake fast-forward by skipping authoritative
  rules.

## M6 Content And Data Constraints

- No new content volume is required beyond product-gate validation of the
  current alpha content framework.
- Data mods remain schema-validated data only.
- Arbitrary code mods, network mods, platform APIs, executable scripts and
  install hooks remain forbidden.
- Existing content validation, manifest hashes and fail-closed behavior remain
  regression gates.

## M6 UI/UX Constraints

- World rendering remains Pixi; React remains UI/HUD/panels.
- React must not hold authoritative game state.
- Text must fit in Simplified Chinese and English layouts.
- Color-only danger/lamp states are forbidden; use icons, texture, outline or
  shape alternatives.
- Keyboard/mouse basics, UI scaling and reduced flashing must be tested or
  explicitly blocked.
- Playwright or equivalent screenshot/behavior validation is required for
  user-facing UI gate changes.

## M6 Performance Gates

Use `docs/07_roadmap/04_web_release_gate.md` and
`docs/05_tech/03_performance_budget.md`:

- Chrome/Edge Web target: 30 TPS P95 <= 12 ms.
- Main thread operation P95 <= 12 ms.
- 3x has no sustained tick debt; if it cannot pass, Web may lower fast-forward
  or caps.
- Memory has no sustained growth; Web target total is approximately <= 1.2 GB.
- Initial compressed download target is <= 150 MB or a blocker is recorded.
- Windows Electron normal Tick P95 target <= 8 ms and main-thread P95 <= 12 ms.
- Existing benchmark threshold policy remains 10 percent warning and
  20 percent blocking regression.

## M6 Regression Gates

M6 closeout cannot pass unless:

- `pnpm test --filter m5-invariants` passes.
- `pnpm bench` passes without threshold weakening.
- `pnpm sim:run -- --seed 5 --scenario m5-alpha-content-framework --ticks 100000`
  passes or a reviewed migration explains changed hashes.
- Worker parity gates pass for relevant M6 surfaces.
- Save/load and replay gates pass for relevant M6 surfaces.
- M0-M5 task states remain intact.

## M6 Closeout Requirements

M6 closeout must record:

- Web tier verdict: same-spec, lower fast-forward, lower cap, demo-only or
  cancel.
- Windows external-test build verdict.
- Performance and memory baseline.
- Loading/bundle baseline.
- Save/load and import/export results.
- OPFS/Web storage result.
- SharedArrayBuffer fallback result.
- Electron security/preload audit result.
- Input and accessibility baseline result.
- Crash/diagnostic package result.
- Known blockers and residual risks.
- M7 readiness verdict.
- Non-executable future M7 entry prompt.

## M7 Readiness Requirements

M7 readiness means M6 has enough product-gate evidence to decide whether it is
reasonable to plan Early Access/public playtest preparation. It does not create
M7 tasks, store materials, privacy commitments, public upload or feedback
systems.

## Owner Gates

Block and route to project owner if:

- M6 scope cannot be satisfied from current roadmap and product-gate docs.
- Web tier decision implies canceling Web as a formal target.
- Any task needs a server, account system, telemetry, store submission, public
  release upload, paid asset/service or code mods.
- Any task needs public save compatibility commitments.
- Any task needs to change locked decisions: engine, language, simulation
  authority, 30 TPS, platform priority or data-mod policy.
- Any task needs to weaken benchmark thresholds or hide M0-M5 regressions.

## Roles And Models

- project-director / Beacon: `gpt-5.5`, xhigh
- systems-architect / Compass: `gpt-5.5`, xhigh
- client-engineer / Canvas: `gpt-5.4`, high
- qa-performance / Sentinel: `gpt-5.4`, high
- reviewer / Mirror: `gpt-5.5`, xhigh

Do not use rapid-implementer / Spark for M6 planning, public protocols, save,
schema, security, packaging architecture, benchmark baselines or final review.

## Copyable Future M6 `/goal` Prompt

```text
/goal Strictly follow the reviewed M6 entry prompt at coordination/reports/WM-0083-future-m6-entry-prompt.md and complete Wuming Town M6: Web / Windows Product Gate. Start from current main, verify WM-0083 and WM-0084 are done/reviewed/integrated, read coordination/reports/WM-0084-m6-task-dag.md, instantiate or continue the M6 task DAG without changing its product-gate scope, and work autonomously until every M6 task is done, independently reviewed, integrated, merged and pushed to origin/main. M6 must decide the Web tier verdict, produce the Windows external-test build verdict, preserve M0-M5 regression gates, run required quality/benchmark/save/Worker/headless/Web/Electron gates, complete M6 closeout, and write a non-executable future M7 entry prompt. Do not start M7, do not use old M6/M7/M8/M9 inferences, and do not redefine M6 away from Web / Windows Product Gate.
```
