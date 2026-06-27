# M7 Playtest Checklist And Tester Protocol

Status: WM-0108 M7 preparation artifact. This protocol is for controlled
external testing and Web demo-only evaluation. It is not public recruitment,
public release, Early Access launch, store submission, public Web launch,
signing, installer distribution, telemetry approval, account approval, paid
service approval, public feedback approval, final privacy/legal/store copy or
public save compatibility approval. M8 remains unstarted.

## Fixed Verdicts And Regression Facts

- M6 = Web / Windows Product Gate.
- M7 = Early Access / public playtest preparation.
- M8 = 1.0.
- Web remains `demo-only`.
- Windows remains unsigned `ready-for-controlled-external-test`.
- M5 final world/read-model hashes: `0xfba70a5c` / `0x9ba83cb7`.
- Benchmark warning/blocking policy remains 10 percent warning and 20 percent
  blocking regression.

## Distribution Boundary

Allowed:

- Owner-approved controlled tester list.
- Private distribution of the unsigned Windows unpacked directory build.
- Web demo-only evaluation with explicit demo expectations.
- Manual tester notes, screenshots, short clips and local diagnostic JSON when
  the tester chooses to provide them through the approved channel.

Not allowed:

- No public recruitment.
- No public release.
- No Early Access launch announcement.
- No store submission.
- No public Web launch.
- No signing, installer or updater.
- No telemetry, analytics, account service, paid service, crash upload or hosted feedback.
- No final privacy/legal/store claims.
- No public save compatibility promise.

## Producer Checklist

Before sharing a controlled test build, the producer records:

- Current git commit and task context.
- `node tools/validate-handoff.mjs` result.
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
  result.
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
  result.
- `git diff --check` result.
- `pnpm quality` result.
- `pnpm ci:local` result with a temporary `WM_ARTIFACT_DIR`.
- Whether the shared target is Windows controlled external test, Web
  demo-only, or both.
- Confirmation that no public release/store/signing/telemetry/account/paid
  action was performed.

## Tester Session Protocol

1. Confirm the build source and target.
2. Confirm tester understands the scope:
   - Web remains demo-only.
   - Windows remains controlled external test only.
   - Save compatibility is not final.
   - Diagnostics and feedback are manual/local.
3. Run the assigned path.
4. Record exact notes using the checklist sections below.
5. Export local diagnostic JSON only if requested and only through the in-app
   user action.
6. Share notes through the owner-approved channel.

## Windows Controlled External Test Checklist

- Launch from the intact unpacked directory.
- Confirm `WumingTown.exe` opens the product-gate shell.
- Record Windows version, display scaling and approximate hardware if relevant.
- Record any unsigned-build OS warning text if the tester chooses to share it.
- Verify pointer selection, keyboard pan/zoom and compact window behavior.
- Confirm there is no installer, signing, updater, Steam/store package or
  public release claim.
- Record whether diagnostic blocker text is visible when diagnostics are
  discussed.

## Web Demo-Only Checklist

- Confirm browser and version, especially Chrome/Edge.
- Confirm the page presents Web as demo-only.
- Confirm the shell opens and basic input works.
- Check Web save/export/import only for the current test envelope.
- Check local diagnostic download only through user action.
- Record quota/import errors as visible structured errors.
- Confirm tester did not infer full Web parity, public Web launch or stable
  public Web saves from the copy.

## First-Run Onboarding Checklist

- Did launch readiness become clear?
- Did movement/input and time labels become clear before deeper systems?
- Could the tester identify a resident, current job, current step, needs,
  thoughts and decision text?
- Did hauling/building and work-priority concepts appear as existing
  read-model surfaces rather than direct UI authority?
- Did event, lamp, Chronicle, town ordinance and evidence language feel
  understandable without exposing hidden truth?
- Were structured failure explanations visible when actions or saves were
  blocked?

## Balance And Readability Checklist

- When did the tester understand the first active pressure?
- Did night risk feel like observation/preparation before punishment?
- Did event frequency feel readable enough for controlled testing?
- Were recovery windows visible before consequences became final?
- Did blocked choices explain whether resource pressure, legal pressure,
  evidence, lamp coverage, recovery type, faction/governance risk or save
  policy caused the block?
- Did any line imply final balance, final strategy parity or public release
  readiness?

## Privacy, Diagnostics And Feedback Checklist

- Confirm tester understands feedback is manual and controlled.
- Confirm no telemetry or automatic upload is presented.
- Confirm local diagnostic export is user-initiated.
- Windows host-side diagnostic package writing remains blocked.
- Record whether support instructions accidentally requested forbidden data.
- Do not collect secrets, tokens, passwords, cookies, private keys, payment data or unrelated private paths.
- Do not collect full save files unless a later reviewed data-handling task explicitly permits it.

## Save Policy Checklist

- Confirm tester understands Web save/export/import is scoped to the current
  test envelope.
- Public save compatibility is not promised.
- Windows/Web save-container interoperability remains blocked.
- Confirm old test saves may be rejected with structured errors.
- Confirm browser cleanup/private mode may remove local Web saves.
- Record visible save/import/export error codes and reproduction steps.

## Cultural And Public-Copy Checklist

- Do not describe Wuming Town as authentic folklore, historically accurate
  ancient China, real ritual practice, real religion, medical advice, legal
  advice or spiritual advice.
- Flag any term that makes fictional systems sound like real-world claims.
- Flag insensitive framing of residents, outsiders, disability, illness,
  mourning, religion, elders, children or rural communities.
- Avoid "monster race" language where "anomaly" or "anomalous visitor" is
  intended.
- Any identifiable real ritual, sacred practice, minority-group symbol or
  sensitive historical reference requires owner approval and likely external
  review.

## Known-Issues Confirmation

The tester-facing notes must keep these known issues visible:

- Web same-spec, lower-fast-forward and lower-cap support remain unproven.
- Windows host diagnostics and Windows/Web save interoperability remain
  blocked.
- Public release, Early Access launch, store submission, public Web launch,
  signing, telemetry, accounts, paid services, crash upload, hosted feedback,
  final privacy/legal/store copy and public save compatibility remain
  owner-gated.

## Evidence Template

```text
tester_id_or_alias:
build_commit:
target: windows-controlled-test | web-demo-only | both
session_date:
platform:
launch_result:
input_result:
onboarding_notes:
balance_readability_notes:
diagnostics_feedback_notes:
save_policy_notes:
cultural_copy_notes:
known_issue_confusions:
structured_error_codes:
screenshots_or_clips_provided: yes | no
diagnostic_json_provided: yes | no
forbidden_data_requested_or_shared: yes | no
follow_up_needed:
```

## Downstream Use

WM-0109 must cite this protocol when deciding controlled-test readiness,
public playtest readiness, Web demo readiness and Windows controlled-test
readiness.

WM-0110 must record whether the protocol is complete enough for M7 closeout and
which owner-gated decisions remain open before any future M8 planning.
