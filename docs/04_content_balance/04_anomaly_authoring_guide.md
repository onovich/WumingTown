# 异类创作指南

## 一页规格

每种异类先填写：一句可见异常、一句核心规则、一句伦理问题、一句可利用价值。

## 必填结构

- 激活：时间、地点、行为、债务或天气
- 感知：看见、听见、名字、关系、灯势等
- 行为状态图
- 硬限制与软偏好
- 前兆和痕迹，至少四类
- 常见误判及为何合理
- 低风险测试与高风险验证
- 处置：至少三种，其中一种非暴力
- 利用：提供什么能力
- 代价：即时、持续、到期或继承
- 社会争议：哪些居民会支持/反对
- 事故复盘文本参数

## 反模式

- “只在满月出现，怕火，打死掉材料”
- 真规则没有任何可见线索
- 唯一解法需要读开发者脑内典故
- 交易收益永久且无维护
- 每种异类都单独写一套 UI 和 AI

## 组合性

异类应复用公共触发与效果；专有性来自组合和社会含义。一个“不能跨被承认的门槛”规则可以与门、户籍、家庭关系和镇规系统结合。

## WM-0073 M5 anomaly validation

M5 anomaly definitions are accepted only as data. Each `m5.anomaly` entry must
declare `schemaVersion: 1`, localization keys, stable references, and
`contentBudget.bespokeRuntimeComponents: 0`.

The M5 gate requires at least one rule component, three affected systems, four
evidence classes, one non-combat resolution, a three-state behavior/state list,
a `commonMisread`, and accident review keys. If an anomaly needs bespoke UI,
AI, Worker protocol, save format, code mods, or runtime behavior, it is not an
M5 content-pack change and must be split into a later implementation task.
