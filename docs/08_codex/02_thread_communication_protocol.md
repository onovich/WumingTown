# 线程通信协议

## 事实源

`coordination/inbox/<role>/` 是稳定消息邮箱；`coordination/tasks/` 是任务状态源；`coordination/thread-registry.json` 只是活线程路由表。聊天内“我做完了”不算完成，线程关闭也不能导致任务事实丢失。

## 消息字段

```json
{
  "id": "MSG-...",
  "from": "simulation-engineer",
  "to": "reviewer",
  "taskId": "WM-0042",
  "kind": "review-request",
  "subject": "Reservation transaction ready",
  "body": "See report and branch...",
  "artifacts": ["coordination/reports/WM-0042.md"],
  "createdAt": "ISO timestamp",
  "acknowledgedAt": null
}
```

## 完成后自动发送

Worker 运行 `taskctl complete` 时，脚本会在同一次受锁操作中：

1. 检查任务所有者、当前状态和工作报告；
2. 将任务切换到 `review_requested`；
3. 给任务指定的 `reviewerRole` 原子写入一条 `review-request` 消息。

`review`、`block` 同样会给任务所有者或指定处理角色生成后续消息。因此“完成后通知谁”由任务 JSON 决定，而不是依赖代理记忆。

## 路由到指定线程

根线程生成子代理后，在能获得线程 ID 时登记：

```bash
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs register-thread \
  --role reviewer --thread '<THREAD_ID>' --label 'M0 review'
```

`taskctl route` 会把未读消息按角色分组，并显示已登记线程。根 `project-director` 使用 Codex 原生 subagent steering 继续该线程。使用 Agents SDK/Codex MCP 时，可用官方 `codex-reply(threadId, prompt)` 完成同一动作。

脚本故意不内置密钥或未经文档化的私有线程 API。文件邮箱是审计与恢复机制；原生 steering 是即时投递机制。

## 无活线程时

`project-director` 生成对应 `.codex/agents/<role>.toml` 自定义代理，把任务、报告和消息路径交给它，登记新线程后再投递。新线程不得依赖旧线程记忆。

## 防重复与确认

接收消息的线程真正收到 follow-up 后，根线程才运行 `taskctl ack`。重复投递必须幂等；接收代理先读取任务状态、commit 和报告判断是否已执行。

## 不得发送

密钥、大段日志、完整存档、未经压缩的大型 diff。消息只给结论、阻塞点和仓库路径。
