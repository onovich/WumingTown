# 内容填充设计指南

## 内容价值公式

内容优先级不按“新奇程度”决定，而按：

```text
系统交叉数 × 可重复组合 × 可解释性 × 视觉识别
÷ 专用代码成本 ÷ 专用资产成本
```

## 内容类型与最低要求

### 物品

必须有生产/来源、用途、存储条件、物流意义和至少一个替代品。纯卖店垃圾慎用。

### 建筑

必须改变空间、工作、资源流或制度。只有装饰价值的建筑走美术装饰系统，不创建完整模拟实体。

### 角色背景

必须影响至少两项：技能、关系、信念、恐惧、债务、证词或工作偏好。禁止只有数值加减的无故事背景。

### 事件

必须改变权威状态，并有前兆、处理窗口、后果与恢复。纯弹窗选项只能作为复杂事件的一个节点。

### 异类

参见异类 Authoring Guide。必须有非战斗处置、证据和长期利用/代价。

### 镇规

必须说明谁执行、何时执行、如何违反、执法成本和受益/受损群体。

## 复用

优先用通用 Tag、条件、规则图和文本模板组合。专用 Worker 只有在通用系统无法表达且内容价值足够高时创建。

## 内容审查

每个内容条目经过：Schema → 引用 → 语义 → 本地化 → 自动场景 → 设计评审 → 文化审查（如适用）→ 性能预算。

## WM-0073 M5 content definition gate

M5 alpha content packs are data-only inputs. They must pass the versioned M5
validation gate before any runtime owner consumes them. The accepted definition
kinds are:

- `m5.anomaly`
- `m5.faction_hook`
- `m5.governance_hook`
- `m5.season_event`
- `m5.catalog_entry`

Every accepted definition uses `schemaVersion: 1`, stable def ids, localization
keys, reference validation and `contentBudget.bespokeRuntimeComponents: 0`.
The compiler records deterministic DefIndex order, a content manifest hash and
validation counters. Runtime M5 behavior, Worker protocol changes and save
format changes remain out of scope for content authoring.

## WM-0079 alpha catalog review rule

The WM-0079 accepted fixture keeps alpha content data-only. Catalog entries
must declare `contentBudget.bespokeRuntimeComponents: 0`, at least one
owner-surface mapping, system value, reusable tags, localization keys and
review notes. Entries that cannot map to a reviewed owner surface may remain in
the catalog only when their owner surface is explicitly blocked, as with
`core.catalog.market_contract_board.v1`.

Rejected fixtures must prove fail-closed behavior for building and tag owner
surface failures, anomaly semantic failures, faction hook lane failures,
season-event failures, localization gaps and unsafe data.
