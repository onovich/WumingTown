# WM-0005 Execution Plan

## Scope

- Define the public simulation Worker protocol in `packages/sim-protocol`.
- Add runtime validation for untrusted main-to-worker messages at the boundary.
- Implement a minimal authoritative Worker spike in `packages/sim-worker` that owns lifecycle state and emits structured responses.
- Add focused protocol and Worker smoke tests proving Node harness and browser-worker-compatible round trip behavior.
- Update `docs/05_tech/02_worker_protocol.md` with the concrete version fields, envelopes, and reason codes introduced by the spike.

## Non-goals

- No gameplay simulation, map, entity store, RNG/world hash, fixed-tick runner, save format, content compiler, UI, Pixi, Electron, or WM-0006 headless runner implementation.
- No Spark and no subagents.
- No `taskctl complete`; project-director will handle completion after owner review.

## Implementation Steps

1. Replace the `sim-protocol` smoke-only public API with typed message kinds, version constants, envelopes, payload contracts, structured reason codes, and a pure `validateMainToSimulationMessage` boundary validator.
2. Replace the `sim-worker` smoke-only public API with a small session state machine that accepts validated messages, rejects invalid/stale/lifecycle-unsafe commands, and emits `Ready`, `CommandResult`, `RenderSnapshot`, `UiDelta`, `MetricsSample`, and error envelopes.
3. Add tests under `packages/sim-protocol/src` for accepted messages and version/session/sequence/payload rejection.
4. Add tests under `packages/sim-worker/src` for Node harness routing and a browser-style Worker port adapter.
5. Add minimal root test scripts only if needed to run the task-specific checks cleanly.
6. Run all required checks and record results in `coordination/reports/WM-0005.md`.

## Review Focus

- Main thread can only submit commands; all authoritative session mutation is inside `sim-worker`.
- Every public message carries `protocolVersion`, `schemaVersion`, `sessionId`, and `sequence`.
- Unknown/stale/invalid inputs produce stable structured reason codes.
- Tests exercise both direct Node harness dispatch and Worker-compatible message-port dispatch.
