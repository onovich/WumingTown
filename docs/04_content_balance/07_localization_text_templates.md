# 本地化与文本模板

## 原则

系统保存 ReasonCode 和参数，不保存已经拼好的语言句子。中文为首要创作语言，英文从早期同步验证 UI 长度。

## 文本类型

- UI 标签：短、稳定、避免文学化
- 原因解释：主句 + 可展开证据
- 镇志：来源、日期、观察与推断分开
- 角色言语：与职业、关系和地区有关，但保持易读
- 事件叙述：描述事实，不替玩家断言真相

## 模板示例

```text
{witness} 声称在 {location} 看见 {subject}，当时 {visibilityCondition}。
该证词与 {contradictingEvidence} 冲突。
{pawn} 没有执行 {job}：{primaryReason}。
```

## 禁止

在代码中拼接面向玩家的英文/中文；以颜色词作为唯一信息；为营造古风大量倒装和生僻字；让所有异类说谜语。

## First-Play Guidance Templates

Status: WM-0139 provisional copy contract until the M8 first-play guidance
review accepts it.

- Selection guidance must name visible targets only: residents, structures,
  lantern posts, visitors and map tiles. It must point to inspector/read-model
  state, not hidden truth.
- Camera guidance must describe player navigation only: drag-pan and camera
  reset. Do not mention developer diagnostics or internal tooling.
- Minimum command guidance must stay testable: select a lantern keeper or
  lamp-relevant object, use `Prioritize lamp work` / `优先补灯`, then read the
  queued HUD feedback from the WM-0138 lamp-priority local action chain.
- Boundary copy may say internal tools are separate and explicitly opened. It
  must not make public release, final balance, legal/privacy, telemetry, store
  or save-compatibility claims.
