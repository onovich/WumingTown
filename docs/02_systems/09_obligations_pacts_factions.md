# 旧债、契约与派系

## Obligation

字段：债权方、债务方、义务类型、条件、截止、可见范围、继承规则、履约动作、违约后果、来源事件、当前状态。

义务类型：物资、人情、保护、祭礼、保密、身份、记忆、土地使用、见证、归还。

## Pact

契约由多个双方义务构成，必须显式记录收益与违约。签约前 UI 展示已知条款和未知风险；不能用模糊文本隐藏系统实际条件。

## 继承

债务可绑定个人、家庭、职位、镇议会或土地。个人死亡时根据条款转移、终止或触发。继承必须生成通知和可解释法律依据。

## 派系

派系不只是好感条：拥有目标、资源、内部派别、可接受行为和记忆。MVP 人类派系：巡籍司、九栈商会、山契诸家；异类社会：夜市诸客。

关系维度可包括信誉、畏惧、债权、合法性和互知，不压成单一数值。常用 UI 可显示综合态度，但保留分解。

## 故事用途

一次求援可换来短期医疗与长期政治让步；一次违约可让某派系拒绝贸易、公开秘密或支持镇内反对者。导演读取即将到期义务生成事件，但不得凭空改变条款。
## WM-0064 obligation owner-store note

`M4ObligationStore` is the first authoritative M4 obligation fact surface in
`sim-core`. It owns typed-array rows for creditor, debtor, obligation type,
condition, due window, visibility, inheritance basis, fulfillment action,
violation consequence, source event and current state. The M4 slice currently
defines explicit numeric facts for lampkeeper oil duty, lodging witness duty
and name confirmation; it does not add pacts, factions, town-wide governance,
Worker protocol, save schema or UI behavior.

Owner mutations preflight local input and owner-version capacity before
publishing rows, counts or due indexes. Fulfillment and violation are terminal
state transitions with structured reasons (`obligation_fulfilled` and
`obligation_violated`) and remove the row from the active due lane. Failed
registration, duplicate registration or invalid terminal ticks leave
`ownerVersion`, active counts and due-index counts unchanged.

Actor-facing reads use `queryDueObligations` and
`getActiveDueCountForActor`. Both walk only a debtor due lane with caller caps
and deterministic due-end/id ordering. `queryDueObligations` carries both a
`candidateCap` and a `scanCap`: candidate cap limits returned due-window
matches, while scan cap limits total debtor-lane rows inspected. If scan cap is
exhausted, the result reports `obligation_due_scan_cap_reached` instead of
claiming no candidate. These reads are intended to feed downstream numeric
compliance context rather than hidden prose or probability state.
