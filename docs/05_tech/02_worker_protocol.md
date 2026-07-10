# Worker 协议

## 设计目标

版本化、可验证、批量、低分配、允许主线程落后、允许未来 SharedArrayBuffer。

## 消息族

### Main → Simulation

- `InitSession`
- `LoadSession`
- `PlayerCommandBatch`
- `SetSpeed`
- `Pause`
- `RequestUiDetail`
- `RequestSave`
- `DevCommand`
- `Shutdown`

## WM-0028 implementation note

`packages/sim-worker` now has a focused M1 parity mode for
`m1.hauling_building.road_lantern_frame.v1`. The mode is selected by
`InitSession.catalogVersion` and still runs inside the Simulation Worker or
Node worker harness; UI and renderer consumers receive read-only projection
payloads only.

M1 parity command streams use existing `PlayerCommandBatch` messages with
deterministic no-op command ids such as
`m1.hauling-building.advance.100000`. Worker `RenderSnapshot`, `UiDelta`,
`MetricsSample` and `SaveReady` payloads may include optional scenario id,
world hash, read-model hash and read-only flags. Existing M0 protocol messages
remain valid.

## WM-0089 SharedArrayBuffer fallback note

The M6 Web product gate does not require SharedArrayBuffer for correctness.
When the browser is not cross-origin isolated, or when `SharedArrayBuffer` is
otherwise unavailable, the Worker transport remains the existing
structured-clone / Transferable snapshot path. Authority stays inside the
Simulation Worker or headless runtime; `RenderSnapshot` and `UiDelta` remain
read-only projection payloads for UI and renderer consumers.

WM-0089 adds a local Worker transport gate helper and browser Worker smoke
evidence for the non-isolated Chromium path. It does not add a new message
family, protocol version, schema version or compatibility mode. SAB may be used
by a future optimized transport only after separate evidence and review.

## WM-0149 playable command/job contract note

`coordination/decisions/ADR-0012.md` proposes the first authoritative
player-command contract for the post-M8 dusk lamp / simple-build slice. The
existing message families remain the intended route: `PlayerCommandBatch`
carries typed player intent, and `CommandResult` carries batch plus per-command
results. Implementation must bump the schema before adding the incompatible
payload shapes.

The slice must keep Simulation Worker or Node headless as the only world
writer. React, Pixi and Electron may build commands from read-model basis data
and render read-only projections only. They may not create jobs, reserve
materials, move pawns, complete builds, repair stale command basis, or invent
blocked reasons.

Required structured blocked reason classes for the slice are:

- `missing_resource`
- `no_path`
- `no_worker`
- `invalid_target`
- `stale_command`
- `rule_policy_denial`

Playable read models must project target action availability, order/job
markers, pawn state, progress, resources/alerts and basis versions from
authoritative owner stores. Localized prose is rendered by the UI from reason
codes and parameters, not emitted as authority by simulation code.

### Simulation → Main

- `Ready`
- `RenderSnapshot`
- `UiDelta`
- `CommandResult`
- `AlertBatch`
- `SaveReady`
- `MetricsSample`
- `FatalSimulationError`

每条消息包含 `protocolVersion`, `schemaVersion`, `sessionId`, `sequence`. 不可信输入在 Worker 边界验证；内部热点不重复 Schema 校验。

M0 spike 固定：

- `protocolVersion = 1`
- `schemaVersion = 1`
- `sequence` 为主线程和 Worker 各自递增的正整数流。Worker 对每个 session 记录已处理的主线程 sequence，旧 sequence 必须拒绝。
- `sessionId` 在 `InitSession` / `LoadSession` 后由 Worker 绑定；后续不同 session 的消息必须拒绝。

## 结构化失败

边界或生命周期失败必须返回 `CommandResult` 或 `FatalSimulationError` 携带结构化 `reason`，不得只返回字符串。M0 spike 定义以下 reason code：

- `UnsupportedProtocolVersion`
- `UnsupportedSchemaVersion`
- `UnknownMessageKind`
- `UnknownCommandKind`
- `StaleSequence`
- `StaleSession`
- `InvalidPayload`
- `LifecycleError`

未知消息族在 payload 分发前拒绝；未知玩家命令或开发命令以 `UnknownCommandKind` 拒绝；版本不兼容时不尝试兼容热连接。

## M0 Worker Spike

`packages/sim-protocol` 暴露 typed envelopes 与 `validateMainToSimulationMessage`。`packages/sim-worker` 暴露最小权威 session 状态机和 Worker-compatible port adapter。该 spike 只证明路由、版本/Schema 校验、session/sequence 拒绝和 round-trip；不实现地图、实体 Store、真实 Tick、存档格式或玩法规则。

## Snapshot

SoA Buffer：entityId、position、spriteDef、animation、facing、flags。主线程只接受 sequence 更新的完整快照；允许跳过旧快照，不允许局部读取正在写的 Buffer。

## UI Detail

大面板按需请求，例如单角色完整思想和案卷图。正常 UiDelta 只包含摘要，避免每 Tick 传整个世界。

## Backpressure

如果主线程消费慢，Worker 覆盖未读表现快照，但保留命令结果、警报和存档响应。指标记录丢弃快照数和消息延迟。

## 协议迁移

变更协议必须更新共享类型、运行时验证、兼容测试和版本。Electron/Web 必须使用同构建协议，不支持跨版本热连接。

## WM-0162 PR-1 GameSession scheduling note

ADR-0017 keeps the existing message families for PR-1:
`InitSession`/`LoadSession`, `PlayerCommandBatch`, `SetSpeed`, `Pause`,
`RequestUiDetail`, `RequestSave` and `Shutdown`. The PR-1 `GameSession`
implementation hosts a continuously scheduled fixed-30-TPS runtime behind
those families.

The current schema-v2 `RenderSnapshotPayload` and `UiDeltaPayload` are not
sufficient for the integrated product route: they do not jointly represent
authoritative render positions, eight resident summaries, resource counts,
day/night state, structured alerts and requested selection detail. ADR-0017
therefore approves exactly one WM-0164 protocol change:

- keep `protocolVersion = 1` and existing message kinds;
- bump envelope `schemaVersion` from 2 to 3;
- add `GAME_SESSION_PROJECTION_VERSION = 1`;
- let `InitSession` optionally request
  `{ kind: "game_session", version: 1 }` and require `Ready` to echo it;
- add versioned `RenderSnapshot.gameSession` and `UiDelta.gameSession` payloads
  with a coherent tick/snapshot/world/content/map basis;
- add protocol-level runtime validation and tests for negotiation, render/UI
  shape and failure closure.

The render projection carries stable entity refs plus resident/resource/
structure/lamp/build-site render kind, numeric render def, authoritative Q16
position, facing, animation and flags. The UI projection carries pause/speed,
day phase, resident/job summaries, food/wood/stone/lamp-oil quantities,
structured alerts and the latest requested selection detail. Localized prose,
camera/hover/selected-id state and interpolation remain client-local.

GameSession clients must fail closed on schema or projection mismatch, missing
negotiated payloads, malformed rows or incoherent basis and must never fall back
to the static product fixture. Lower stale render sequences may still be
dropped under latest-wins backpressure. Legacy M0-M8 modes may omit the
projection request for same-build regression use, but cannot back the default
PR-1 product route. Mixed schema-v2/schema-v3 hot connections and
down-conversion are unsupported.

WM-0164 is the sole writer for the exact `packages/sim-protocol` files named in
`docs/05_tech/12_integrated_gamesession_architecture.md`. WM-0163, WM-0165 and
WM-0166 consume the package public root only. Any new message family,
projection v2, command-contract change or public save payload still requires a
separate reviewed ADR.

Normal product time is owned by the Simulation Worker scheduler. The WM-0160
explicit advance/drain helpers remain valid for tests, tools and command waits,
but they are not the default game clock.
