# 异类、规则与调查

## 定义

异类可以是实体、地点、时段、群体、物品或关系现象。它们不以“怪物等级”分类，而以规则接口组合：

```text
Activation：何时出现
Perception：如何感知世界
Movement：如何移动/跨界
Preference：选择谁或什么
Constraint：绝不能做什么
Trace：留下什么证据
Exchange：接受什么、提供什么
Propagation：如何扩散/继承
Resolution：驱逐、安抚、契约、共居
Consequence：短期与长期后果
```

## 真值与认知分离

模拟持有规则真值；角色和玩家只持有证据与假设。开发 UI 可查看真值，正式 UI 不得泄露。

## 状态机

异类行为必须是显式状态机或规则图，可保存、回放和调试。禁止大量脚本回调和不可见计时器。

## 处置谱

- 避让：改变作息和空间
- 防护：灯、门槛、标记、名册、守夜
- 调查：获得知识
- 交易：提供资源换义务
- 契约：建立长期关系
- 驱逐/封禁：消耗资源和政治成本
- 接纳：给身份、住所、工作和法律地位
- 战斗：最后或特定情况下的手段

## 示例：借影客

触发：外围灯火连续熄灭。行为：复制最近进入黑暗区域者的外貌。限制：无法复制被完整记录的人生琐事。需求：合法身份。危险：逐步替换原主社会关系。处置：揭穿、驱逐、给新身份、焚毁记录、契约守夜。

## 质量门禁

每种异类必须：

- 至少影响三套系统；
- 有非战斗处置；
- 有可利用价值与明确代价；
- 有至少四类证据；
- 有一种常见误判但不能靠纯谎言；
- 有事故后解释；
- 通过 Headless 场景和可玩性测试。

## WM-0065 M4 borrowed-shadow crisis slice

The borrowed-shadow slice is represented as a narrow anomaly/crisis owner
surface, not a broad anomaly catalog. Activation candidates are explicit
numeric facts that carry the lamp gap basis id/version, Chronicle identity case
and hypothesis basis, evidence owner version, and obligation/town-rule context
versions. Activation is prevented when the lamp gap score is below the borrowed
shadow threshold or when Chronicle identity evidence already confirms the
target identity.

Crisis progress is an explicit serializable state machine:
`activated -> trace -> escalated -> resolved|failed`. A crisis must record
low-risk evidence as crisis trace/evidence request rows before escalation can
proceed. These rows do not mutate Chronicle authority directly; Chronicle can
consume them through an explicit later handoff. Resolution commands are numeric
and include non-combat containment and negotiation outcomes. Terminal rows keep
terminal reason, resolution method, tick, owner version, and trace reason fields
for replay and review.
