# Git、提交与发布

## 分支

`main` 始终可构建；任务分支 `task/WM-####-slug`。架构实验可用 `spike/`，验证后丢弃或转正式任务。

## 提交

Conventional Commits + 任务 ID：

```text
feat(sim): add atomic reservation transaction [WM-0042]
fix(ui): preserve chronicle filters after delta [WM-0107]
```

提交应可审查，不混合格式化全仓和功能。生成文件与来源同提交。

## 合并

默认 squash。合并说明包含任务、测试、性能、存档/内容影响和 ADR。禁止跳过 CI 强推 main。

## 发布

版本采用语义化但存档 Schema 独立。每次试玩构建生成内容 Hash、协议版本、存档版本、已知问题和可复现场景。
