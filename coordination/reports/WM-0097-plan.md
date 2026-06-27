# WM-0097 Plan

## Scope

Close M6 Web / Windows Product Gate after reviewed WM-0085 through WM-0096
evidence, then write a non-executable future M7 entry prompt. Do not create,
promote, claim, implement or review any M7 task.

## Authority Inputs

- Current Roadmap is authoritative: M6 = Web / Windows Product Gate, M7 =
  Early Access / public playtest preparation, M8 = 1.0.
- Old inferred M6/M7/M8/M9 structures remain deprecated.
- WM-0096 records the product verdicts: Web `demo-only`, Windows
  `ready-for-controlled-external-test`.
- WM-0095 records the consolidated benchmark, Web, Windows and smoke evidence.

## Execution Steps

1. Verify all upstream M6 tasks are done and independently reviewed.
2. Draft `coordination/reports/WM-0097.md` with the final M6 closeout verdict,
   evidence matrix, performance/memory/loading baselines, save/import/export
   results, blockers, owner gates and M7 readiness.
3. Draft `coordination/reports/WM-0097-future-m7-entry-prompt.md` as a
   copyable future prompt, explicitly non-executable during WM-0097.
4. Add narrow roadmap and project-state closeout markers only.
5. Run all WM-0097 required checks, including M5 invariant, benchmark and
   100000-tick M5 alpha content regression gates.
6. Complete to the independent reviewer, fix any changes requested, then
   integrate, mark done, merge to main and push.

## Guardrails

- No public release upload, store submission, signing, telemetry, account
  system, paid service, privacy commitment or save compatibility commitment is
  created by WM-0097.
- Web remains a formal gated target, but the M6 Web tier is demo-only from
  current evidence.
- Windows is ready only for controlled external testing of an unsigned unpacked
  local directory build.
- M7 can be planned after owner-sent future `/goal`; M7 public release or Early
  Access execution is not approved by this closeout.
