# WM-0008 Plan

## Scope

- Add a deterministic named RNG stream facility in `packages/sim-core`.
- Add serializable and restorable stream state to the headless runner snapshot surface.
- Add canonical world hashing that is built from explicit simulation fields in stable key order and excludes presentation-only state.
- Add replay checkpoint comparison diagnostics that report the first divergent checkpoint.
- Add the literal command paths required by the task: `pnpm test --filter determinism` and `pnpm sim:replay-test`.

## Design Choices

- Use a small integer PRNG with explicit stream names and no ambient/global random API. Consumers must request values from a named stream through a registry.
- Derive each stream from the root seed and stream name, then persist the stream's current state and draw count. Restores validate and rebuild streams from serialized values only.
- Compute world hash from a canonical record writer that sorts named fields and stream snapshots by name. The runner will hash authoritative state: seed hash, tick, speed, paused state, command cursor/count/hash, queued commands, and RNG stream states.
- Treat UI/presentation data as absent from the canonical hash contract. Tests will prove additional presentation-shaped objects do not affect the hash.
- Implement replay diagnostics as pure `sim-core` functions that compare checkpoint arrays in order and return a structured first-divergence reason. The CLI script will deliberately perturb one checkpoint to exercise the diagnostic path.

## Verification Plan

- Unit tests under a determinism filter will cover explicit named stream use, serialize/restore continuity, canonical hash stability against object ordering/presentation state, and first divergent checkpoint reporting.
- `pnpm sim:replay-test` will run a deterministic replay probe and a deliberately perturbed replay probe, failing unless the perturbation reports the expected first divergent checkpoint.
- Owner gate before final response: install, format check, typecheck, determinism tests, replay test, lint, content validation, boundary check, handoff validation, taskctl validate, and `git diff --check`.

## Boundaries

- No Spark for this task.
- No filesystem, DOM, React, Pixi, Electron, real time, `Math.random`, `Date.now`, `performance.now`, global random streams, object identity, async/promises, or insertion-order-dependent simulation logic inside `sim-core`.
- Do not run `taskctl complete`; final advancement is reserved for project-director.
