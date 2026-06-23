# 模型与推理强度分配

基线使用 2026-06 Codex 推荐模型。模型名可能变化；升级时修改 agent TOML 并验证任务质量。

| 角色 | 模型 | Effort | 原因 |
|---|---|---|---|
| project-director | gpt-5.5 | xhigh | 长上下文、规划、冲突判断、跨文档一致性。 |
| systems-architect | gpt-5.5 | xhigh | 高风险架构、并发、存档和性能权衡。 |
| simulation-engineer | gpt-5.5 | high | 复杂状态机、不变量和算法实现。 |
| client-engineer | gpt-5.4 | high | 强编码与工具能力，成本/速度更适合迭代 UI。 |
| gameplay-designer | gpt-5.5 | high | 需要系统叙事、文档与长程一致性。 |
| content-worker | gpt-5.4-mini | medium | 结构化、重复、Schema 驱动的内容批处理。 |
| qa-performance | gpt-5.4 | high | 测试、边界与基准分析。 |
| reviewer | gpt-5.5 | xhigh | 最终判断和复杂回归，宁可慢，不可漏。 |
| repo-explorer | gpt-5.4-mini | medium | 快速只读检索和证据摘要。 |
| rapid-implementer | gpt-5.3-codex-spark | medium | 独立快速执行通道；只做小范围、低风险、已批准且可自动验证的定点修改。 |

不强求每个角色使用唯一模型。角色差异来自职责、权限、上下文和推理强度；为了形式上不同而使用更差模型会降低可靠性。

官方建议多数复杂任务从 GPT-5.5 开始，轻量子代理使用 GPT-5.4-mini。来源：https://developers.openai.com/codex/concepts/subagents

`gpt-5.3-codex-spark` 是独立的快速 text-only research preview 模型，用于近实时小改、机械性修复和快速迭代，不替代 `gpt-5.5`/`gpt-5.4` 的复杂工程判断，也不替代测试与 reviewer。来源：

- https://developers.openai.com/codex/models
- https://developers.openai.com/codex/speed
- https://openai.com/index/introducing-gpt-5-3-codex-spark/

## Spark 使用边界

- 保持 `project-director`、`systems-architect`、`simulation-engineer`、`client-engineer`、`gameplay-designer`、`content-worker`、`qa-performance`、`reviewer`、`repo-explorer` 的既有模型分配不变。
- `repo-explorer` 保持 `gpt-5.4-mini`，负责长文档、大范围只读扫描、大文件分析和证据压缩。
- `content-worker` 保持 `gpt-5.4-mini` 作为主模型，负责大批量 Schema 驱动内容和长上下文资料；其中范围很小的内容切片可拆给 `rapid-implementer`，但不能让两个角色同时修改同一批内容文件。
- 核心复杂任务仍使用 `gpt-5.5` 或 `gpt-5.4`。
- `reviewer` 不得使用 Spark 作为最终评审模型。
