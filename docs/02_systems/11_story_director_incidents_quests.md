# Story Director、事件与任务

## 导演职责

读取聚合指标，决定何时施压、维持、恢复或提供机会。它不直接杀人、不改情绪、不绕开资源规则。

指标：人口、有效劳动力、食物天数、灯油天数、伤员、精神风险、近期死亡、活跃异常、未解案卷、到期债务、防御、财富与季节。

## 压力

```text
TargetPressure = progression × difficulty × directorStyle
CurrentPressure = activeThreat + scarcity + injuries + socialCrisis + unresolvedObligations
PressureGap = Target - Current
```

所有量先使用可校准整数分数。重大事件后进入恢复窗口。重复同主题降低新鲜度权重。

## Incident

Incident Def 声明合法条件、成本、主题、前兆、压力贡献、冷却、互斥、恢复类型和 Worker。Worker 只能通过正常世界命令生成角色、天气、物品、债务或异常状态。

## 任务

任务是结构化节点图：目标、期限、选择、世界条件和后果。文本只展示节点状态。任务不得要求模拟无法验证的叙事事实。

## 导演人格

可提供三种风格但共享公平性：稳定叙事、频繁变故、长期季节压力。风格改变事件间隔和主题，不改变规则真值。

## 调试

开发模式显示候选事件、拒绝原因、权重分解、压力曲线、冷却和随机选择。重放记录所用流与候选排序。
