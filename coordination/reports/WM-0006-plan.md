# WM-0006 Implementation Plan

## Scope

Implement the deterministic headless fixed-tick runner for an empty authoritative simulation. The runner will live in `packages/sim-core` without Node, DOM, wall-clock, or ambient randomness dependencies. Node-specific CLI and benchmark entry points will live outside `sim-core`.

## Steps

1. Add `sim-core` fixed-time constants, seed normalization, command scheduling, pause/speed stepping state, and repeatable empty-world summary/hash.
2. Add focused `sim-core` tests for exact tick counts, repeatability, paused stepping, speed stepping, command ordering, and million-empty-tick bounded output.
3. Add `tools/headless-runner` CLI/library entry point for `pnpm sim:run -- --seed 1 --ticks 1000000`.
4. Add `packages/benchmarks` empty-tick benchmark entry point for `pnpm bench --filter empty-tick`, measuring elapsed time only outside authoritative state.
5. Add minimal root scripts and test filter mapping required by the task.
6. Run required checks, record results in `coordination/reports/WM-0006.md`, and leave `taskctl complete` for project-director as requested.

## Non-goals

- No entity/component store implementation from WM-0007.
- No full RNG stream/world hashing/replay diagnostics from WM-0008.
- No UI, Web, Electron, gameplay, jobs, reservations, pathing, content compiler, or Worker protocol rewrite unless compatibility requires a tiny integration surface.

## Risk Controls

- Keep `sim-core` imports limited to existing allowed public packages.
- Use integer safe-number validation for seeds, ticks, speeds, and command application ticks.
- Avoid per-tick allocation in the empty runner loop.
- Keep CLI/benchmark wall-clock and memory measurement outside `sim-core`.
