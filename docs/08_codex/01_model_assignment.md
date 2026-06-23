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

不强求每个角色使用唯一模型。角色差异来自职责、权限、上下文和推理强度；为了形式上不同而使用更差模型会降低可靠性。

官方建议多数复杂任务从 GPT-5.5 开始，轻量子代理使用 GPT-5.4-mini。来源：https://developers.openai.com/codex/concepts/subagents
