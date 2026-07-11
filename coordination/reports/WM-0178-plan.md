# WM-0178 Plan — Canonical benchmark gate repair and paired attribution

## Status and authority

WM-0178 is an architect-approved, ready and unclaimed `qa-performance` task.
It is the mandatory performance predecessor for blocked WM-0177. It may repair
only the exact benchmark harness surfaces listed in its packet and may write
new evidence only under `coordination/artifacts/WM-0178/**`.

The canonical workload, fixtures, invariant payloads,
`packages/benchmarks/baseline.json`, 10 percent warning threshold, 20 percent
failure threshold, 9 samples and 2 warmups are locked. A written explanation
or exception may document attribution but cannot make a non-zero
`corepack pnpm bench` required check pass.

## Reviewed evidence and disposition

The comparison used the same approved unsandboxed Windows x64 host, Node
`v24.13.1`, AMD Ryzen 7 9700X CPU, 9 samples and 2 warmups. Exact clean main was
`4175afd`; the WM-0177 checkpoint was `054d501`.

| Suite | Baseline ms | Main median / gate | WM-0177 median / gate | Checkpoint vs main | Reviewed attribution |
| --- | ---: | --- | --- | ---: | --- |
| `entity-store` | 244.5070 | 373.1679 / +52.62% FAIL | 371.4461 / +51.92% FAIL | -0.46% | Pre-existing clean-main gate failure |
| `m3-ordinary-life-long-run` | 24.4560 | 27.1061 / +10.84% WARN | 39.2472 / +60.48% FAIL | +44.79% | WM-0177 task regression |
| `m4-core-vertical-slice-long-run` | 4.6112 | 5.8341 / +26.52% FAIL | 6.6062 / +43.26% FAIL | +13.24% | Mixed main failure and task worsening |
| `m5-alpha-content-long-run` | 74.6344 | 76.8893 / +3.02% OK | 106.3368 / +42.48% FAIL | +38.30% | WM-0177 task regression |
| `map-dirty` | 1.0000 | 1.25174375 / +25.17% FAIL | 1.4998 / +49.98% FAIL | +19.82% | Mixed main failure and task worsening |
| `spatial-index` | 1436.7170 | 1572.6804 / +9.46% OK | 1952.9940 / +35.93% FAIL | +24.19% | WM-0177 task-associated regression |

The unchanged owner-local `work-offers`, `pathing-100` and `reservations`
suites passed on both lineages. Those results are useful attribution evidence,
but they cannot waive the aggregate full-suite failure.

The formal disposition is therefore mixed, not environmental-only and not
task-only:

1. Clean main itself cannot satisfy the fixed canonical gate because
   `entity-store`, M4 and `map-dirty` fail.
2. WM-0177 adds material M3, M5 and spatial-index deltas and worsens M4 and
   `map-dirty`.
3. WM-0177 cannot absorb unrelated clean-main repairs into its max-12-file
   owner-surface scope.
4. No waiver is authorized. WM-0178 must restore a real zero-exit canonical
   gate before WM-0177 can resume.

## Execution plan

1. Before editing, verify one clean worktree, exact commits, tool versions,
   current power/host facts, immutable baseline bytes and the benchmark runner's
   sampling, ordering, timing and artifact behavior.
2. Run each failing filter in a fresh Node process. Alternate main then
   checkpoint, checkpoint then main, so order, thermal state, background load,
   JIT and GC effects are visible instead of being assigned to a branch by
   run order.
3. Run the full suite on both commits with the same alternation. Record command,
   exit code, all raw samples, medians, invariants, environment and artifact
   hashes. Use only the existing worktree with serial clean checkouts or an
   explicitly reviewed equivalent; never add a linked worktree.
4. Attribute the common clean-main failures and branch-only deltas to exact
   harness or environment call paths. Repair only packet-owned benchmark
   harness surfaces, preserving workload and gate semantics.
5. If any necessary repair enters sim/product/scenario-authority code, stop.
   Send a structured blocker naming exact files, call paths, suite evidence and
   reason. Systems architecture may then create WM-0179 with that exact scope;
   WM-0179 is neither created nor pre-approved now.
6. Prove the repaired clean-main lineage passes the exact
   `corepack pnpm bench` command against the unchanged baseline, then run every
   WM-0178 required check and submit the real diff and raw evidence to an
   independent reviewer.

Historical artifacts such as `coordination/artifacts/WM-0083/**` must be
restored byte-for-byte after comparison runs. New evidence belongs only under
`coordination/artifacts/WM-0178/**`.

## Repair and resume DAG

```text
WM-0169 done
  -> WM-0178 QA attribution / canonical gate repair
       -> harness-or-environment repair succeeds
            -> independent review -> integrate -> done
       -> exact sim/product files are required
            -> structured block to systems-architect
            -> create exact-scope WM-0179
            -> WM-0179 review -> integrate -> done
            -> unblock WM-0178 -> canonical re-verification
            -> WM-0178 review -> integrate -> done
  -> original simulation-engineer resumes WM-0177 on repaired main
       -> eliminate task-associated deltas
       -> all original required checks, including full bench, pass
       -> independent review -> integrate -> done
  -> unblock and claim WM-0170
```

WM-0177 and WM-0170 remain blocked during every WM-0178 path. A failed full
benchmark, a missing raw sample, a dirty comparison tree, a baseline/threshold
change, a product-file requirement or a waiver request is a stop condition,
not permission to broaden WM-0178.
