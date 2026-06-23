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

每条消息包含 `protocolVersion`, `sessionId`, `sequence`. 不可信输入在边界验证；内部热点不重复 Schema 校验。

## Snapshot

SoA Buffer：entityId、position、spriteDef、animation、facing、flags。主线程只接受 sequence 更新的完整快照；允许跳过旧快照，不允许局部读取正在写的 Buffer。

## UI Detail

大面板按需请求，例如单角色完整思想和案卷图。正常 UiDelta 只包含摘要，避免每 Tick 传整个世界。

## Backpressure

如果主线程消费慢，Worker 覆盖未读表现快照，但保留命令结果、警报和存档响应。指标记录丢弃快照数和消息延迟。

## 协议迁移

变更协议必须更新共享类型、运行时验证、兼容测试和版本。Electron/Web 必须使用同构建协议，不支持跨版本热连接。
