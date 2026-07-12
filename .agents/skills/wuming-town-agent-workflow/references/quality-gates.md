# Quality gates

Before review request:

- acceptance criteria addressed
- required checks run and recorded
- tests added for behavior or regression
- relevant docs and schemas updated
- no unexplained performance regression
- task report exists

Before verification:

- independent reviewer inspected real diff and evidence
- no unresolved high or medium findings
- persistence/determinism/security impact considered

Before integration:

- branch rebased or conflicts resolved intentionally
- full applicable CI gate passes
- integration report includes commit and performance/save impact

## Quiet-host benchmark admission

Performance tasks that require a quiet-host gate must use the reviewed Windows
PowerShell entrypoint; inline sampling commands are prohibited:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .agents/skills/wuming-town-agent-workflow/scripts/quiet-host-admission.ps1 -RepositoryRoot <absolute-repository-root> -ExpectedCommit <full-commit> -NoConcurrentBenchmarkConfirmed
```

The entrypoint always uses two sequential six-second `Get-Process` CPU-delta
windows. Each window must report at most 40 percent normalized host busy and at
most 8 percent for its largest process. The constants are not caller
configurable. The script also requires a clean tree before and after, an exact
commit match, `ACShadows` absence at every boundary, and explicit confirmation
that no benchmark process is already running. It never starts a benchmark.

Every invocation must produce exactly one compact JSON stdout line and no
stderr. Benchmark execution is permitted only when the process exits zero and
the JSON has `evidenceKind=measured`, `status=pass`, `reasonCode=admission_passed`,
the same zero `exitCode`, two finite windows, and the expected commit. Synthetic
evidence is test-only and must never authorize a benchmark. Any nonzero exit,
missing or additional line, malformed JSON, stderr output, changed constants,
or failed postcondition blocks the benchmark; do not replace the tool with an
inline script or retry around the failure.

Validate the contract under Windows PowerShell 5.1 without live measurement:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .agents/skills/wuming-town-agent-workflow/scripts/quiet-host-admission-self-test.ps1
```
