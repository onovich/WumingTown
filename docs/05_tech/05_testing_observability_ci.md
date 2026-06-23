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

## 错误处理

模拟不允许吞异常继续。开发构建暂停并导出诊断；发布构建生成安全错误包，保留最近命令与 Hash，不上传私人数据除非用户同意。

## 指标

Tick 系统耗时、队列、候选、路径节点、快照大小、消息延迟、内容加载、存档大小与迁移耗时。指标 ID 稳定，报告可机器比较。
