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

## 任务配对

- sim 改动：simulation-engineer 实现，qa-performance 补测，reviewer 审查，systems-architect 在公共接口变化时参与。
- UI 改动：client-engineer 实现，gameplay-designer 检查信息设计，reviewer 审查。
- 内容：gameplay-designer 规格，content-worker 填充，qa-performance 验证。
- 架构：systems-architect 提案，simulation/client 评估，reviewer 反驳，project-director 决策。

## 官方能力依据

- https://developers.openai.com/codex/subagents
- https://developers.openai.com/codex/skills
- https://developers.openai.com/codex/learn/best-practices
