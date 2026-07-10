# WM-0163 - PR-1 GameSession core runtime and initializer scaffold

## 目标

从 `@wuming-town/sim-core` 包根导出一个可由 Worker 和 Node headless 共同持有的
`GameSessionRuntime` 与 PR-1 场景 initializer，使同一 seed、场景与命令流在显式
30 TPS 整数 tick 推进下产生相同的权威世界 hash、只读投影 basis 与守恒诊断。

## 已读上下文

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0163.json`
- `coordination/decisions/ADR-0017.md`
- `docs/05_tech/01_technical_architecture.md`
- `docs/05_tech/12_integrated_gamesession_architecture.md`
- `docs/02_systems/04_ai_jobs_reservations_pathing.md`
- `docs/02_systems/13_save_replay_migration.md`
- 任务列出的 `sim-core` runner、time、entity、map/location、reservation、job、
  WorkOffer/pathing、item/storage、build、needs/environment 与 lamp store API。
- `tools/headless-runner/src/index.ts`、`index.test.ts`、`cli.ts`、tool package
  manifest/tsconfig，以及 blocker `MSG-MREOFL4W-1AAA18`。

## 不做什么

- 不修改 `sim-worker`、`sim-protocol`、`apps/**`、`persistence` 或公共 save/schema。
- 不通配修改 `tools/**`；tool 写范围仅为
  `tools/headless-runner/src/index.ts` 与 `index.test.ts`，不修改 `cli.ts` 或包配置。
- 不把 M1-M8 focused scenario runner 当作产品 runtime，也不复制其整套运行循环。
- 不加入真实时钟、隐藏 scheduler/singleton、`Math.random()`、Promise/coroutine job
  位置、UI 权威或 Pawn 对全图工作实体扫描。
- 不让 `sim-core` 读取 `process.argv`/Node globals，也不以动态注册或 CLI-local
  runtime 绕过包根和权威边界。
- 不承诺公开存档兼容、迁移、发布、遥测、账户或平台能力。

## 当前事实与假设

- 已验证：`TICKS_PER_SECOND = 30`，现有 owner stores 使用整数/typed lanes、结构化
  reason、稳定 id 与显式版本；WorkOffer/Top-K pathing 已提供有界查询面。
- 已验证：`EntityRegistry`、`MapGrid`、`LocationStore`/`SpatialIndex`、
  `ReservationLedger`、`JobCoreStore`、`ItemStackStore`、`StorageLogisticsIndex`、
  `BuildSiteStore`、`NeedStore`、`M3EnvironmentStore` 和 `M4LampNetworkStore` 可组合。
- 设计决定：GameSession 自己拥有 command queue、phase 顺序、basis、metrics 和
  owner-store 实例；派生索引必须公开 owner-version basis 与 rebuild 入口。
- 已复现 blocker：任务要求的 `pr1-integrated-gamesession` 在
  `tools/headless-runner/src/index.ts` 的静态 `--scenario` 白名单被 exit code 1 拒绝，
  尚未调用任何 `sim-core` runner。现有 focused CLI 测试位于同目录 `index.test.ts`。
- 临时假设：PR-1 最小 runtime 只需连接能证明地图、八居民、四资源、库存/仓储、
  床、灯与一个 build site 的 owner facts；更完整的 hauling/rest/medical/social/M4+
  驱动保持未接入并在报告列明。

## 方案

- 新建聚焦的 `game-session*.ts` 模块：定义 scenario facts、runtime owner graph、
  deterministic command entries、phase/metrics、只读 render/UI basis 与 hash summary。
- initializer 以固定稳定顺序创建 64x64 全可通行地图、八居民及其位置/needs、
  food/wood/stone/lamp-oil item stacks 与 storage、床/灯/build-site 实体；所有失败用
  结构化 initializer reason 立即终止，不产生半初始化 runtime。
- tick 采用固定 phase enum 和显式循环：command -> dirty indexes -> indexed work/path
  -> reservations/jobs -> needs/environment/lamp/build -> terminal cleanup -> projection
  -> metrics/hash。正常 tick 只遍历固定 resident lanes、脏队列和有界候选。
- command queue 按 `(tick, sequence)` 稳定排序/应用；hash 输入包含 seed、tick、命令
  tail、owner store 版本/数量和 PR-1 owner facts，不依赖 wall clock 或对象迭代顺序。
- projection builder 每次按稳定 id 构造只读数据并携带 tick/world/read-model、map、
  reservation、job 与 owner-version basis；它不导入协议类型，也不成为 authority。
- `runner.ts` 只增加 headless 对同一 runtime surface 的 PR-1 场景适配/摘要；现有
  headless runner 和历史 scenario 行为保持不变。
- headless tool 的 `index.ts` 只注册精确 alias `pr1-integrated-gamesession`，并调用
  `@wuming-town/sim-core` 包根导出的 PR-1 场景入口；tool 不复制 runtime、tick、
  owner store、command、projection 或 hash 逻辑。`index.test.ts` 验证 dispatch 与未知
  alias 继续失败。

## Blocker 契约修正

- WM-0163 `docs`/`allowedPaths` 精确加入
  `tools/headless-runner/src/index.ts` 和 `index.test.ts`，不加入 `tools/**` 通配。
- focused required check 同步执行 `tools/headless-runner/src/index.test.ts`，使 CLI
  白名单和真实调用路径成为任务内可审计门禁。
- `tools/headless-runner/src/cli.ts` 继续只读取 `process.argv` 并调用包根 tool API；
  本任务不修改它，且该 Node 边界不得下沉到 `sim-core`。
- 正式状态恢复使用 `taskctl unblock`，保留 Tally 的 claim/thread 并恢复
  `in_progress`；不手工改 state、blocker 或伪造历史。

## 风险

- 正确性：多个 store 的创建/占位顺序可能产生 cell occupancy 或 entity handle 冲突；
  initializer 测试逐项验证实体数量、位置、资源和结构化失败。
- 性能：100000 tick 测试会放大 per-tick 分配和全量遍历；热阶段使用预分配 scratch、
  固定八 resident lanes 和脏预算，投影仅按显式调用分配。
- 确定性：Map/Map-object 迭代或命令插入顺序可能漂移；所有 canonical lane 按数字 id
  迭代，并用双 runtime/分段 advance/runner parity hash 测试锁定。
- 存档：本任务不暴露 snapshot/restore 公共契约；只报告未来 save boundary 所需
  owner facts，避免形成兼容承诺。
- 回归：`runner.ts` 是共享面；focused runner tests 和完整 `pnpm quality` 保护 M1-M8。

## 实施步骤

1. 审计 runner CLI/测试、hash/RNG API 和 owner-store constructor 约束，确定最小公开
   类型及 scenario id；输出接口清单和复用表。
2. 实现 ScenarioDefinition、PR-1 initializer 和 owner-store composition；测试 64x64、
   八居民、四资源、storage、床、灯和 build-site 初始化事实。
3. 实现固定 phase runtime、确定性 command queue、pause/speed 状态与显式 advance；
   测试 phase 顺序、同 tick sequence、非法命令结构化拒绝和无 real-clock authority。
4. 实现 canonical world/read-model hash、只读 render/UI basis 和 runtime metrics；测试
   同 seed/命令 parity、不同 command stream divergence 与 projection coherence。
5. 接入 `runner.ts` 的 `pr1-integrated-gamesession` headless surface，并在 tool
   `index.ts` 静态注册同名 alias、由 `index.test.ts` 验证；保持历史 runner 不变，
   运行 focused tests 与 18000 tick CLI 场景。
6. 增加 100000 tick conservation/leak 测试，验证 jobs、reservations、command/path/
   dirty queues 和 food/wood/stone/lamp-oil 总量，并在首个 divergence 输出结构化诊断。
7. 执行任务全部门禁，修复范围内问题，写 `WM-0163.md`，仅提交 allowedPaths，
   `taskctl complete` 交 systems-architect，停在 `review_requested`。

## 测试与基准

- `corepack pnpm typecheck`
- 任务指定的 focused Vitest 集合（含 `game-session.test.ts`）。
- `tools/headless-runner/src/index.test.ts` 的 alias/dispatch/unknown-scenario 测试。
- `corepack pnpm sim:run -- --seed 5 --scenario pr1-integrated-gamesession --ticks 18000`
- 100000 tick conservation/leak focused test，记录队列峰值、owner counts 和 hashes。
- `node tools/validate-handoff.mjs`
- `taskctl validate` / `taskctl status`
- `git diff --check`
- `corepack pnpm quality`

## 回滚

回滚 `game-session*.ts`、sim-core `runner.ts`/测试与包根导出，再移除 headless tool
`index.ts`/`index.test.ts` 的精确 alias 即可恢复历史 headless/scenario 行为；没有
协议、Web、persistence 或公共 save/schema 迁移需要撤回。

## 完成条件

- 包根可创建同一 `GameSessionRuntime` 并通过显式 tick 在 headless/未来 Worker 使用。
- owner graph、64x64/八居民/资源/设施/build 初始化和版本化派生 basis 满足 task
  acceptance，且不调用历史 scenario runner 作为 runtime。
- 固定 30 TPS phase、command ordering、world/read-model hash 与 projection basis 有测试。
- 100000 tick 无 job/reservation/queue/resource leak，并提供首 divergence 诊断。
- M1-M8 focused regression 不变；报告列全量复用 store、adapted facts 与未接入能力。
- headless tool 仅调用 sim-core 包根场景，focused test 与 18000 tick CLI 命令通过。
- 所有 requiredChecks 通过，任务提交后仅进入 systems-architect `review_requested`。
