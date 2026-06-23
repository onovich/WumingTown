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
