# WM-0164 — PR-1 projection protocol and continuous Simulation Worker session

## 目标

从 `@wuming-town/sim-protocol` 包根公开 schema-v3 GameSession projection v1，
并让真实 Browser Simulation Worker 长期托管 WM-0163 `GameSessionRuntime`，在不依赖
UI advance/drain helper 的情况下按 pause/speed 策略持续推进和发布权威 projection。

## 已读上下文

- `AGENTS.md`、Wuming workflow、`PLANS.md`、WM-0164 task packet。
- `ADR-0017`、Worker protocol、integrated GameSession architecture。
- sim-protocol constants/types/envelope/payload validation、public root 和既有协议测试。
- sim-worker public root、同步 Worker 状态机、browser session/entry、playable drain、
  browser Worker smoke 与历史 parity tests。
- sim-core package root、`GameSessionRuntime`、runner 和 WM-0163 projection/hash surface。

## 不做什么

- 不新增 Worker message family、projection v2 或 command contract。
- 不修改 apps/web production source、产品路由、Web/Pixi/React/Electron UI、sim-core
  authority 或 persistence/save schema。唯一允许的 apps 路径是
  `apps/web/src/simulation-worker-session.test.ts`，且只可把消费端断言/fixture 从
  schema 2 更新到 schema 3，并在涉及协商时使用 GameSession-compatible negotiated
  fixture。
- 不把 WM-0160 advance/drain helper、summary/debug payload 或 UI state作为默认时钟/权威。
- 不承诺公共存档兼容；GameSession save/load 在没有 focused snapshot 时结构化 fail closed。
- 不改变历史 M0-M8/WM-0150 regression runtime 的产品资格。

## 当前事实与假设

- envelope `protocolVersion` 保持 1；`SIM_SCHEMA_VERSION` 当前为 2，需唯一升级到 3。
- task 批准的三份 GameSession projection 文件当前不存在，必须新建并从包根导出。
- `GameSessionRuntime` 已从 sim-core 包根公开 integer tick、pause/speed、hash 和 projection。
- Dedicated Worker port 目前只处理输入时同步回包，没有持续 scheduler 或可审计 outbox。
- 采用 100ms Worker 量子，每量子分别推进 3/6/9 integer ticks，可精确表达
  30/60/90 TPS；pause 或 speed 0 推进 0。该 timer 只存在于 sim-worker。

## 方案

1. 在协议层定义 projection request/contract、shared basis、render rows、UI residents/
   resources/job markers/alerts/selection detail，并增加严格 unknown-input validators。
2. `InitSession.projectionRequest` 可选；GameSession 路线只接受 `{kind:"game_session",
version:1}`，`Ready` 必须回显。schema 2、未知版本、缺 payload、 malformed row 和
   incoherent basis 均返回结构化 rejection。
3. 新建 GameSession Worker host，从 sim-core package root 初始化 runtime、映射 core
   render/UI projection、处理 Noop/Echo command、pause/speed/detail，并让 save/load 在
   未定义 focused snapshot 时 fail closed。
4. 新建 scheduler/outbox：scheduler 只向 core 传 integer ticks；outbox 对 Render/UI/
   Metrics latest-wins，对 CommandResult/AlertBatch/SaveReady/Fatal FIFO reliable，并记录
   dropped/queued 指标。SetSpeed 仅改变未来量子，Pause 保留 requested speed。
5. browser session 记录协商合同和有限 basis validation state；新鲜 malformed/incoherent
   消息合成结构化 fatal、关闭 Worker，不回退 legacy fixture；较低 stale render 可丢弃。
6. 真实 Chromium smoke 初始化 GameSession 后只等待 timer projection，证明 tick/hash/
   snapshot sequence 自行前进。Node test 使用同 seed/command stream 显式推进相同 ticks，
   比较 checkpoint world/read-model hash。

## 风险

- 协议兼容：schema 3 会有意拒绝 schema 2；历史 same-build tests 必须统一使用常量。
- 时序：浏览器 timer 有 wall-time jitter，因此验证 TPS 采用量子策略/范围而非毫秒精确值；
  core tick 与 hash 仍由 integer advancement 决定。
- 背压：浏览器 `postMessage` 无消费 ACK；latest-wins 通过独立可测试 outbox 语义证明，
  port 正常情况下即时 flush，不伪造浏览器 ACK。
- 命令：WM-0163 GameSession 仅有 deterministic noop queue；typed WM-0150 gameplay
  command 不在本任务扩展，GameSession 路线必须结构化拒绝而非复制旧 runtime。
- 存档：缺少完整 owner snapshot；默认实现选择 fail-closed，不生成伪 SaveReady。

## 实施步骤

1. 新增 protocol types/validators/exports，补 schema-v2、unknown version、payload/row/basis
   fail-closed 单测。
2. 新增 core-to-protocol mapper、GameSession Worker host、scheduler 和 outbox focused tests。
3. 最小接入现有 Worker state/port 和 browser entry，保留 legacy regression 行为。
4. 强化 browser session negotiated validation/fatal lifecycle，并补单测覆盖。
5. 扩展 Chromium worker smoke 和 Node parity；确认不发送 advance helper 命令。
6. 仅更新 `apps/web/src/simulation-worker-session.test.ts` 的 schema-v3 消费端测试
   fixture；不得修改相邻 production adapter、产品路由或 UI。
7. 更新 Worker protocol 文档与 WM-0164 report，运行全部 required checks。

## 测试与基准

- task 指定的两组 focused Vitest。
- `corepack pnpm exec vitest run apps/web/src/simulation-worker-session.test.ts`，证明
  Web 薄适配测试使用 schema 3，且 negotiated GameSession fixture 与 fail-closed 合同一致。
- Chromium `worker-smoke`，验证自动递增 tick/snapshot/hash。
- Node parity：相同 seed、scenario、Noop command stream、checkpoint tick 的双 hash 一致。
- scheduler fake clock：speed 0/1/2/3、pause preserve speed、future-only speed change。
- outbox：多 projection 替换、reliable FIFO、不因 pause/backpressure 丢失。
- 18000 tick headless、boundaries、handoff、taskctl、diff check、完整 `pnpm quality`。

## 回滚

整组回滚 schema-v3 projection、GameSession host/scheduler 和 browser negotiation；历史
regression Worker 仍可留在同构 schema build。不得以 schema 2/3 down-conversion、静态 fixture
或 drain helper 时钟作为回滚桥。

## 完成条件

- ADR-0017 精确 schema/projection 合同从公共根导出且严格 fail closed。
- Worker timer 达到 0/30/60/90 TPS 策略，pause/speed/reliable/backpressure 证据完整。
- Browser Worker 无 UI advance helper 仍发布持续增长、basis coherent 的 projections。
- Worker/headless checkpoint hashes 一致，save/load stance 明确且无公共兼容承诺。
- 所有 required checks 通过，报告完成，提交后 `taskctl complete` 至 systems-architect，
  状态停在 `review_requested`。
