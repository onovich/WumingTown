# Codex 多角色执行模型

## 基本模式

保持一个长期 `project-director` 根线程作为控制面；复杂任务显式生成最多 5 个子代理。Codex 当前支持并行 agent threads、项目级自定义 agent TOML、不同模型和推理强度；子代理只有在明确要求时才生成，父线程负责路由后续指令与汇总。

本项目不依赖聊天记忆作为事实源：任务、决定、报告和消息全部写入仓库。线程丢失后，新线程可从文件恢复。

## 并发原则

- 读重任务可并行：探索、文档核验、评审、内容审计、测试分析。
- 写重任务谨慎并行：每个代理独立 Worktree 和模块所有权。
- 最大线程 6、深度 1；禁止递归无限派生。
- 同一时间最多 3 个写任务 + 2 个只读评审/研究，保留根线程协调。
- 任务依赖形成 DAG，只派发 `ready` 且依赖完成的任务。

## 角色

### project-director

维护目标、任务 DAG、范围、跨角色决策和集成节奏。不得成为所有任务的默认实现者。

### systems-architect

公共接口、数据布局、Worker、存档、ADR、性能边界。重大架构先给方案与风险。

### simulation-engineer

固定 Tick、Store、AI、Job、Reservation、路径、健康和导演。负责 Headless 与确定性。

### client-engineer

PixiJS、React、输入、UI Read Model、Electron/Web 平台层和 Playwright。

### gameplay-designer

系统规格、场景、数值假设、玩家可读性、世界观一致性和验收。可修改数据/文档，不擅自改核心架构。

### content-worker

批量 Def、模板、本地化、Schema 适配与内容验证。处理范围明确的高并发任务。

### qa-performance

测试设施、场景、重放、基准、不变量、CI 和性能报告。可以写测试与工具，不修复未分配产品代码。

### reviewer

只读最终评审，关注正确性、架构、性能、存档、测试和范围。不能以风格意见替代真实发现。

### rapid-implementer

快速实现 / Quickhand。使用 `gpt-5.3-codex-spark`，只处理范围小、规格已批准、可自动验证、失败成本低的定点修改。它不是核心能力替代品，不承担架构、协议、存档、Schema、安全、并发所有权、锁定决策或最终评审。详细规则见 `docs/08_codex/08_spark_execution_lane.md`。

## 任务配对

- sim 改动：simulation-engineer 实现，qa-performance 补测，reviewer 审查，systems-architect 在公共接口变化时参与。
- UI 改动：client-engineer 实现，gameplay-designer 检查信息设计，reviewer 审查。
- 内容：gameplay-designer 规格，content-worker 填充，qa-performance 验证。
- 快速小改：project-director 判断任务满足 Spark 分类器后，可拆出 rapid-implementer 子任务；父任务 owner 集成，reviewer 独立审查。
- 架构：systems-architect 提案，simulation/client 评估，reviewer 反驳，project-director 决策。

## Spark 快速通道

`rapid-implementer` 是第 10 个 operational role，但最大线程数仍为 6、深度仍为 1、同时最多 3 个写任务。通常最多保持一个 Spark 写入线程；不得为了消耗额度制造无价值任务。

当 ready backlog 中存在适合 Spark 的任务时，project-director 应优先考虑它。适合条件包括：接口或规格已批准、允许/禁止路径明确、自动验收完整、不触碰架构/存档/协议/并发/安全/锁定决策、默认不超过 8 个文件和约 300 行净变更、不依赖图片或截图理解。任一关键条件不满足时，不能为了节省常规模型额度强行交给 Spark。

Spark 不能直接加入另一个角色的活跃分支。若大任务中存在适合 Spark 的局部工作，先创建明确子任务、独立 worktree/branch 和文件所有权，再由父任务 owner 集成。

## 官方能力依据

- https://developers.openai.com/codex/subagents
- https://developers.openai.com/codex/concepts/subagents
- https://developers.openai.com/codex/models
- https://developers.openai.com/codex/speed
- https://developers.openai.com/codex/skills
- https://developers.openai.com/codex/learn/best-practices
