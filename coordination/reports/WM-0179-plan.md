# WM-0179 Plan — Entity-store structural command ordering repair

## Status and authority

WM-0179 is the systems-architect-authorized conditional product repair created
from the structured WM-0178 quiet-host blocker at evidence commit `0b89918`.
It is a `simulation-engineer` task with an independent `reviewer`; Spark is
prohibited. WM-0178, WM-0177 and WM-0170 remain blocked and must not be edited
or resumed by this worker.

The immutable canonical facts are:

- baseline median `244.507 ms`;
- warning/failure thresholds `10%` / `20%`;
- default `9` samples and `2` warmups;
- workload capacity `8192` and checksum `134209536`;
- no benchmark, baseline, invariant, harness or retry-policy change.

## Evidence and smallest repair boundary

The single authorized quiet-host full run passed admission at `24.41%` and
`22.53%` normalized host load and left only `entity-store` failing:
`355.852 ms`, `+45.54%`, with every invariant matching. M3, M4, M5 and
`spatial-index` passed; `map-dirty` warned without failing.

The benchmark queues `8192` `set-i32` commands in descending entity-index
order. `StructuralCommandBuffer.orderQueuedSlots` currently uses insertion
sorting by priority, index and sequence. For this exact reverse-index workload,
that ordering performs up to `33,550,336` inversion-dependent comparisons and
slot shifts. This is the smallest source-backed repair boundary inside the
reported call chain.

The product scope is therefore limited to:

1. `structural-commands.ts` for integration with a reusable ordering helper;
2. a new internal `structural-command-order.ts` so the existing 398-line owner
   does not cross the repository's 400-line file limit;
3. `entity-store.invariants.test.ts` for semantic and reuse coverage.

`entity-id.ts` and `component-store.ts` are deliberately forbidden. If the
structural repair is insufficient, the task blocks with new evidence instead
of expanding into those files.

## Implementation procedure

1. Record the existing priority/index/sequence ordering contract, including
   mixed command kinds, signed stored indexes, equal-index insertion order and
   buffer reuse across consecutive commits.
2. Replace inversion-dependent insertion shifting with a fixed-pass,
   deterministic ordering algorithm over constructor-owned typed scratch and
   bounded bucket storage. Stable radix/counting passes are acceptable; native
   `Array.sort`, data-dependent unbounded comparison sorting and hot allocation
   are not.
3. Preserve every queue/commit result, structured reason, result ordinal,
   component mutation and entity generation/reuse behavior. Add focused tests
   for reverse indexes, mixed priorities, repeated keys, invalid stored indexes,
   capacity and consecutive reuse.
4. Run typecheck, focused tests and the three deterministic 100000-tick
   scenarios before performance admission.
5. Measure two consecutive six-second windows using only cumulative
   `Get-Process` CPU deltas normalized by 16 logical processors. Both must be
   at most 40% host busy, the largest process at most 8%, `ACShadows` absent,
   no active benchmark Node and git clean. Do not use Get-Counter, CIM or WMI.
6. Run `corepack pnpm bench --filter entity-store` exactly once. Its median must
   be at most `293.4084 ms`, every invariant must match and the artifact/hash
   must be stored only under `coordination/artifacts/WM-0179/**`. A failure is
   a blocker, not permission to warm up, tune and retry.
7. Run the remaining repository checks, write the work report and request
   independent review through `taskctl complete`.

## Review and return to WM-0178

The reviewer must verify algorithmic boundedness, scratch ownership, exact
ordering parity, the one-run performance policy, allowed paths and all required
checks. WM-0179 may be integrated and marked done only after that independent
verification.

The project director then refreshes the existing WM-0178 branch from repaired
main, preserving and auditing its harness/evidence diff. Systems architecture
may unblock the original `qa-performance` owner only after WM-0179 is done.
WM-0178 must then pass its six explicit filters and exact full canonical gate
without retry or waiver, complete independent review, integrate and close.
Only then may WM-0177 resume; WM-0170 remains blocked behind WM-0177.

```text
WM-0169 done
  -> WM-0179 structural ordering repair
       -> independent review -> integrate -> done on main
  -> unblock/resume WM-0178 on repaired main + isolated harness
       -> six filters + full canonical gate -> review -> integrate -> done
  -> resume WM-0177 paired attribution and owner-surface repair
       -> review -> integrate -> done
  -> unblock WM-0170
```

## Stop lines

Stop and block on any need to edit `entity-id.ts`, `component-store.ts`, a
benchmark/baseline, public exports, save/protocol/Worker/GameSession surfaces,
dependencies or a fourth product/test file. Also stop on invariant drift,
ordering drift, a dirty admission tree, a failed single performance run, a
missing artifact hash or any proposal to weaken, waive or retry the gate.
