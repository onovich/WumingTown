# 测试、可观测性与 CI

## 测试层

- 单元：纯算法、Store、规则和迁移。
- 系统：多个 Store + 固定 Tick。
- 场景：数据化世界、计划事件与断言。
- 属性/模糊：Reservation、容器、存档、规则图。
- 重放：命令流与周期 Hash。
- 浏览器：Worker、Canvas、React、输入、OPFS。
- Electron：Preload、文件存档、窗口与打包 smoke。
- 性能：固定机器/环境基准与趋势。

## CI 阶段

```text
format-check → lint → typecheck → unit → scenario → replay
→ content-validate → web-build → browser-smoke
→ desktop-smoke → benchmark-sanity → docs-links
```

PR 可按变更路径跳过不相关昂贵步骤，但主分支每日跑全套。

当前本地复现实入口为 `pnpm ci:local`、`pnpm bench` 与 `pnpm audit:deps`。CI 必须直接调用这些脚本，而不是维护一套只在云端存在的隐式命令序列。

每个 CI job 都要记录精确的 Node、pnpm、npm、OS、CPU 与 Git commit 信息，并把 JSON artifact 连同 benchmark、determinism 与 audit 结果一起上传，便于比较不同 PR 的真实运行环境。

## 错误处理

模拟不允许吞异常继续。开发构建暂停并导出诊断；发布构建生成安全错误包，保留最近命令与 Hash，不上传私人数据除非用户同意。

Determinism / long-run 诊断失败必须输出 seed、首个分歧 tick 和 artifact 路径。禁止只打印“重放失败”之类不可复现的摘要。

## 指标

Tick 系统耗时、队列、候选、路径节点、快照大小、消息延迟、内容加载、存档大小与迁移耗时。指标 ID 稳定，报告可机器比较。

测试框架与工作流不得静默重试 nondeterministic product 行为。允许等待 ready 条件的显式轮询，但禁止配置非零 `retry` / `retries` / `repeatEach` 来掩盖不稳定结果。
