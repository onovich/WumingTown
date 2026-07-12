# WM-0180 Plan — Windows PowerShell quiet-host admission tool

## Status and authority

WM-0180 is a `qa-performance` workflow-tooling predecessor with an independent
`reviewer`. It exists because WM-0179 encountered two same-class failures in
temporary inline admission code: pipeline output was first captured and lost,
then a synthetic recovery check used the unavailable
`System.Double.IsFinite` API. The workflow requires a reviewed skill or
reference repair after a repeated failure.

WM-0179 remains blocked at product checkpoint `0882988`; its benchmark
invocation count is zero. WM-0180 must not run a real admission or benchmark,
and it must not import or edit that product checkpoint.

## Exact implementation scope

The owner may change only:

1. `scripts/quiet-host-admission.ps1`, the production Windows PowerShell 5.1
   entrypoint;
2. `scripts/quiet-host-admission-self-test.ps1`, a no-sleep synthetic contract
   test;
3. `references/quality-gates.md`, documenting mandatory use and stop rules.

No dependency, Pester package, taskctl change, product file, benchmark,
baseline or other skill metadata is authorized.

## Production contract

The script locks these constants in code: two sequential six-second windows,
host busy at most 40%, maximum single-process host share at most 8%. It uses
only cumulative `Get-Process` CPU deltas normalized by a positive logical CPU
count. It never calls Get-Counter, CIM or WMI and never launches a benchmark.

The caller supplies repository root and exact expected commit and explicitly
confirms that no benchmark process is in flight. The script checks clean git
and commit identity before measurement, ACShadows absence at every boundary,
and clean git again after measurement.

Finite values are validated with both:

```powershell
-not [double]::IsNaN($value) -and -not [double]::IsInfinity($value)
```

`System.Double.IsFinite` is forbidden. Every helper must suppress or capture
incidental pipeline output. The outermost layer writes exactly one compact
JSON line to stdout and nothing to stderr for every controlled outcome.

Exit codes are locked:

| Code | Meaning |
| ---: | --- |
| 0 | complete measured PASS only |
| 2 | invalid invocation or incompatible runtime |
| 10 | git/process/commit/precondition failure |
| 20 | result shape, missing field or non-finite evidence |
| 30 | either locked threshold exceeded |
| 40 | post-measurement git/process failure |
| 70 | caught unexpected exception |

JSON must include the same `exitCode`, a stable `reasonCode`, `status`,
`schemaVersion`, `evidenceKind=measured`, exact commit/runtime facts, locked
constants, both finite scalar window results, maximum-process identity/share,
clean-before/after and ACShadows/no-benchmark facts. A missing or duplicate
result, array, malformed field, threshold breach or exception fails closed.

## Synthetic self-test matrix

The mandatory command is:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .agents/skills/wuming-town-agent-workflow/scripts/quiet-host-admission-self-test.ps1
```

It performs no sleep and no live measurement. It must cover:

- finite acceptance: `0`, negative zero, `24.41`, `40`, `8`,
  `[double]::MaxValue`;
- rejection: null, non-numeric, NaN, positive infinity, negative infinity;
- shape rejection: array/multiple output, missing fields, wrong window count;
- exact threshold boundaries passing and any above-boundary value failing;
- dirty git, commit mismatch, ACShadows, missing external benchmark-process
  confirmation and caught exceptions;
- each stable production exit-code class;
- exactly one parseable compact JSON stdout line, empty stderr, and actual
  process exit matching JSON `exitCode` for synthetic pass and every failure.

The self-test process exits zero only if every assertion passes. If `pwsh` is
available, compatibility may also be recorded, but Windows PowerShell 5.1 is
the mandatory gate.

## Review and return to WM-0179

The independent reviewer checks all three real files, runs the PS5.1 matrix,
verifies that production mode cannot be confused with synthetic evidence, and
confirms no benchmark, live admission or threshold weakening occurred.

After verification, integration and `done`, the project director refreshes the
existing WM-0179 branch from repaired main and audits that `0882988` remains
the only product/test diff. Systems architecture may then authorize exactly
one invocation of the reviewed production script. No inline script or further
dry probe is allowed. A valid measured PASS permits exactly one entity-store
benchmark invocation; any script failure blocks again. Since WM-0179 has run
zero benchmarks, that future command is attempt one, not a retry.

```text
WM-0169 done
  -> WM-0180 reviewed PS5.1 admission tool/reference
       -> independent review -> integrate -> done
  -> resume WM-0179 with exactly one reviewed-script admission
       -> PASS: one entity-store benchmark -> review -> integrate -> done
       -> FAIL: block; no inline replacement
  -> resume WM-0178 canonical gate
  -> resume WM-0177
  -> unblock WM-0170
```

## Stop lines

Stop on a fourth tool/reference file, PowerShell 7-only API, new dependency,
configurable/softer thresholds, multiple stdout lines, any stderr evidence,
uncaught exception, real host sampling, benchmark invocation, taskctl change,
product edit or attempt to unblock a downstream task.
