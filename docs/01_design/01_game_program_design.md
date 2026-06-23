# 游戏程序设计文档

## 1. 运行模式

- 权威模拟：30 TPS 固定时间，支持暂停、1×、3×、6×。
- 表现：目标 60 FPS，通过两个模拟快照插值，不影响规则结果。
- Headless：同一 `sim-core` 可在 Node 中无渲染运行。
- 浏览器：Simulation Worker 执行模拟，主线程运行 PixiJS 与 React。
- Electron：使用相同 Renderer/Worker 代码，主进程只负责平台服务。

## 2. 世界结构

```text
GameSession
├─ ContentCatalog
├─ WorldState
│  ├─ Maps[]
│  ├─ EntityRegistry
│  ├─ ComponentStores
│  ├─ RelationGraph
│  ├─ ChronicleState
│  ├─ ObligationLedger
│  └─ StoryState
├─ TickScheduler
├─ RandomStreams
├─ Indexes
├─ DirtyQueues
└─ DomainEventBuffer
```

MVP 只有一张高频地图。世界外派系以汇总状态存在，不做第二张地图的完整实时角色模拟。

## 3. Tick 阶段

```text
1. ApplyPlayerCommands
2. ExpireLeasesAndReservations
3. ProcessSpatialDirtyQueues
4. AcceptAsyncKernelResults
5. MovementAndCombat
6. JobDrivers
7. HashedNeedsHealthMood
8. WorkOfferMaintenanceAndThink
9. DomainConsequences
10. StoryDirector
11. CommitStructuralChanges
12. BuildRenderSnapshotAndUiDelta
13. OptionalWorldHashAndAutosaveSnapshot
```

阶段之间只通过明确 Buffer 交接；禁止事件回调递归修改世界。

## 4. 命令、事实与表现

- `PlayerCommand`：玩家意图，Tick 边界验证与执行。
- `WorldCommand`：系统申请的结构变化，阶段末提交。
- `DomainEvent`：已经发生的事实，后续系统按规定阶段消费。
- `RenderSnapshot`：位置、图像、动画、状态标记等只读数据。
- `UiDelta`：面板所需的结构化变化，不包含完整世界。

## 5. 数据保存层次

### 必须保存

实体、组件原始状态、Job 步骤、Reservation、随机流、镇志证据、债务、导演历史、玩家制度和版本信息。

### 加载后重建

路径、房间缓存、空间索引、UI Read Model、渲染代理、可达性、派生能力和大部分统计聚合。

## 6. 可解释性

所有决策接口返回结果对象而不是布尔值：

```ts
type DecisionResult<T> =
  | { ok: true; value: T; reasons: ReasonCode[] }
  | { ok: false; reasons: ReasonCode[] };
```

工作搜索、路径、订单、镇规、证据与事件选择都要能生成稳定 `ReasonCode` 和参数，文本只在 UI 层本地化。

## 7. 扩展边界

内容定义可以增加物品、建筑、配方、思想、条件、异类规则和事件。新增核心行为必须通过注册表或明确系统接口，不允许中央文件不断增长 `switch`。

## 8. 安全降级

- Web 无 SharedArrayBuffer：使用 Transferable Snapshot，降低快进上限。
- WebGPU 不可用：WebGL2。
- Kernel Worker 超时：当前请求失败并重排，不允许写半成品状态。
- 内容缺失：加载报告列出替代 Def，不静默删除关键实体。
