# AGENTS.md — 《无明镇》仓库强制规则

本文件自动进入 Codex 上下文。执行前还必须读取任务指定的系统文档。

## 最高优先级

1. 权威模拟只存在于 `Simulation Worker` / Headless 运行时；UI、Pixi、Electron 不得直接改世界。
2. `sim-core` 禁止依赖 DOM、React、PixiJS、Electron、Node 文件系统或真实时钟。
3. 模拟使用固定 30 TPS、种子随机流、稳定迭代顺序和整数/定点语义。
4. 禁止角色思考时扫描全地图；必须使用空间索引、工作供给索引和 Top-K 候选。
5. 禁止以 Coroutine、Promise 链或隐式闭包保存 Job 执行位置；Job 必须是显式可序列化状态机。
6. 所有关键失败必须生成结构化原因；“没工作”“路径失败”“条件不满足”不是足够的结果。
7. 热路径禁止每实体每 Tick 分配对象、数组、闭包或字符串。
8. 未运行要求的测试、基准和自审，不得标记任务完成。
9. 禁止越过包边界导入内部文件；只从包公开入口导入。
10. 同一代理不得同时担任实现者与最终评审者。

## 必读索引

- 设计：`docs/01_design/`
- 系统：`docs/02_systems/`
- 世界观：`docs/03_world/`
- 数值内容：`docs/04_content_balance/`
- 技术：`docs/05_tech/`
- 工程规范：`docs/06_engineering/`
- 路线图：`docs/07_roadmap/`
- 多代理：`docs/08_codex/`

## 任务工作流

每次开始工作：

```bash
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs claim --id <TASK> --agent <ROLE>
```

完成前：

1. 运行任务要求的测试。
2. 更新文档和变更日志。
3. 写 `coordination/reports/<TASK>.md`。
4. 运行 `taskctl complete`，向评审角色发消息。
5. 等待独立评审；不得自行把状态改为 `done`。

## TypeScript 强制规则

- `strict: true`，并启用 `noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`useUnknownInCatchVariables`。
- 禁止 `any`；外部不可信数据先是 `unknown`，经显式验证后使用。
- 禁止默认导出；禁止 barrel 循环依赖。
- 禁止在模拟核心中调用 `Math.random()`、`Date.now()`、`performance.now()`。
- 禁止权威状态使用浮点概率累积；使用整数或明确比例尺。
- 禁止在热循环使用 `map/filter/reduce/flatMap`、无界 `sort`、正则和字符串拼接。
- 禁止以对象引用作为持久实体身份；使用 `EntityId(index,generation)`。
- 禁止滥用非空断言 `!` 和类型断言 `as`；例外必须邻近注释说明不变量。
- 单文件超过 400 行、函数超过 60 行或复杂度超过 10，应拆分或在评审中解释。

## 依赖与安全

- 新运行时依赖必须提交 ADR，说明替代方案、包体、维护、安全与浏览器兼容。
- 依赖版本必须锁定；禁止 `*`、`latest`、未锁 Git 分支。
- Electron 渲染进程：`nodeIntegration=false`、`contextIsolation=true`、`sandbox=true`。
- Preload 只暴露白名单 API；禁止暴露通用 `fs`、`shell` 或任意 IPC。
- 数据模组必须 Schema 校验；首发禁止任意代码模组。

## 完成标准

“完成”至少意味着：行为符合验收、类型检查通过、相关测试通过、无已知不变量破坏、性能预算未回退、文档同步、评审通过、任务消息已发送。详见 `docs/06_engineering/03_definition_of_done.md`。
