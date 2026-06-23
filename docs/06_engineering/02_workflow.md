# 开发工作流

## 任务是控制面

所有工作从 `coordination/tasks/<ID>.json` 开始。任务包含目标、上下文、约束、验收、依赖、负责角色、评审角色和要求的测试。聊天消息不能替代任务事实。

## 状态

```text
proposed → ready → claimed → in_progress → review_requested
→ changes_requested ↔ in_progress → verified → integrated → done
                         ↘ blocked
```

只有 orchestrator/integration 角色可以进入 integrated/done；worker 只能提交 review_requested。

## 分支与 Worktree

一个任务一个分支 `task/<ID>-short-name` 和独立 Worktree。禁止多个写代理编辑同一 Worktree。文档纯研究任务也要有报告，但可不创建分支。

## 实现流程

1. Claim 任务并读取上下文。
2. 写计划，确认非目标与接口。
3. 先加测试/场景或可观测性。
4. 最小实现，频繁运行窄测试。
5. 运行完整要求、检查 diff、更新文档。
6. 写报告并向 reviewer 邮箱发消息。
7. reviewer 只读分析，给出 findings；修复后复审。
8. integration 处理冲突、全套门禁和合并。

## 禁止

- 在任务范围外顺手大重构；新建 follow-up。
- 为通过测试删除断言或降低基准。
- 同一代理自批、自合并。
- 未写迁移就修改保存字段。
- 因聊天上下文方便而跳过文件记录。
