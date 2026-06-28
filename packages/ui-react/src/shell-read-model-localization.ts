import type { WorldReadModel } from "@wuming-town/sim-protocol";

import { formatMessage, type LocaleId, type LocalizationValidationIssue } from "./localization";

type FixtureTextCatalog = Readonly<Record<string, Readonly<Record<LocaleId, string>>>>;

// Non-authoritative presentation mapping for the current Web shell fixture only.
// It localizes fixture-backed player text without changing sim/worker/protocol contracts.
const SHELL_FIXTURE_TEXT: FixtureTextCatalog = Object.freeze({
  "Wuming Town / 无明镇": {
    en: "Wuming Town",
    "zh-CN": "无明镇",
  },
  "Dusk watch": {
    en: "Dusk watch",
    "zh-CN": "黄昏守望",
  },
  "First season, curfew approach": {
    en: "First season, curfew approach",
    "zh-CN": "初季，宵禁将近",
  },
  Paused: {
    en: "Paused",
    "zh-CN": "暂停",
  },
  "East market and bridge road": {
    en: "East market and bridge road",
    "zh-CN": "东市与桥路",
  },
  "Lantern corridor gap": {
    en: "Lantern corridor gap",
    "zh-CN": "灯廊缺口",
  },
  "Threshold review open": {
    en: "Threshold review open",
    "zh-CN": "门槛审查未结",
  },
  "Bridge parcels staged": {
    en: "Bridge parcels staged",
    "zh-CN": "桥路包裹已备妥",
  },
  "Faction pressure bounded": {
    en: "Faction pressure bounded",
    "zh-CN": "派系压力受控",
  },
  "The east market lane may lose light before curfew.": {
    en: "The east market lane may lose light before curfew.",
    "zh-CN": "东市通道可能会在宵禁前失去照明。",
  },
  "Guesthouse threshold records still need council confirmation.": {
    en: "Guesthouse threshold records still need council confirmation.",
    "zh-CN": "客栈门槛记录仍需议席确认。",
  },
  "Prepared goods are ready beside the old bridge route.": {
    en: "Prepared goods are ready beside the old bridge route.",
    "zh-CN": "备好的货包已放在旧桥路线旁。",
  },
  "Guild, archive, and patrol demands remain in balance.": {
    en: "Guild, archive, and patrol demands remain in balance.",
    "zh-CN": "行会、档案与巡守三方需求暂时维持平衡。",
  },
  Rice: {
    en: "Rice",
    "zh-CN": "米粮",
  },
  "Lamp oil": {
    en: "Lamp oil",
    "zh-CN": "灯油",
  },
  "Paper seals": {
    en: "Paper seals",
    "zh-CN": "封印纸",
  },
  Medicinals: {
    en: "Medicinals",
    "zh-CN": "药材",
  },
  "Bridge packs": {
    en: "Bridge packs",
    "zh-CN": "桥路包",
  },
  d: {
    en: "d",
    "zh-CN": "斗",
  },
  c: {
    en: "c",
    "zh-CN": "罐",
  },
  r: {
    en: "r",
    "zh-CN": "卷",
  },
  k: {
    en: "k",
    "zh-CN": "箱",
  },
  b: {
    en: "b",
    "zh-CN": "包",
  },
  "Chronicler Lin": {
    en: "Chronicler Lin",
    "zh-CN": "编志官 林",
  },
  "Lantern Keeper Shen": {
    en: "Lantern Keeper Shen",
    "zh-CN": "守灯人 沈",
  },
  "Watch Lead Qiao": {
    en: "Watch Lead Qiao",
    "zh-CN": "守夜头目 乔",
  },
  "Host Ren": {
    en: "Host Ren",
    "zh-CN": "掌柜 任",
  },
  "Bridge Runner Su": {
    en: "Bridge Runner Su",
    "zh-CN": "桥路脚夫 苏",
  },
  "Registry Clerk Bo": {
    en: "Registry Clerk Bo",
    "zh-CN": "籍册吏 薄",
  },
  "Medic Fan": {
    en: "Medic Fan",
    "zh-CN": "医士 樊",
  },
  "Guild Agent Mei": {
    en: "Guild Agent Mei",
    "zh-CN": "行会使者 梅",
  },
  "Guide Yi": {
    en: "Guide Yi",
    "zh-CN": "向导 伊",
  },
  "Council Seat Hou": {
    en: "Council Seat Hou",
    "zh-CN": "议席 侯",
  },
  "Archivist Sun": {
    en: "Archivist Sun",
    "zh-CN": "档案官 孙",
  },
  "Market Runner 1": {
    en: "Market Runner 1",
    "zh-CN": "市集脚夫 1",
  },
  "Watch Scout 2": {
    en: "Watch Scout 2",
    "zh-CN": "巡守斥候 2",
  },
  "Ledger Aide 3": {
    en: "Ledger Aide 3",
    "zh-CN": "账册助手 3",
  },
  "Bridge Handler 4": {
    en: "Bridge Handler 4",
    "zh-CN": "桥路搬运手 4",
  },
  "Lamp Aide 5": {
    en: "Lamp Aide 5",
    "zh-CN": "灯务助手 5",
  },
  "Market Runner 6": {
    en: "Market Runner 6",
    "zh-CN": "市集脚夫 6",
  },
  "Watch Scout 7": {
    en: "Watch Scout 7",
    "zh-CN": "巡守斥候 7",
  },
  "Ledger Aide 8": {
    en: "Ledger Aide 8",
    "zh-CN": "账册助手 8",
  },
  "Bridge Handler 9": {
    en: "Bridge Handler 9",
    "zh-CN": "桥路搬运手 9",
  },
  "Lamp Aide 10": {
    en: "Lamp Aide 10",
    "zh-CN": "灯务助手 10",
  },
  "Market Runner 11": {
    en: "Market Runner 11",
    "zh-CN": "市集脚夫 11",
  },
  "Watch Scout 12": {
    en: "Watch Scout 12",
    "zh-CN": "巡守斥候 12",
  },
  "Ledger Aide 13": {
    en: "Ledger Aide 13",
    "zh-CN": "账册助手 13",
  },
  "Bridge Handler 14": {
    en: "Bridge Handler 14",
    "zh-CN": "桥路搬运手 14",
  },
  "Lamp Aide 15": {
    en: "Lamp Aide 15",
    "zh-CN": "灯务助手 15",
  },
  "Market Runner 16": {
    en: "Market Runner 16",
    "zh-CN": "市集脚夫 16",
  },
  "Watch Scout 17": {
    en: "Watch Scout 17",
    "zh-CN": "巡守斥候 17",
  },
  "Ledger Aide 18": {
    en: "Ledger Aide 18",
    "zh-CN": "账册助手 18",
  },
  "Bridge Handler 19": {
    en: "Bridge Handler 19",
    "zh-CN": "桥路搬运手 19",
  },
  "Lamp Aide 20": {
    en: "Lamp Aide 20",
    "zh-CN": "灯务助手 20",
  },
  "Market Runner 21": {
    en: "Market Runner 21",
    "zh-CN": "市集脚夫 21",
  },
  "Watch Scout 22": {
    en: "Watch Scout 22",
    "zh-CN": "巡守斥候 22",
  },
  "Ledger Aide 23": {
    en: "Ledger Aide 23",
    "zh-CN": "账册助手 23",
  },
  "Bridge Handler 24": {
    en: "Bridge Handler 24",
    "zh-CN": "桥路搬运手 24",
  },
  "Lamp Aide 25": {
    en: "Lamp Aide 25",
    "zh-CN": "灯务助手 25",
  },
  "Market Runner 26": {
    en: "Market Runner 26",
    "zh-CN": "市集脚夫 26",
  },
  "Watch Scout 27": {
    en: "Watch Scout 27",
    "zh-CN": "巡守斥候 27",
  },
  "Ledger Aide 28": {
    en: "Ledger Aide 28",
    "zh-CN": "账册助手 28",
  },
  "Bridge Handler 29": {
    en: "Bridge Handler 29",
    "zh-CN": "桥路搬运手 29",
  },
  "Cross-checking debt ledgers and witness records before curfew.": {
    en: "Cross-checking debt ledgers and witness records before curfew.",
    "zh-CN": "正在宵禁前交叉核对债务账册与见证记录。",
  },
  "Patrolling the market corridor where the M4 lamp gap once opened.": {
    en: "Patrolling the market corridor where the M4 lamp gap once opened.",
    "zh-CN": "正在巡查曾出现 M4 灯火缺口的市集通道。",
  },
  "Holding the threshold roster while third-knock warnings circulate.": {
    en: "Holding the threshold roster while third-knock warnings circulate.",
    "zh-CN": "在三敲警示流传时守住门槛名册。",
  },
  "Auditing lodging exceptions against the third-knock rule review.": {
    en: "Auditing lodging exceptions against the third-knock rule review.",
    "zh-CN": "正在对照三敲规则审查住宿例外。",
  },
  "Staging prepared goods before the old-bridge month-end crossing.": {
    en: "Staging prepared goods before the old-bridge month-end crossing.",
    "zh-CN": "正在旧桥月末通行前整理备妥货物。",
  },
  "Maintaining identity confirmations used by the M4 borrowed-shadow prevention path.": {
    en: "Maintaining identity confirmations used by the M4 borrowed-shadow prevention path.",
    "zh-CN": "正在维护 M4 借影防范路径所需的身份确认。",
  },
  "Covering infirmary stock while faction pressure pushes for faster triage.": {
    en: "Covering infirmary stock while faction pressure pushes for faster triage.",
    "zh-CN": "在派系压力催促加快分诊时守住医馆库存。",
  },
  "Negotiating lamp oil and paper routes for the Nine Inns Guild.": {
    en: "Negotiating lamp oil and paper routes for the Nine Inns Guild.",
    "zh-CN": "正在为九栈行会协调灯油与纸张路线。",
  },
  "Carrying mountain-family route memory into the bridge pressure lane.": {
    en: "Carrying mountain-family route memory into the bridge pressure lane.",
    "zh-CN": "把山家路线记忆带入桥路压力地带。",
  },
  "Holding the temporary policy lane that can legalize recovery actions.": {
    en: "Holding the temporary policy lane that can legalize recovery actions.",
    "zh-CN": "守住能让补救行动合法化的临时政策通道。",
  },
  "Protecting name records tied to the Return-Lamp Society's trust lane.": {
    en: "Protecting name records tied to the Return-Lamp Society's trust lane.",
    "zh-CN": "保护与归灯社信任路径相关的名录记录。",
  },
  "Routing market night bundles between archive, lamp route and bridge road.": {
    en: "Routing market night bundles between archive, lamp route and bridge road.",
    "zh-CN": "正在在档案、灯路与桥道之间转运夜市包裹。",
  },
  "Sweeping the gate ring for threshold anomalies and stalled routes.": {
    en: "Sweeping the gate ring for threshold anomalies and stalled routes.",
    "zh-CN": "正在扫查城门环带的门槛异常与停滞路线。",
  },
  "Keeping witness slips sorted for the chronicler and registry offices.": {
    en: "Keeping witness slips sorted for the chronicler and registry offices.",
    "zh-CN": "正在为编志与籍册两处整理见证纸条。",
  },
  "Tracking prepared bridge packs and month-end reciprocity checks.": {
    en: "Tracking prepared bridge packs and month-end reciprocity checks.",
    "zh-CN": "正在跟踪桥路备包与月末互惠核查。",
  },
  "Extending the glow band across courtyards and side streets.": {
    en: "Extending the glow band across courtyards and side streets.",
    "zh-CN": "正在把灯光带延伸到院落与侧巷。",
  },
  "Chronicle office": {
    en: "Chronicle office",
    "zh-CN": "编志所",
  },
  "Lampkeeper watch": {
    en: "Lampkeeper watch",
    "zh-CN": "守灯岗",
  },
  "Night watch": {
    en: "Night watch",
    "zh-CN": "夜巡队",
  },
  "Guesthouse keeper": {
    en: "Guesthouse keeper",
    "zh-CN": "客栈掌柜",
  },
  "Road guest": {
    en: "Road guest",
    "zh-CN": "路上来客",
  },
  "Registry office": {
    en: "Registry office",
    "zh-CN": "籍册所",
  },
  "Medic station": {
    en: "Medic station",
    "zh-CN": "医馆",
  },
  "Guild envoy": {
    en: "Guild envoy",
    "zh-CN": "行会使者",
  },
  "Contract family guide": {
    en: "Contract family guide",
    "zh-CN": "契家向导",
  },
  "Council post": {
    en: "Council post",
    "zh-CN": "议席岗位",
  },
  "Return-Lamp Society": {
    en: "Return-Lamp Society",
    "zh-CN": "归灯社",
  },
  "Market courier": {
    en: "Market courier",
    "zh-CN": "市集递送员",
  },
  "Perimeter watch": {
    en: "Perimeter watch",
    "zh-CN": "外围巡守",
  },
  "Archive aide": {
    en: "Archive aide",
    "zh-CN": "档案助手",
  },
  "Bridge crew": {
    en: "Bridge crew",
    "zh-CN": "桥路班组",
  },
  "Lamp route": {
    en: "Lamp route",
    "zh-CN": "灯路班",
  },
  "Ledger review": {
    en: "Ledger review",
    "zh-CN": "账册复核",
  },
  "Lantern patrol": {
    en: "Lantern patrol",
    "zh-CN": "巡灯",
  },
  "Checkpoint hold": {
    en: "Checkpoint hold",
    "zh-CN": "卡点值守",
  },
  "Threshold audit": {
    en: "Threshold audit",
    "zh-CN": "门槛审计",
  },
  "Bridge route prep": {
    en: "Bridge route prep",
    "zh-CN": "桥路整备",
  },
  "Identity review": {
    en: "Identity review",
    "zh-CN": "身份复核",
  },
  "Infirmary prep": {
    en: "Infirmary prep",
    "zh-CN": "医馆整备",
  },
  "Supply negotiation": {
    en: "Supply negotiation",
    "zh-CN": "补给谈判",
  },
  "Route briefing": {
    en: "Route briefing",
    "zh-CN": "路线说明",
  },
  "Policy review": {
    en: "Policy review",
    "zh-CN": "政策审议",
  },
  "Name preservation": {
    en: "Name preservation",
    "zh-CN": "名录保全",
  },
  "Bundle relay": {
    en: "Bundle relay",
    "zh-CN": "包裹转运",
  },
  "Perimeter sweep": {
    en: "Perimeter sweep",
    "zh-CN": "外围扫查",
  },
  "Slip sorting": {
    en: "Slip sorting",
    "zh-CN": "纸条分拣",
  },
  "Pack staging": {
    en: "Pack staging",
    "zh-CN": "包裹列放",
  },
  "Glow maintenance": {
    en: "Glow maintenance",
    "zh-CN": "灯光维护",
  },
  "Verify north-gate witness order": {
    en: "Verify north-gate witness order",
    "zh-CN": "核对北门见证顺序",
  },
  "Refuel the east market corridor": {
    en: "Refuel the east market corridor",
    "zh-CN": "为东市通道补足灯油",
  },
  "Reconcile invitation debt exceptions": {
    en: "Reconcile invitation debt exceptions",
    "zh-CN": "核对邀请债例外",
  },
  "Compare room slate with witness testimony": {
    en: "Compare room slate with witness testimony",
    "zh-CN": "拿房簿与证词逐项比对",
  },
  "Check prepared gift pack against ledger intent": {
    en: "Check prepared gift pack against ledger intent",
    "zh-CN": "核对备礼包与账册意图",
  },
  "Seal confirmed witness chain": {
    en: "Seal confirmed witness chain",
    "zh-CN": "封存已确认的见证链",
  },
  "Bundle lamp-safe treatment packs": {
    en: "Bundle lamp-safe treatment packs",
    "zh-CN": "打包夜灯可用的治疗包",
  },
  "Trade paper for lamp oil buffer": {
    en: "Trade paper for lamp oil buffer",
    "zh-CN": "以纸张换取灯油缓冲",
  },
  "Match bridge ledger to oral record": {
    en: "Match bridge ledger to oral record",
    "zh-CN": "让桥路账册与口述记录一致",
  },
  "Assess temporary threshold exception": {
    en: "Assess temporary threshold exception",
    "zh-CN": "评估临时门槛例外",
  },
  "Confirm burial record witness stamp": {
    en: "Confirm burial record witness stamp",
    "zh-CN": "确认葬录见证印记",
  },
  "Carry verified parcel to bridge hold": {
    en: "Carry verified parcel to bridge hold",
    "zh-CN": "把已核包裹送到桥路待命点",
  },
  "Check outer path lanterns": {
    en: "Check outer path lanterns",
    "zh-CN": "检查外环路灯",
  },
  "Group witness slips by gate lane": {
    en: "Group witness slips by gate lane",
    "zh-CN": "按门路归整见证纸条",
  },
  "Mark intended recipient on route pack": {
    en: "Mark intended recipient on route pack",
    "zh-CN": "在路包上标明收件人",
  },
  "Refill side-court lanterns": {
    en: "Refill side-court lanterns",
    "zh-CN": "补满侧院灯火",
  },
  Alert: {
    en: "Alert",
    "zh-CN": "警觉",
  },
  Focused: {
    en: "Focused",
    "zh-CN": "专注",
  },
  Guarded: {
    en: "Guarded",
    "zh-CN": "戒备",
  },
  Measured: {
    en: "Measured",
    "zh-CN": "克制",
  },
  Wary: {
    en: "Wary",
    "zh-CN": "谨慎",
  },
  Composed: {
    en: "Composed",
    "zh-CN": "沉着",
  },
  Busy: {
    en: "Busy",
    "zh-CN": "忙碌",
  },
  Calculating: {
    en: "Calculating",
    "zh-CN": "盘算",
  },
  Reserved: {
    en: "Reserved",
    "zh-CN": "保留",
  },
  Deliberate: {
    en: "Deliberate",
    "zh-CN": "审慎",
  },
  Steady: {
    en: "Steady",
    "zh-CN": "平稳",
  },
  Calm: {
    en: "Calm",
    "zh-CN": "平静",
  },
  Unhurt: {
    en: "Unhurt",
    "zh-CN": "无伤",
  },
  Stable: {
    en: "Stable",
    "zh-CN": "稳定",
  },
  "Travel-worn": {
    en: "Travel-worn",
    "zh-CN": "旅途劳顿",
  },
  "Delay archive sealing until the last road guest is registered.": {
    en: "Delay archive sealing until the last road guest is registered.",
    "zh-CN": "在最后一位路上来客登记前，暂缓封档。",
  },
  "Protect the market lane before the gate road falls dark.": {
    en: "Protect the market lane before the gate road falls dark.",
    "zh-CN": "在城门道路失去光亮前先护住市集通路。",
  },
  "Keep the checkpoint visible instead of opening the inner lane.": {
    en: "Keep the checkpoint visible instead of opening the inner lane.",
    "zh-CN": "保持卡点可见，不要贸然放开内道。",
  },
  "Refuse a late-room transfer until the host ledger is confirmed.": {
    en: "Refuse a late-room transfer until the host ledger is confirmed.",
    "zh-CN": "在房主账册确认前，拒绝深夜换房。",
  },
  "Delay crossing until the prepared item is clearly for another traveler.": {
    en: "Delay crossing until the prepared item is clearly for another traveler.",
    "zh-CN": "在备物明确属于他人前，暂缓过桥。",
  },
  "Prioritize independent evidence classes over speed.": {
    en: "Prioritize independent evidence classes over speed.",
    "zh-CN": "把独立证据类别放在速度之前。",
  },
  "Reserve medicinals for verified risk lanes before market demand spikes.": {
    en: "Reserve medicinals for verified risk lanes before market demand spikes.",
    "zh-CN": "在市集需求飙升前，把药材优先留给已核风险路径。",
  },
  "Preserve market calm even if the bridge route slows for one night.": {
    en: "Preserve market calm even if the bridge route slows for one night.",
    "zh-CN": "即使桥路今夜放缓，也要先稳住市面。",
  },
  "Hold the route until the record and the witness agree.": {
    en: "Hold the route until the record and the witness agree.",
    "zh-CN": "在记录与见证一致前，先按住路线。",
  },
  "Allow only policies the watch and archive can explain tomorrow.": {
    en: "Allow only policies the watch and archive can explain tomorrow.",
    "zh-CN": "只允许守夜与档案在明天还能讲得清的政策。",
  },
  "Keep death records visible when faction pressure asks for speed.": {
    en: "Keep death records visible when faction pressure asks for speed.",
    "zh-CN": "即便派系催促速度，也要让死者记录保持可见。",
  },
  "Stay inside the reviewed M5 lane and keep tonight's route legible.": {
    en: "Stay inside the reviewed M5 lane and keep tonight's route legible.",
    "zh-CN": "留在已审 M5 通道内，让今夜路线保持清晰可读。",
  },
  "Two pledge slips still disagree on creditor witness order.": {
    en: "Two pledge slips still disagree on creditor witness order.",
    "zh-CN": "两张誓约纸条对债主见证顺序仍有分歧。",
  },
  "The registry expects one more traveler before the bell.": {
    en: "The registry expects one more traveler before the bell.",
    "zh-CN": "籍册处预期在钟响前还会再来一名旅人。",
  },
  "Fuel reserve is lowest along the old borrowed-shadow route.": {
    en: "Fuel reserve is lowest along the old borrowed-shadow route.",
    "zh-CN": "旧借影路线沿线的燃料储备最低。",
  },
  "Visitor traffic is still clustering near the market archway.": {
    en: "Visitor traffic is still clustering near the market archway.",
    "zh-CN": "访客流量仍聚集在市集拱门附近。",
  },
  "Escort paperwork is incomplete for after-dark movement.": {
    en: "Escort paperwork is incomplete for after-dark movement.",
    "zh-CN": "夜后通行所需的护送文书尚不完整。",
  },
  "Third-knock review still flags two guesthouse thresholds.": {
    en: "Third-knock review still flags two guesthouse thresholds.",
    "zh-CN": "三敲复核仍标记出两处客栈门槛。",
  },
  "The third knock only becomes safe with a confirmed rule or temporary policy.": {
    en: "The third knock only becomes safe with a confirmed rule or temporary policy.",
    "zh-CN": "第三次敲门只有在规则确认或临时政策生效后才算安全。",
  },
  "A room change would widen the invitation debt trace.": {
    en: "A room change would widen the invitation debt trace.",
    "zh-CN": "换房会扩大邀请债的痕迹。",
  },
  "The old-bridge rule rejects self-serving toll bundles.": {
    en: "The old-bridge rule rejects self-serving toll bundles.",
    "zh-CN": "旧桥规则会拒绝自利性的过桥包。",
  },
  "Bridge ledgers still disagree on who the parcel belongs to.": {
    en: "Bridge ledgers still disagree on who the parcel belongs to.",
    "zh-CN": "桥路账册对包裹归属仍未达成一致。",
  },
  "The prevention path relies on confirmed identity before activation.": {
    en: "The prevention path relies on confirmed identity before activation.",
    "zh-CN": "防范路径在启用前依赖已确认的身份。",
  },
  "A weak seal today becomes a false dawn review tomorrow.": {
    en: "A weak seal today becomes a false dawn review tomorrow.",
    "zh-CN": "今天封得不稳，明天黎明复盘就会出错。",
  },
  "The first-season pool can raise registration and market pressure at once.": {
    en: "The first-season pool can raise registration and market pressure at once.",
    "zh-CN": "初季资源池会同时抬高登记压力与市面压力。",
  },
  "Low-risk evidence should prevent crisis escalation before treatment is scarce.": {
    en: "Low-risk evidence should prevent crisis escalation before treatment is scarce.",
    "zh-CN": "在药材紧缺前，低风险证据应先阻止局势升级。",
  },
  "Lamp oil and paper are the tightest visible M5 bottlenecks.": {
    en: "Lamp oil and paper are the tightest visible M5 bottlenecks.",
    "zh-CN": "灯油与纸张是当前最明显的 M5 瓶颈。",
  },
  "A stable market night matters more than one aggressive haul.": {
    en: "A stable market night matters more than one aggressive haul.",
    "zh-CN": "一个平稳的夜市，比一次激进的抢运更重要。",
  },
  "Old-family oral records remain valid evidence in the old-bridge lane.": {
    en: "Old-family oral records remain valid evidence in the old-bridge lane.",
    "zh-CN": "旧家族的口述记录在旧桥路径上仍是有效证据。",
  },
  "A mismatched memory becomes a route delay and a trust loss.": {
    en: "A mismatched memory becomes a route delay and a trust loss.",
    "zh-CN": "记忆对不上，就会变成路线延误与信任流失。",
  },
  "Governance hooks legalize event commands but cannot erase source facts.": {
    en: "Governance hooks legalize event commands but cannot erase source facts.",
    "zh-CN": "治理钩子能让事件命令合法化，却不能抹去源头事实。",
  },
  "Temporary policy without explanation becomes hidden authority.": {
    en: "Temporary policy without explanation becomes hidden authority.",
    "zh-CN": "没有解释的临时政策会变成隐性权威。",
  },
  "Identity records matter to both borrowed-shadow prevention and public trust.": {
    en: "Identity records matter to both borrowed-shadow prevention and public trust.",
    "zh-CN": "身份记录既关系借影防范，也关系公众信任。",
  },
  "Fast anonymized filing would undercut the reviewed M4 lesson.": {
    en: "Fast anonymized filing would undercut the reviewed M4 lesson.",
    "zh-CN": "快速匿名归档会削弱已复核的 M4 教训。",
  },
  "This support role helps keep the first-season market, lamp and guest flows visible.": {
    en: "This support role helps keep the first-season market, lamp and guest flows visible.",
    "zh-CN": "这个支援岗位帮助维持初季市集、灯路与来客流向的可见性。",
  },
  "The harness keeps these roles read-only so later Web gates can measure the same slice.": {
    en: "The harness keeps these roles read-only so later Web gates can measure the same slice.",
    "zh-CN": "这个外壳让这些岗位保持只读，以便后续 Web 闸门继续测量同一切片。",
  },
  "Keep faction debt separate from shrine records.": {
    en: "Keep faction debt separate from shrine records.",
    "zh-CN": "把派系债务与祠庙记录分开。",
  },
  "Do not certify a guest list that still conflicts with testimony.": {
    en: "Do not certify a guest list that still conflicts with testimony.",
    "zh-CN": "仍与证词冲突的来客名单，不要盖章。",
  },
  "Hold the glow band across the bridge approach.": {
    en: "Hold the glow band across the bridge approach.",
    "zh-CN": "把桥头一线的灯带稳住。",
  },
  "Keep the granary alley visible during handoff.": {
    en: "Keep the granary alley visible during handoff.",
    "zh-CN": "交接时也要让粮仓小巷保持可见。",
  },
  "No one crosses the gate on a verbal promise tonight.": {
    en: "No one crosses the gate on a verbal promise tonight.",
    "zh-CN": "今晚谁也不能只凭口头承诺过门。",
  },
  "If the host list moves, the watch board must move first.": {
    en: "If the host list moves, the watch board must move first.",
    "zh-CN": "房主名单若有变动，守夜牌板必须先改。",
  },
  "The guest list must match what the watch can defend.": {
    en: "The guest list must match what the watch can defend.",
    "zh-CN": "来客名单必须与守夜能担保的范围一致。",
  },
  "A sealed slate is stronger than a shouted oath.": {
    en: "A sealed slate is stronger than a shouted oath.",
    "zh-CN": "一块封好的板簿，比喊出来的誓言更可靠。",
  },
  "A proper gift is cheaper than a failed crossing.": {
    en: "A proper gift is cheaper than a failed crossing.",
    "zh-CN": "一份得体的礼，比一次失败的过桥更便宜。",
  },
  "Merchants notice when the route stutters twice in a row.": {
    en: "Merchants notice when the route stutters twice in a row.",
    "zh-CN": "路线若接连两次卡顿，商人一定会察觉。",
  },
  "Count independent classes, not louder voices.": {
    en: "Count independent classes, not louder voices.",
    "zh-CN": "要数独立证据类别，不要数谁嗓门更大。",
  },
  "A seal only matters if the archive can defend it tomorrow.": {
    en: "A seal only matters if the archive can defend it tomorrow.",
    "zh-CN": "一枚印记只有在明天还能被档案证明时才有意义。",
  },
  "A bright hall calms faster than a closed door.": {
    en: "A bright hall calms faster than a closed door.",
    "zh-CN": "明亮的厅堂，比一扇紧闭的门更能让人冷静。",
  },
  "Do not let faction promises outrun stock counts.": {
    en: "Do not let faction promises outrun stock counts.",
    "zh-CN": "别让派系承诺跑在库存数字前面。",
  },
  "Trade safety is a stronger argument than pride tonight.": {
    en: "Trade safety is a stronger argument than pride tonight.",
    "zh-CN": "今夜拿交易安全说话，比争面子更有力。",
  },
  "The guild wins if the queue stays orderly.": {
    en: "The guild wins if the queue stays orderly.",
    "zh-CN": "只要队列保持有序，行会就算赢。",
  },
  "Shortcuts are expensive when the bridge is listening.": {
    en: "Shortcuts are expensive when the bridge is listening.",
    "zh-CN": "桥在听着的时候，抄近道代价很高。",
  },
  "A true route remembers who prepared the parcel.": {
    en: "A true route remembers who prepared the parcel.",
    "zh-CN": "一条真实的路线会记得是谁备的包。",
  },
  "A lawful recovery is stronger than a fast apology.": {
    en: "A lawful recovery is stronger than a fast apology.",
    "zh-CN": "依法补救，比匆忙道歉更有力。",
  },
  "Any exception must survive dawn review.": {
    en: "Any exception must survive dawn review.",
    "zh-CN": "任何例外都必须经得起黎明复盘。",
  },
  "A true name is safer than a tidy omission.": {
    en: "A true name is safer than a tidy omission.",
    "zh-CN": "一个真实姓名，比看似整洁的删略更安全。",
  },
  "The archive should outlast tonight's bargaining.": {
    en: "The archive should outlast tonight's bargaining.",
    "zh-CN": "档案应当比今夜的讨价还价活得更久。",
  },
  "Hold the lane until the archive and watch agree.": {
    en: "Hold the lane until the archive and watch agree.",
    "zh-CN": "先按住这条路，直到档案与守夜意见一致。",
  },
  "A visible route is safer than a fast hidden shortcut.": {
    en: "A visible route is safer than a fast hidden shortcut.",
    "zh-CN": "一条看得见的路，比一条快却藏着的近道更安全。",
  },
  Clarity: {
    en: "Clarity",
    "zh-CN": "明晰",
  },
  Quiet: {
    en: "Quiet",
    "zh-CN": "安静",
  },
  Tea: {
    en: "Tea",
    "zh-CN": "茶水",
  },
  Rest: {
    en: "Rest",
    "zh-CN": "休息",
  },
  "Fuel buffer": {
    en: "Fuel buffer",
    "zh-CN": "燃料余量",
  },
  "Warm meal": {
    en: "Warm meal",
    "zh-CN": "热食",
  },
  Shelter: {
    en: "Shelter",
    "zh-CN": "遮蔽",
  },
  Trust: {
    en: "Trust",
    "zh-CN": "信任",
  },
  Food: {
    en: "Food",
    "zh-CN": "食物",
  },
  Certainty: {
    en: "Certainty",
    "zh-CN": "确定性",
  },
  Patience: {
    en: "Patience",
    "zh-CN": "耐心",
  },
  Supplies: {
    en: "Supplies",
    "zh-CN": "补给",
  },
  Focus: {
    en: "Focus",
    "zh-CN": "专注",
  },
  Paper: {
    en: "Paper",
    "zh-CN": "纸张",
  },
  Sleep: {
    en: "Sleep",
    "zh-CN": "睡眠",
  },
  Order: {
    en: "Order",
    "zh-CN": "秩序",
  },
  Leverage: {
    en: "Leverage",
    "zh-CN": "筹码",
  },
  Warmth: {
    en: "Warmth",
    "zh-CN": "暖意",
  },
  Legitimacy: {
    en: "Legitimacy",
    "zh-CN": "正当性",
  },
  Light: {
    en: "Light",
    "zh-CN": "光亮",
  },
  Silence: {
    en: "Silence",
    "zh-CN": "安静",
  },
});

export function localizeShellFixtureText(locale: LocaleId, source: string): string {
  const entry = SHELL_FIXTURE_TEXT[source];
  return entry === undefined ? source : entry[locale];
}

export function localizeShellLastInputLabel(locale: LocaleId, source: string): string {
  if (source === "Booting shell") {
    return formatMessage(locale, "ui.input.booting");
  }

  if (source === "Ready") {
    return formatMessage(locale, "ui.input.ready");
  }

  if (source === "Canvas pointer") {
    return formatMessage(locale, "ui.input.pointer");
  }

  if (source.startsWith("Canvas inspect ")) {
    const coordinates = source.slice("Canvas inspect ".length);
    const [x, y] = coordinates.split(",");
    if (x !== undefined && y !== undefined) {
      return formatMessage(locale, "ui.input.inspect", {
        x: x.trim(),
        y: y.trim(),
      });
    }
  }

  if (source.startsWith("Canvas select ")) {
    const entityId = source.slice("Canvas select ".length).trim();
    return formatMessage(locale, "ui.input.select", {
      target: localizeShellFixtureText(locale, readEntityNameFromId(entityId)),
    });
  }

  if (source.startsWith("Wheel zoom ")) {
    return formatMessage(locale, "ui.input.zoom", {
      zoom: source.slice("Wheel zoom ".length).trim(),
    });
  }

  if (source.startsWith("Keyboard ")) {
    return formatMessage(locale, "ui.input.keyboard", {
      code: source.slice("Keyboard ".length).trim(),
    });
  }

  if (source.startsWith("Loaded ")) {
    return formatMessage(locale, "ui.input.loaded", {
      label: localizeShellLastInputLabel(locale, source.slice("Loaded ".length)),
    });
  }

  return source;
}

export function validateShellFixtureLocalization(
  readModel: WorldReadModel,
): readonly LocalizationValidationIssue[] {
  const issues: LocalizationValidationIssue[] = [];
  const auditedStrings = new Set<string>();

  auditedStrings.add(readModel.mapName);
  auditedStrings.add(readModel.town.settlementName);
  auditedStrings.add(readModel.town.phaseLabel);
  auditedStrings.add(readModel.town.cycleLabel);
  auditedStrings.add(readModel.town.speedLabel);

  for (const alert of readModel.town.alerts) {
    auditedStrings.add(alert.label);
    auditedStrings.add(alert.detail);
  }

  for (const resource of readModel.town.resources) {
    auditedStrings.add(resource.label);
    auditedStrings.add(resource.unit);
  }

  for (const entity of readModel.entities) {
    auditedStrings.add(entity.displayName);
    auditedStrings.add(entity.summary);
    auditedStrings.add(entity.inspector.roleLabel);
    auditedStrings.add(entity.inspector.currentJob);
    auditedStrings.add(entity.inspector.currentStep);
    auditedStrings.add(entity.inspector.moodLabel);
    auditedStrings.add(entity.inspector.healthLabel);
    auditedStrings.add(entity.inspector.lastDecision);

    for (const explainer of entity.inspector.explainers) {
      auditedStrings.add(explainer);
    }

    for (const thought of entity.inspector.thoughts) {
      auditedStrings.add(thought);
    }

    for (const need of entity.inspector.needs) {
      auditedStrings.add(need.label);
    }
  }

  for (const source of auditedStrings) {
    const entry = SHELL_FIXTURE_TEXT[source];
    if (entry === undefined) {
      issues.push({
        issue: "missing_shell_fixture_translation",
        key: source,
        locale: "en",
      });
      issues.push({
        issue: "missing_shell_fixture_translation",
        key: source,
        locale: "zh-CN",
      });
      continue;
    }

    for (const locale of ["en", "zh-CN"] as const) {
      if (entry[locale].trim().length === 0) {
        issues.push({
          issue: "blank_shell_fixture_translation",
          key: source,
          locale,
        });
      }
    }
  }

  return issues;
}

function readEntityNameFromId(entityId: string): string {
  switch (entityId) {
    case "chronicler-lin":
      return "Chronicler Lin";
    case "lantern-keeper-shen":
      return "Lantern Keeper Shen";
    case "night-watch-qiao":
      return "Watch Lead Qiao";
    case "guesthouse-ren":
      return "Host Ren";
    case "bridge-runner-su":
      return "Bridge Runner Su";
    case "registry-bo":
      return "Registry Clerk Bo";
    case "medic-fan":
      return "Medic Fan";
    case "guild-agent-mei":
      return "Guild Agent Mei";
    case "contract-guide-yi":
      return "Guide Yi";
    case "council-lampkeeper-hou":
      return "Council Seat Hou";
    case "archivist-sun":
      return "Archivist Sun";
    default:
      return entityId;
  }
}
