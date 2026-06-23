# Spark 快速执行通道

本文件来自 `OWNER-AMENDMENT-2026-06-23-SPARK-LANE`，是对原始交接控制面的增量修正。原始交接包仍然记录 9 个初始角色；当前 operational role count 为 10。

## 角色

新增逻辑角色：

- id: `rapid-implementer`
- nickname: `Quickhand`
- model: `gpt-5.3-codex-spark`
- effort: `medium`
- sandbox: `workspace-write`

`rapid-implementer` 是按需生成、完成后可关闭的临时快速实现线程，不是核心角色能力的替代品。最大同时活跃线程仍为 6，同时最多 3 个写入型任务。

## 官方依据

本策略只引用 OpenAI 官方资料：

- Codex Models: `https://developers.openai.com/codex/models`
- Codex Speed: `https://developers.openai.com/codex/speed`
- Codex Subagents: `https://developers.openai.com/codex/subagents`
- Subagent Concepts: `https://developers.openai.com/codex/concepts/subagents`
- GPT-5.3-Codex-Spark announcement: `https://openai.com/index/introducing-gpt-5-3-codex-spark/`

项目采用如下解释：

- `gpt-5.5` 仍是复杂编码、研究、长上下文和高风险判断的默认强模型。
- `gpt-5.4-mini` 仍适合轻量、读取型、支持型子代理和大批量结构化辅助任务。
- `gpt-5.3-codex-spark` 是独立、快速、能力较弱、text-only 的 research preview 模型，适合定点修改和快速迭代。
- Spark 的默认工作风格轻量，不会自动替代测试要求；项目任务必须显式要求并记录测试。

## 适合 Spark 的任务

只有同时满足以下条件时，project-director 可以考虑派发给 `rapid-implementer`：

1. 已有批准的规格或接口。
2. 只涉及一个局部模块、一个 package 或一个明确功能切片。
3. 可以列出允许路径和禁止路径。
4. 有完整自动化验收。
5. 不涉及架构、存档、协议、并发、安全或锁定决策。
6. 默认控制在 8 个修改文件和约 300 行净变更以内。
7. 不依赖图片、截图理解或视觉审美判断。

典型适用项：

- 单个 TypeScript 类型错误。
- lint 或格式修复。
- 已批准接口的局部实现。
- 小型测试补充。
- fixture。
- JSON5 Def。
- 本地化键。
- 机械性重命名。
- 小型 React/Pixi 局部修改。
- 明确的 UI 样式参数调整。
- 文档/API 示例同步。
- 小范围重复性内容生产。

## 不适合 Spark 的任务

不得把以下任务交给 `rapid-implementer`：

- 模拟核心首次设计。
- Tick、Job、Reservation、存档和确定性架构。
- Worker 协议、公用协议、Schema、安全边界或并发所有权变更。
- 隐蔽并发 Bug。
- 多模块迁移或跨多个 package 的重大重构。
- 技术选型、架构决策、产品方向或锁定决策变更。
- ADR 最终决策。
- 最终评审。
- 模糊需求。
- 需要视觉截图判断、图片理解或审美判断的任务。

## 调度规则

- Spark 写任务必须有自己的 `coordination/tasks/<ID>.json`，或被父任务 owner 明确拆为可审计子任务。
- Spark 不直接加入另一个角色的活跃分支。如果大任务有适合 Spark 的局部工作，先创建明确子任务、独立 worktree/branch 和文件所有权，再由父任务 owner 集成。
- 通常最多保持一个 Spark 写入线程。
- Spark 仍受最大 6 线程和最多 3 个写任务限制。
- 当 ready backlog 有适合 Spark 的任务时，project-director 应优先考虑 Spark，但不得为了消耗额度制造无价值任务。
- Spark 输出仍需 `reviewer` 独立审查；`reviewer` 不得使用 Spark 作为最终评审模型。

## 回退

如果 Spark 不可用、排队、账号无访问权限或当前 Codex 会话无法动态发现该 agent：

1. 不得伪称已经使用 Spark。
2. 在任务报告中记录 `rapid-implementer unavailable`。
3. 明确回退到 `gpt-5.4-mini` 或重新分配给原 owner 角色。
4. 记录实际执行模型和原因。
5. 不因此回滚本控制面修正。

## 完成报告要求

`rapid-implementer` 的完成报告必须记录：

- 实际使用模型。
- 修改文件。
- 执行命令。
- 测试结果。
- 未解决风险。
- 是否触碰默认规模上限。
