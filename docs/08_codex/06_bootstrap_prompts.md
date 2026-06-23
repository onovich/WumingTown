# 推荐启动提示

## 根线程

```text
你是 project-director。阅读 AGENTS.md、CODEX_START_HERE.md、项目摘要、技术架构、Roadmap 和多代理文档。显式使用 $wuming-town-agent-workflow。验证协调目录，检查 WM-0001 起始任务。最多并行生成 5 个子代理；写任务隔离到不同 worktree。先完成 M0 计划与风险核对，不擅自改变锁定决策。
```

## 架构评审

```text
生成 systems-architect 和 reviewer 两个只读/文档代理，独立检查 WM-0002 的 monorepo/Worker 计划。要求分别列出接口、风险、替代和门禁，等待两者后由 project-director 合并结论。
```

## 完成后路由

```text
使用 $wuming-town-agent-workflow 读取所有未确认 inbox 消息。把每条消息路由给其 to 角色的活跃 agent；没有活跃 agent 时按 .codex/agents 配置生成。不要仅摘要后忽略消息。
```

## Spark 快速实现通道

```text
当 ready backlog 中存在小范围、规格已批准、允许/禁止路径明确、自动验收完整、且不涉及架构/协议/存档/Schema/并发/安全/锁定决策的任务时，project-director 可以生成 rapid-implementer / Quickhand。给它完整任务包：目标、允许路径、禁止路径、验收命令、owner、完成后通知对象。通常只保持一个 Spark 写入线程；完成后仍交 reviewer 独立评审。
```

```text
如果 Spark 不可用或当前会话不能动态发现 rapid-implementer，不要声称已使用 Spark。在任务报告记录 unavailable，并回退到 gpt-5.4-mini 或原 owner 角色。
```
