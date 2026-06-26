# 示例内容目录

## 建筑

| ID                           | 名称   | 系统价值                 |
| ---------------------------- | ------ | ------------------------ |
| core.building.hearth_lantern | 家灯   | 居住安全感、房间认领     |
| core.building.road_lantern   | 路灯   | 夜间物流与道路边界       |
| core.building.watch_lantern  | 守夜灯 | 大范围镇域、需值守       |
| core.building.oil_press      | 榨油坊 | 灯油生产、火灾与劳动压力 |
| core.building.chronicle_room | 镇志房 | 证据整理、档案保存       |
| core.building.guest_house    | 客舍   | 旅客隔离、贸易、身份风险 |
| core.building.night_watch    | 守夜所 | 巡逻、装备、警戒管理     |

## 异类候选

| 名称     | 核心规则                           | 主要系统               |
| -------- | ---------------------------------- | ---------------------- |
| 借影客   | 黑暗归来者的身份可被分裂/复制      | 灯火、身份、家庭、医疗 |
| 第三声   | 第三次回应建立邀请关系             | 门槛、镇规、来客、债务 |
| 井下哭声 | 红灯不是原因，取水顺序才是         | 水、证据、误判、生产   |
| 回灯人   | 会修复无人认领的灯，却取走一段记忆 | 灯网、记忆、契约       |
| 无门户   | 只出现在没有被任何家庭承认的房间   | 住房、身份、建筑       |
| 数名者   | 被公开点数的人越多，它越接近       | 名册、人口统计、审查   |
| 旧桥客   | 月末过桥必须携带为他人准备的物品   | 物流、贸易、互助       |
| 借梦童   | 通过儿童梦境寻找被隐瞒的死者       | 家庭、安葬、镇志       |

## 危机链候选

- 寒潮—灯油短缺—码头熄灯—身份分裂
- 官署重登记—失名者暴露—家庭与法律冲突
- 夜市契约—粮荒缓解—记忆债到期
- 镇志火灾—旧规失传—不同派系争夺解释权

## WM-0079 M5 alpha catalog fixture

The reviewed alpha catalog fixture is defined in
`packages/content-schema/src/m5-alpha-content-catalog-fixtures.ts` and is used
by both schema validation and compiler tests. It contains 30 accepted
definitions:

- 20 `m5.catalog_entry` rows for building, item and tag content.
- 3 `m5.anomaly` rows for borrowed shadow, third knock and old bridge guest.
- 2 `m5.faction_hook` rows for Nine Inns and Mountain Contract pressures.
- 2 `m5.governance_hook` rows for lampkeeper and chronicler authorities.
- 3 `m5.season_event` rows for resource, registration and bridge-route
  pressure.

Every catalog entry has localization keys, reusable tags, system value notes
and owner-surface mapping. `core.catalog.market_contract_board.v1` is accepted
only as blocked catalog data because no reviewed market-contract owner surface
exists in M5.

Rejected WM-0079 fixtures cover building owner-surface failure, tag
owner-surface failure, anomaly evidence failure, faction hook lane failure,
season-event cooldown failure, missing localization and unsafe data paths.
