# WM-0110 Future M8 Entry Prompt

Status: non-executable future handoff artifact. Do not execute this prompt
during WM-0110. Do not create, promote, claim, implement or review M8 work from
WM-0110.

## Roadmap Authority

The current repository Roadmap is authoritative:

- M6 is Web / Windows Product Gate and is closed.
- M7 is Early Access / public playtest preparation and is closed only after
  WM-0110 is independently reviewed, integrated and marked done.
- M8 is 1.0.

Old inferred M6/M7/M8/M9 structures remain deprecated.

## M7 Starting Evidence For Future M8

Use the verified M7 closeout at `coordination/reports/WM-0110.md` as the
starting point after WM-0110 is `done` on `origin/main`.

M7 verdicts to carry forward:

- Early Access preparation: prepared for owner review, not launch-approved.
- Public playtest preparation: prepared as controlled-test/public-playtest
  evaluation material, not public-recruitment-approved.
- Web demo readiness: ready for demo-only evaluation, not same-spec, public Web
  launch or parity.
- Windows controlled external test readiness: ready for unsigned unpacked local
  directory controlled external testing, not signing, installer, store or
  public release.
- M8 readiness: ready for a future owner-sent M8 planning goal, not ready for
  autonomous M8 implementation from WM-0110.

Protected M5/M6 regression facts:

- M5 scenario: `m5.alpha_content_framework.first_season.v1`.
- Headless alias: `m5-alpha-content-framework`.
- Requested seed: `5`.
- Authoritative seed: `155`.
- Command stream hash: `0x81d37435`.
- Content manifest hash: `0xe55d3015`.
- Final world/read-model hashes: `0xfba70a5c` / `0x9ba83cb7`.
- Benchmark warning/blocking thresholds remain 10 percent and 20 percent.
- Web verdict remains `demo-only`.
- Windows verdict remains unsigned local-directory
  `ready-for-controlled-external-test`.

Owner-gated decisions that remain blocked:

- Public release or Early Access launch.
- Public playtest recruitment or public campaign.
- Store submission, store publication, final store claims or trailer release.
- Public Web launch, Web cancellation or Web verdict change.
- Signed Windows installer, updater, Steam/store package or public build.
- Telemetry, analytics, accounts, paid services, hosted support, crash upload
  or public feedback system.
- Final privacy/legal claims.
- Public save compatibility, cross-version migration guarantee, Windows/Web
  save interoperability claim or collection of full tester save files.
- Any change to locked decisions without owner approval.

## Future M8 Scope

M8 is the 1.0 milestone. It may plan and implement 1.0 closure work only after
an owner sends a new M8 goal and a reviewed M8 task DAG exists.

M8 should cover, at planning granularity:

- 12 to 15 anomaly roster completion and validation.
- Full faction and endgame arc completion.
- Stable mod/data content workflow within the existing code-mod restrictions.
- Long-save stability and migration policy appropriate to 1.0.
- Performance and memory gates for longer product-scale play.
- Localization and public-facing copy completion.
- Final known issues, release notes and support boundaries.
- Release-candidate quality gates, with owner approval before any public
  release, store submission, signing or final legal/privacy commitment.

M8 must not assume that M7 preparation approved launch. It starts from M7
evidence and owner gates, then plans 1.0 work through the normal task-control
workflow.

## Required Startup Audit For Future M8

Before creating or claiming any M8 implementation task:

1. Read `AGENTS.md`, `.agents/skills/wuming-town-agent-workflow/SKILL.md`,
   `coordination/project-state.json`, all `coordination/tasks/*.json`,
   `coordination/reports/WM-0110.md`, this prompt,
   `docs/07_roadmap/00_roadmap.md`,
   `docs/07_roadmap/01_milestones_and_quality_gates.md`,
   `docs/08_codex/05_human_approval_gates.md`, `docs/06_engineering/*`,
   relevant platform/product-gate docs, accepted ADRs and `PLANS.md`.
2. Confirm WM-0110 is `done`, independently reviewed, integrated, merged and
   pushed to `origin/main`.
3. Confirm `main` and `origin/main` are synchronized, the worktree is clean,
   inbox unread count is zero and no M7 `changes_requested` remains open.
4. Run:
   - `node tools/validate-handoff.mjs`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
   - `git diff --check`
   - `pnpm quality`
5. If a reviewed M8 task DAG does not exist, create a planning-only task to
   draft and independently review the M8 entry prompt and task DAG before any
   M8 implementation task is created, promoted or claimed.
6. If the Roadmap is insufficient to uniquely define M8 scope, block with
   `OWNER APPROVAL REQUIRED` and present at most three options with a
   recommendation, cost and impact.

## Copyable Future M8 `/goal` Prompt

```text
/goal Strictly follow the verified M7 closeout at coordination/reports/WM-0110.md and the future M8 entry prompt at coordination/reports/WM-0110-future-m8-entry-prompt.md. Start from current main, verify WM-0110 is done/reviewed/integrated and pushed to origin/main, and begin Wuming Town M8: 1.0 without changing Roadmap authority. M8 must preserve M0-M7 regression gates, keep Web as demo-only unless a new reviewed browser-authority task and owner approval change the verdict, keep Windows as unsigned controlled-external-test until owner-approved release work exists, and keep public release, Early Access launch, store submission, signing, telemetry, account services, paid services, public feedback systems, final privacy/legal/store claims and public save compatibility commitments behind owner approval. If no reviewed M8 task DAG exists, first create a planning-only reviewed M8 entry prompt and task DAG; do not claim M8 implementation until that DAG is reviewed and taskctl marks eligible tasks ready. Do not use old M6/M7/M8/M9 inferences, do not retroactively reopen M7, and do not execute public release/store/signing/telemetry/account/paid-service actions without explicit owner approval and reviewed task packets.
```
