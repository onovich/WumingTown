# Skill 安装与使用

Skill 已位于：

```text
.agents/skills/wuming-town-agent-workflow/
```

Codex 从仓库根运行时会自动发现 repo-local skill。可在提示中显式使用：

```text
$wuming-town-agent-workflow
```

若要安装为用户级 Skill，将该目录复制或链接到：

```text
$HOME/.agents/skills/wuming-town-agent-workflow
```

Codex Skill 由 `SKILL.md`、脚本、参考资料和可选 `agents/openai.yaml` 组成。官方规范：https://developers.openai.com/codex/skills

## 主线程例程

1. `status` 查看任务和邮箱。
2. 选择不阻塞任务并显式 spawn 对应 agent。
3. 路由 Inbox follow-up。
4. 等待实现/评审结果。
5. 运行集成门禁并关闭任务。

## Worker 例程

Claim → Plan → Work → Test → Report → Complete → Send review message。

## 限制

Skill 和脚本不会调用未公开的 Codex 线程 API，也不会擅自启动后台服务。跨线程驱动依靠父 Codex 线程的原生 subagent steering；文件邮箱保证中断后可恢复。若未来采用 Symphony/Linear，可保留相同任务状态并替换调度层。
