# 平衡框架与实验方法

## 平衡目标

不是让所有策略收益相等，而是让不同策略拥有适用场景、可见代价和恢复空间。

## 指标

- 每居民每日有效工作时间
- 必需劳动占比：食物、清洁、灯火、医疗
- 空闲/社交/恢复时间
- 资源可维持天数
- Job 失败与切换率
- 每日路径距离
- 重大危机后恢复天数
- 玩家可预测事件比例
- 镇志误判率及是否感觉公平
- 每种异类的处置路线使用率
- 角色死亡原因分布

## 自动仿真

使用策略机器人运行基准殖民地：保守、扩张、契约、封禁。它们不代表真人最佳玩法，只用于发现资源死循环、单一统治策略和事件叠加。

## 调参顺序

规则正确性 → 信息清晰 → 复杂度 → 宏观资源 → 个体数值 → 微小手感。禁止用数值掩盖工作搜索、路径或 UI 问题。

## 变更记录

平衡改动必须记录假设、指标、场景、前后结果和副作用。不可只写“感觉太强，削弱 20%”。

## WM-0100 M7 Balance/Readability Note

WM-0100 records the M7 early-game balance and readability package in
`docs/04_content_balance/10_m7_early_game_balance_readability.md`.

The package freezes current M5 evidence for M7 downstream use instead of
changing values:

- M5 final world/read-model hashes remain `0xfba70a5c` / `0x9ba83cb7`.
- The first-season event pool evidence is used for controlled-test readability
  guidance, not final event-frequency promises.
- Early pressure, night cadence and recovery windows must expose structured
  reasons before player-facing copy can claim they are understandable.
- Web remains `demo-only`; Windows remains controlled-external-test only.
- Any future tuning that moves hashes or runtime cost requires a focused task,
  before/after evidence and reviewer acceptance.
