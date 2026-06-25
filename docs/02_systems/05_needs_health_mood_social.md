# 需求、健康、情绪与社交

## 需求

MVP：饥饿、休息、舒适、社交、安全感。使用 0–1000 整数尺度，分频更新。需求本身不直接触发复杂行为，只生成紧迫度与思想条件。

## 健康

身体部位简化为头、躯干、左右臂、左右腿及少量关键器官。`ConditionInstance` 表达伤口、疾病、诅咒、附身、失名和异变：Def、部位、严重度、年龄、来源、组件。

派生能力：意识、移动、操作、视觉、交流、耐力。条件变化使相关能力缓存失效，不允许每次查询遍历全部状态。

## 情绪因果链

```text
事实/情境 → Thought/Memory → Mood Target → 实际 Mood
→ 风险状态 → 精神行为或灵感
```

思想有来源、强度、持续、堆叠和目标人物。精神行为必须与角色经历和当前条件相符，不从通用随机池随意抽取。

## 志怪状态

“失名”“借梦”“被替换怀疑”等不应独立于健康/社交存在。它们可以同时影响能力、证词可信度、家庭关系和镇志。

## 社交图

关系包括亲属、伴侣、师徒、恩情、血债、好感和信任。社交事件产生结构化事实，文本模板仅表现。证词可信度受感知、记忆、利益和关系影响，但不能简单等同于好感。

## 玩家解释

角色检查器必须显示：当前情绪与目标、主要因素、能力计算、Job 中断原因、对镇规的认可、已知异类规则与个人秘密的可见范围。

## M3 architecture gate note

`coordination/decisions/ADR-0008.md` is the M3 ordinary-life architecture gate
for this surface.

- `NeedStore` owns hunger, rest, comfort, social, and safety integer lanes;
  `NeedUrgencyIndex` is derived, dirty-keyed, capped, and versioned.
- `HealthConditionStore` owns condition instances; `AbilityCacheStore` owns
  only cached values and validity basis, and must invalidate exact actor/ability
  lanes before work or medical selection can read them.
- `MoodThoughtMemoryStore` owns thoughts, memories, mood target/current, and
  risk/status lanes with bounded retention and source owner-store references.
- `RelationshipGraphStore` owns social edges and event facts; text templates,
  UI panels, and social candidate indexes are derived.
- Implementation must block instead of adding owner-store gaps, global scans,
  unversioned caches, UI authority, real-time/random authority, Promise or
  coroutine job state, public save/Worker/schema drift, dependencies, package
  boundary exceptions, or M4 scope.

## 内容边界

避免把精神崩溃做成滑稽随机事件；避免以现实精神疾病标签当作负面 Trait；超自然影响必须与世界规则区分，不能暗示现实病症由鬼怪造成。

## WM-0048 implementation note

`packages/sim-core/src/m3-needs.ts` adds the first M3 needs owner surface.
`NeedStore` owns the five fixed integer lanes (`hunger`, `rest`, `comfort`,
`social`, and `safety`) on the 0..1000 scale. Each actor/lane stores its update
phase, source tick, owner version, previous/next values, delta, source ids, and
machine-readable last-change reason.

Scheduled need changes are phase-bucketed by actor/lane key, so a tick processes
only the matching phase bucket and an explicit budget. Each phase keeps a
deterministic cursor: if a phase exceeds the budget, the next call resumes at
the next linked lane and wraps only after a full phase pass. Actor self-read of
the fixed five lanes remains O(1).

`NeedUrgencyIndex` is derived from `NeedStore`. It can rebuild from owner state
for load/replay setup, but normal updates use exact dirty actor/lane keys. Direct
owner mutations return `NeedMutationResult`; callers must pass changed results
through `NeedUrgencyIndex.markMutationDirty(result)` or provide the index as a
`NeedDirtySink` to scheduled update processing. Urgency queries reject stale
dirty backlog, then visit only indexed lane buckets up to caller-provided
candidate and selected caps. Ordering is deterministic: urgency score
descending, then stable actor/lane key.

`NeedUrgencyTraceStore` records bounded structured evidence for urgency
selection, including `need.hunger_urgency_indexed`,
`need.rest_urgency_indexed`, `need.urgency_no_candidate`, and
`trace.candidate_cap_reached`. These rows are diagnostic evidence only; they do
not own needs or job behavior.
