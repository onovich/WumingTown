# 镇规、治理与身份

## 镇规

镇规是可执行政策，不是纯加成卡。结构：适用对象、时段、区域、触发、动作、例外、执法方式、成本、合法性来源和惩罚。

示例：

```text
入夜后所有旅客必须留在客舍；
尸体不得在居室停留超过一夜；
第三次敲门后不得回应；
旧桥月末禁止点灯。
```

## 遵守

角色根据是否知晓、是否认同、当前需求、关系、恐惧、执法风险和紧急性决定。违规结果必须解释，例如“寻找失踪女儿的冲动压过宵禁认同”。

## 治理

MVP 采用抽象镇议与职位：掌灯人、记事、医官、守夜领班等。玩家可任命角色，职位赋予权限与责任，也形成继承和腐败风险。

## 身份

名册记录居民、客籍、失踪、死亡、异类身份和多个延续。身份影响住房、工作、继承、镇规和证词。游戏后期允许制度上承认非人居民或分裂身份。

## 制度形成

重复决策形成“先例”，达到阈值后可转化为正式镇规。正式化提高自动化与合法性，也降低临时弹性。废除旧规会影响受益者和相信它的居民。

## 反乌托邦风险

更严厉不等于更优。审查、宵禁和告密能短期降低事件风险，却损害信任、贸易、知识公开和某些结局条件。
## WM-0064 town-rule and ordinance note

`M4TownRuleStore` is the first M4 town-rule fact surface. It owns typed-array
rows for subject scope, time window, region, trigger, action, exception,
enforcement method, enforcement cost, legitimacy source, penalty and state. The
vertical-slice facts include name confirmation and third-night-knock compliance
as numeric rule rows with structured reasons. This task does not add the broad
ordinance/governance framework, identity registry, director, Worker protocol,
save schema or UI.

Compliance reads are explicit numeric context inputs: trigger, action, known
rule, need pressure, relationship pressure, fear, enforcement risk, emergency,
confirmed identity and obligation pressure. The store evaluates only the
requested subject-scope/region/trigger/action bucket with a caller candidate cap
and scan cap, so unrelated rule actions cannot consume the cap and out-of-time
rows cannot silently hide later in-time rows. If scan cap is exhausted, the
result reports `town_rule_scan_cap_reached`.
Stored exception masks are authoritative: emergency only bypasses rows whose
exception mask includes `M4_TOWN_RULE_EXCEPTION_EMERGENCY`, and confirmed
identity only bypasses rows whose mask includes
`M4_TOWN_RULE_EXCEPTION_CONFIRMED_IDENTITY`. It returns structured reasons such
as `town_rule_rejected_unknown`, `town_rule_rejected_emergency_exception`,
`town_rule_rejected_confirmed_identity_exception`,
`town_rule_rejected_obligation_pressure`, `town_rule_compliance_allowed` and
`town_rule_enforcement_cost_applied`.

Downstream systems should derive the numeric obligation pressure from bounded
obligation queries, then pass it into compliance context. They must not infer
automatic behavior from presentation text. Automatic resident action remains
gated by known confirmed rules or explicit temporary policies from the
Chronicle/knowledge owner state.

## WM-0077 M5 governance hook store

`M5GovernanceHookStore` is the first M5 governance hook owner surface. It owns
typed-array rows for policy id, hook kind, authority actor, council post,
temporary policy authority, enforcement capacity, legitimacy source,
legitimacy score, risk flags, town-rule owner version, obligation owner
version, Chronicle owner version, source event, source owner version, active
window and stable ordering keys.

Governance hooks are bounded numeric inputs for event legality and town-rule
pressure. `evaluatePolicyHooks` walks only the requested policy lane after
checking the expected governance owner version. It returns selected hook ids,
aggregate enforcement capacity, legitimacy score, policy pressure score, risk
flags and a structured reason such as allowed, risk blocked, insufficient
legitimacy or cap reached. The store does not bypass `M4TownRuleStore`,
`M4ObligationStore` or Chronicle/knowledge authority; it only records versioned
basis facts for downstream legal command selection.
