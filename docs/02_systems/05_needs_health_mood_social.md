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
- `DayNightStore` and `WeatherStore` now provide versioned M3 environment
  context for schedule windows, need-rate modifiers, mood context codes,
  outdoor-work eligibility, and structured explanation reasons such as
  `work.rejected_outdoor_night_window` and
  `work.rejected_weather_exposure`. They do not mutate needs, mood,
  relationships, work offers, UI, Worker protocol, or save state in WM-0049.
- Implementation must block instead of adding owner-store gaps, global scans,
  unversioned caches, UI authority, real-time/random authority, Promise or
  coroutine job state, public save/Worker/schema drift, dependencies, package
  boundary exceptions, or M4 scope.

## WM-0052 implementation note

`packages/sim-core/src/m3-health.ts` adds the focused M3 health owner surface.
`M3HealthConditionStore` owns deterministic injury and illness rows with
condition def, kind, body part, severity `0..1000`, age ticks, source id,
component flags, clue and counterevidence refs, terminal state, per-condition
versions, and per-actor condition versions.

`M3AbilityCacheStore` owns only derived ability cache rows for consciousness,
movement, manipulation, sight, communication, and stamina. Base ability lanes
and condition rows remain the source facts. Condition writes enqueue exact
actor/ability dirty keys from the condition's affected ability mask; cache
queries either hit a valid row or rebuild from that actor's linked condition
lane and matching version basis. They do not scan all conditions per query.

The focused sprain path uses structured reason classes such as
`condition.injury_applied`, `condition.updated`, `condition.removed`,
`condition.dirty_queue_overflow`, `condition.terminal_state_out_of_range`,
`ability.cache_invalidated`, `ability.cache_rebuilt`, `ability.cache_hit`,
`ability.value_out_of_range`, and `ability.rejected_below_threshold`. Dirty
queue overflow is preflighted so rejected condition mutations leave no partial
owner row, version, actor link, terminal state, count, or invalidation writes.
Metrics record condition updates, ability invalidations, ability query counts,
cache hits, cache rebuilds, stale-basis rejects, dirty queue backlog/peak, and
condition rows visited during rebuild.

## WM-0054 implementation note

`packages/sim-core/src/m3-mood-thoughts.ts` adds the focused M3
`MoodThoughtMemoryStore`. The store owns actor mood target/current lanes for
valence, energy, and tension on the `0..1000` integer scale. Mood targets are
derived from retained structured thoughts; current mood moves toward the target
only through scheduled stable actor phases with an integer max step.

Thought and memory rows are bounded typed-array lanes. Each row stores actor id,
source kind, source id, source owner version, created tick, expiry tick,
strength, signed effect delta, stack key, target actor, and target mood lane.
Repeated stack keys refresh the existing row; capacity pressure deterministically
evicts the weakest, earliest-expiring row. Expiration is processed during
scheduled mood updates and cannot grow storage with elapsed ticks.

Fact helpers consume already-owned sources without global scans:
`applyNeedFacts` reads the fixed five `NeedStore` lanes for one actor,
`applyEnvironmentFact` consumes an `M3EnvironmentProjection`, and
`applyHealthConditionFact` consumes an explicit `M3HealthConditionView`.
They emit machine-readable reasons such as `mood.need_fact_applied`,
`mood.environment_fact_applied`, `mood.health_fact_applied`,
`mood.thought_added`, `mood.thought_refreshed`, and `mood.memory_added`.
No real-world mental-health labels are used as negative traits.

Metrics report thought and memory generation, retained counts, deterministic
evictions, expirations, scheduled mood update visits, dirty backlog peak/final
backlog, and store version. `createHash()` covers actor mood lanes plus retained
thought and memory rows for focused replay evidence.

## WM-0055 implementation note

`packages/sim-core/src/m3-relationships.ts` adds the focused M3
`RelationshipGraphStore`. The store owns directed actor-to-actor relationship
edges with stable edge ids derived from `actorId * actorCapacity +
targetActorId`. Each edge stores integer kinship, care, trust, gratitude, and
resentment lanes on the `-1000..1000` scale. Source tick and source event id
are tracked per relationship lane so an explanation for trust cannot inherit a
later care, gratitude, kinship, or resentment source. The edge also keeps a
latest-update source and edge version for compact diagnostics.

Ordinary social consequences are stored as structured social event facts, not
text-only content. Event rows carry stable event id, source tick, affected actor
ids, event kind (`care_received`, `meal_shared`, `work_burden_shifted`, or
`care_delayed`), lane, delta, source owner version, reason code, edge id, and
applied value. The helper `createM3OrdinarySocialEvent` maps those event kinds
to focused M3 lane deltas only; it does not implement broader relationship
gameplay, Chronicle evidence, town rules, obligations, dialogue production, UI
interpretation, save schema, or Worker protocol changes.

Relationship and social event queries use per-actor/per-lane indexes and
caller-owned fixed buffers. Candidate reads are bounded by the ADR-0008 default
social caps (`16` candidate visits, `8` retained selections), use deterministic
ordering, and reject stale graph-version basis. Scenario-facing explanation
views expose the trust lane source, trust value, bounded recent-event counts,
candidate total, visited count, candidate cap, and cap-hit status. Social event
rows can also materialize `M3MoodThoughtInput` with source kind `social` so
WM-0054 mood/thought stores can consume the structured fact without treating
prose as authority.

Metrics report edge count, event count, event applications, candidate queries,
visited candidates, cap hits, selected events, and graph version. `createHash()`
and `createSnapshot()` provide deterministic replay evidence for later M3
composition without creating a public save format.

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
