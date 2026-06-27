# WM-0097 Future M7 Entry Prompt

Status: non-executable future handoff artifact. Do not execute this prompt
during WM-0097. Do not create, promote, claim, implement or review M7 work from
WM-0097.

## Roadmap Authority

The current repository Roadmap is authoritative:

- M6 is Web / Windows Product Gate and is closed by WM-0097 after independent
  review and integration.
- M7 is Early Access / public playtest preparation.
- M8 is 1.0.

Old inferred M6/M7/M8/M9 structures remain deprecated.

## M6 Starting Evidence For Future M7

Use the verified M6 closeout at `coordination/reports/WM-0097.md` as the
starting point.

M6 verdicts:

- Web tier: `demo-only`.
- Windows external-test build:
  `ready-for-controlled-external-test` as an unsigned unpacked local directory
  build.
- M7 readiness: ready to plan M7 from this closeout, not ready for public
  release, store submission, signing, telemetry, account services, paid
  services, public feedback systems or public save compatibility commitments
  without owner approval and reviewed M7 task packets.

Protected M5 regression facts:

- M5 scenario: `m5.alpha_content_framework.first_season.v1`.
- Requested seed: `5`.
- Authoritative seed: `155`.
- Command stream hash: `0x81d37435`.
- Content manifest hash: `0xe55d3015`.
- Final world/read-model hashes: `0xfba70a5c` / `0x9ba83cb7`.
- Worker projection bytes/hash: `1631` / `0xc6420cb1`.
- Benchmark warning/blocking thresholds remain 10 percent and 20 percent.

Known M6 blockers to carry into M7:

- Web same-spec, lower-fast-forward and lower-cap support remain unproven until
  a reviewed task measures a real product-scale browser authority runtime.
- Windows/Web save-container interoperability remains blocked until a reviewed
  desktop save bridge exists.
- Windows host-side diagnostic package writing remains blocked until a reviewed
  narrow diagnostics bridge exists.
- Public release, store submission, signing, installer, updater, telemetry,
  account, crash upload, paid service, public feedback system and public save
  compatibility commitments remain owner-gated.

## Future M7 Scope

M7 may prepare, but does not automatically approve, Early Access or a public
playtest. Scope should be limited to the current Roadmap:

- Tutorial and first-run explanation for the existing pillars and product gate
  surfaces.
- Balance and readability tuning based on the M5 alpha content framework and
  M6 product-gate verdicts.
- Cultural review planning and sensitive-expression review gates.
- Privacy, diagnostic and feedback readiness planning without telemetry,
  account or upload implementation unless owner-approved.
- Storefront material preparation only after owner approval for store-facing
  work.
- Feedback and save compatibility commitments only after reviewed scope and
  owner approval.
- Continued M0-M6 regression protection.

M7 is not M8 1.0 content volume, does not cancel Web, does not turn the
demo-only Web verdict into same-spec support, and does not make public release
or store-submission commitments by default.

## Required Startup Audit For Future M7

Before creating or claiming any M7 implementation task:

1. Read `AGENTS.md`, `.agents/skills/wuming-town-agent-workflow/SKILL.md`,
   `coordination/project-state.json`, all `coordination/tasks/*.json`,
   `coordination/reports/WM-0097.md`, this prompt,
   `docs/07_roadmap/00_roadmap.md`,
   `docs/07_roadmap/01_milestones_and_quality_gates.md`,
   `docs/08_codex/05_human_approval_gates.md`, `docs/06_engineering/*`, all
   relevant platform and product-gate docs, and `PLANS.md`.
2. Confirm WM-0097 is `done`, independently reviewed, integrated, merged and
   pushed to `origin/main`.
3. Confirm `main` and `origin/main` are synchronized, the worktree is clean,
   and inbox unread count is zero.
4. Run:
   - `node tools/validate-handoff.mjs`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
   - `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
   - `git diff --check`
   - `pnpm quality`
5. If a reviewed M7 task DAG does not exist, create a planning-only task to
   draft and independently review the M7 entry prompt and task DAG before any
   M7 implementation task is created, promoted or claimed.
6. If the Roadmap is insufficient to uniquely define M7 scope, block with
   `OWNER APPROVAL REQUIRED` and present at most three options with a
   recommendation, cost and impact.

## Copyable Future M7 `/goal` Prompt

```text
/goal Strictly follow the verified M6 closeout at coordination/reports/WM-0097.md and the future M7 entry prompt at coordination/reports/WM-0097-future-m7-entry-prompt.md. Start from current main, verify WM-0097 is done/reviewed/integrated and pushed to origin/main, and begin Wuming Town M7: Early Access / public playtest preparation without changing Roadmap authority. M7 must preserve M0-M6 regression gates, treat Web as demo-only unless new reviewed browser authority evidence changes the verdict, treat Windows as controlled-external-test only until owner-approved release work exists, and keep public release, store submission, signing, telemetry, account services, paid services, feedback systems and public save compatibility commitments behind owner approval. If no reviewed M7 task DAG exists, first create a planning-only reviewed M7 entry prompt and task DAG; do not claim M7 implementation until that DAG is reviewed and taskctl marks eligible tasks ready. Do not start M8, do not use old M6/M7/M8/M9 inferences, and do not redefine M7 away from Early Access / public playtest preparation.
```
