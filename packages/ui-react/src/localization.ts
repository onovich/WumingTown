export const SUPPORTED_LOCALES = ["zh-CN", "en"] as const;

export type LocaleId = (typeof SUPPORTED_LOCALES)[number];
export type LocaleSource = "system" | "manual";
export type LocalizationNamespace = "content" | "dev" | "reason" | "ui";
export type LocalePersistenceDiagnosticCode =
  | "none"
  | "preference_invalid"
  | "storage_unavailable"
  | "write_failed";
export type LocalePersistenceMode = "persistent" | "session-only";

export interface LocalePreferenceV1 {
  readonly version: 1;
  readonly source: LocaleSource;
  readonly manualLocale?: LocaleId;
}

export interface LocalePersistenceState {
  readonly diagnosticCode: LocalePersistenceDiagnosticCode;
  readonly mode: LocalePersistenceMode;
}

export interface ShellLocaleState {
  readonly resolvedLocale: LocaleId;
  readonly source: LocaleSource;
  readonly manualLocale: LocaleId | undefined;
  readonly systemLocale: LocaleId;
  readonly persistence: LocalePersistenceState;
}

export interface LocaleStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface NavigatorLanguageLike {
  readonly language?: string;
  readonly languages?: readonly string[];
}

export interface LocalePreferenceLoadResult {
  readonly persistence: LocalePersistenceState;
  readonly preference: LocalePreferenceV1;
}

export interface LocalePreferenceWriteResult {
  readonly persistence: LocalePersistenceState;
  readonly preference: LocalePreferenceV1;
}

export interface LocalizationValidationIssue {
  readonly issue: string;
  readonly key: string;
  readonly locale?: LocaleId;
}

const EN_MESSAGES = {
  "dev.releaseGate.title": "Web Product Gate",
  "ui.alert.severity.danger": "Danger",
  "ui.alert.severity.stable": "Stable",
  "ui.alert.severity.warning": "Warning",
  "ui.mainMenu.action.back": "Back",
  "ui.mainMenu.action.continue": "Continue",
  "ui.mainMenu.action.continuePending": "Continuing...",
  "ui.mainMenu.action.newGame": "New Game",
  "ui.mainMenu.action.settings": "Settings",
  "ui.mainMenu.aria": "Main menu",
  "ui.mainMenu.badge": "Main menu",
  "ui.mainMenu.continue.empty": "Continue becomes available after a local save exists.",
  "ui.mainMenu.continue.ready": "Continue resumes the latest local town record on this device.",
  "ui.mainMenu.cycle": "Season",
  "ui.mainMenu.cycleHint":
    "Use the current season and watchpoint to judge how much pressure is building.",
  "ui.mainMenu.firstPlay.action.continue":
    "Continue: available only when a local save exists; otherwise it stays disabled.",
  "ui.mainMenu.firstPlay.action.newGame":
    "New Game: enter the town view and inspect the current pressure before acting.",
  "ui.mainMenu.firstPlay.action.settings":
    "Settings: choose zh-CN or English presentation and adjust UI scale without changing simulation authority.",
  "ui.mainMenu.firstPlay.actions": "Available actions",
  "ui.mainMenu.firstPlay.boundary":
    "Player guidance is separate from developer diagnostics; debug information appears only when diagnostics mode is explicitly enabled.",
  "ui.mainMenu.firstPlay.boundaryTitle": "Boundary",
  "ui.mainMenu.firstPlay.nextGoal": "Next goal",
  "ui.mainMenu.firstPlay.nextGoal.dangerDetail":
    "Start from visible warnings, resident state, Chronicle evidence, and obligations before choosing a response.",
  "ui.mainMenu.firstPlay.nextGoal.dangerTitle": "Resolve the visible danger",
  "ui.mainMenu.firstPlay.nextGoal.lanternDetail":
    "Check lamp coverage, route evidence, and night-watch obligations before assigning patrol or supply work.",
  "ui.mainMenu.firstPlay.nextGoal.lanternTitle": "Close the lamp coverage gap",
  "ui.mainMenu.firstPlay.nextGoal.none": "No urgent goal is blocking the town right now.",
  "ui.mainMenu.firstPlay.nextGoal.noneDetail":
    "Start by inspecting the phase, resident state, lamp pressure, Chronicle evidence, and obligations.",
  "ui.mainMenu.firstPlay.nextGoal.stableDetail":
    "Use the map, resident state, and watchpoints to choose the next safe action.",
  "ui.mainMenu.firstPlay.nextGoal.stableTitle": "Choose the next safe action",
  "ui.mainMenu.firstPlay.nextGoal.warningDetail":
    "Review visible clues, counterevidence, lamp coverage, and social obligations before committing.",
  "ui.mainMenu.firstPlay.nextGoal.warningTitle": "Review the visible warning",
  "ui.mainMenu.firstPlay.phase": "How to read this phase",
  "ui.mainMenu.firstPlay.title": "First-play guidance",
  "ui.mainMenu.language": "Presentation language",
  "ui.mainMenu.language.system": "Follow system",
  "ui.mainMenu.languageHint":
    "Language changes update shell UI immediately and stay local to this device profile.",
  "ui.mainMenu.phase": "Current phase",
  "ui.mainMenu.phaseHint": "Check the phase first, then decide whether to start fresh or continue.",
  "ui.mainMenu.phaseLabel.dawn": "Dawn review",
  "ui.mainMenu.phaseLabel.day": "Day work",
  "ui.mainMenu.phaseLabel.default": "Current town phase",
  "ui.mainMenu.phaseLabel.dusk": "Dusk watch",
  "ui.mainMenu.phaseLabel.night": "Night watch",
  "ui.mainMenu.settings.hint":
    "Language and UI scale changes never change simulation authority and are stored in local app settings only.",
  "ui.mainMenu.settings.summary":
    "Choose language and UI scale before entering the town view. These settings affect presentation only.",
  "ui.mainMenu.settings.title": "Display settings",
  "ui.mainMenu.summary":
    "Read the current phase and next pressure, then start a new session or continue the latest local record.",
  "ui.input.booting": "Shell starting",
  "ui.input.cameraDrag": "Drag pan",
  "ui.input.cameraReset": "Camera reset",
  "ui.input.inspect": "Inspect tile {x},{y}",
  "ui.input.keyboard": "Keyboard {code}",
  "ui.input.loaded": "Loaded {label}",
  "ui.input.pointer": "Canvas pointer",
  "ui.input.ready": "Ready",
  "ui.input.select": "Selected {target}",
  "ui.input.actionQueued": "Queued {commandId}",
  "ui.input.zoom": "Zoom {zoom}",
  "ui.inspector.aria": "Selected entity inspector",
  "ui.inspector.currentJob": "Current job",
  "ui.inspector.currentStep": "Current step",
  "ui.inspector.decision": "Decision",
  "ui.inspector.health": "Health",
  "ui.inspector.lastInput": "Last input",
  "ui.inspector.location": "{kind} · {tileLabel} {x},{y}",
  "ui.inspector.mood": "Mood",
  "ui.inspector.needSummary": "{label}: {value}% · {state}",
  "ui.inspector.needs": "Needs",
  "ui.inspector.noSelection.body":
    "Use the map to inspect a resident, structure, lantern post, or visitor.",
  "ui.inspector.noSelection.title": "No selection",
  "ui.inspector.roleSummary": "{role} · {summary}",
  "ui.inspector.selected": "Selected entity",
  "ui.inspector.terrain": "Terrain",
  "ui.inspector.terrainUnknown": "Unknown terrain",
  "ui.inspector.thoughts": "Thoughts",
  "ui.inspector.tile": "tile",
  "ui.inspector.tileFocus": "map tile",
  "ui.inspector.tileInspection": "Tile inspection",
  "ui.inspector.tileInspection.body":
    "No resident or object is selected. This tile is the current inspection focus.",
  "ui.inspector.why": "Why this matters",
  "ui.terrain.brush": "Brush",
  "ui.terrain.earth": "Earth",
  "ui.terrain.lanternGlow": "Lantern glow",
  "ui.terrain.path": "Path",
  "ui.terrain.water": "Water",
  "ui.entityKind.lanternKeeper": "lantern keeper",
  "ui.entityKind.resident": "resident",
  "ui.entityKind.structure": "structure",
  "ui.entityKind.visitor": "visitor",
  "ui.hud.aria": "Player HUD",
  "ui.hud.actionFeedback.body":
    "{target} is marked for lamp-priority review. This local adapter is traceable shell state, not world authority.",
  "ui.hud.actionFeedback.commandId": "Command id: {commandId}",
  "ui.hud.actionFeedback.reason": "Reason: {reasonCode}",
  "ui.hud.actionFeedback.title": "Local action queued",
  "ui.hud.command.lamp": "Prioritize lamp work",
  "ui.hud.command.chronicle": "Chronicle slips",
  "ui.hud.command.inspect": "Inspector notes",
  "ui.hud.command.placeholder.chronicle":
    "Placeholder slot only. Chronicle command wiring stays in a later gameplay task.",
  "ui.hud.command.placeholder.inspect":
    "Placeholder slot only. Selection actions remain read-model detail until later command work lands.",
  "ui.hud.command.placeholder.lamp":
    "Placeholder slot only. Lamp-path command wiring stays gated to later interaction work.",
  "ui.hud.command.playable.lamp.needsSelection":
    "Select a lantern keeper or lamp-relevant object to queue this local action.",
  "ui.hud.command.playable.lamp.queued": "Local lamp-priority action is queued for {target}.",
  "ui.hud.command.playable.lamp.ready": "Queue local lamp-priority work for {target}.",
  "ui.hud.commandBar": "Command bar",
  "ui.hud.commandBarHint":
    "One traceable local action can be queued for review; world authority remains in the Simulation Worker.",
  "ui.hud.currentState": "Current state",
  "ui.hud.cycle": "Cycle",
  "ui.hud.events": "Events and watchpoints",
  "ui.hud.eventsHint": "What may demand attention before night closes.",
  "ui.hud.map": "Map",
  "ui.hud.nextGoal": "Next goal",
  "ui.hud.nextGoal.none": "No urgent goal is blocking the town right now.",
  "ui.hud.nextGoal.noneDetail":
    "Use the map, resident state, and watchpoints to choose the next safe action.",
  "ui.hud.nightRisk": "Night risk",
  "ui.hud.nightRisk.breach": "Breach",
  "ui.hud.nightRisk.noneDetected": "No high-pressure warning is active.",
  "ui.hud.nightRisk.stable": "Stable",
  "ui.hud.nightRisk.strained": "Strained",
  "ui.hud.nightRisk.watch": "Watch",
  "ui.hud.phase": "Phase",
  "ui.hud.phaseMeaning.dawn":
    "Review injuries, evidence, and social consequences before assigning full work.",
  "ui.hud.phaseMeaning.day":
    "Build, produce, investigate, and repair while routes are easiest to explain.",
  "ui.hud.phaseMeaning.default":
    "Read the town state first, then act through visible goals and structured reasons.",
  "ui.hud.phaseMeaning.dusk":
    "Prepare lamps, routes, guests, and ordinances before the boundary tightens.",
  "ui.hud.phaseMeaning.night":
    "Hold the boundary, resolve pressure, and avoid hidden-cost reactions.",
  "ui.hud.phaseRiskSummary": "{phaseMeaning} · {nightRiskLabel}: {nightRisk}",
  "ui.hud.residentStep": "{role} · {step}",
  "ui.hud.resourceTrend.falling": "falling",
  "ui.hud.resourceTrend.rising": "rising",
  "ui.hud.resourceTrend.steady": "steady",
  "ui.hud.residentSteady": "Steady",
  "ui.hud.residents": "Residents to watch",
  "ui.hud.residentsHint": "Visible social or need pressure tied to tonight's work.",
  "ui.hud.selected": "Selected detail",
  "ui.hud.speed": "Speed",
  "ui.hud.tasks": "Current tasks",
  "ui.hud.tasksHint": "Work already shaping the next safe move.",
  "ui.need.state.high": "high",
  "ui.need.state.low": "low",
  "ui.need.state.steady": "steady",
  "ui.onboarding.aria": "First-play guidance",
  "ui.onboarding.authority": "Authority",
  "ui.onboarding.copyLimit.privacy":
    "Privacy limit: no telemetry, accounts, paid service, crash upload or public feedback flow.",
  "ui.onboarding.copyLimit.release":
    "Release limit: Web remains demo-only; Windows remains unsigned controlled external test.",
  "ui.onboarding.copyLimit.save":
    "Save limit: public save compatibility remains draft and gated until owner approval.",
  "ui.onboarding.copyLimit.scope":
    "Copy limit: explains the current shell surface only; full M8 content localization is tracked separately.",
  "ui.onboarding.release": "Release",
  "ui.onboarding.scopeLabel": "First-play guidance",
  "ui.onboarding.step1.body":
    "Confirm the shell is ready, then inspect the current phase, goals, alerts, and selected resident details before changing plans.",
  "ui.onboarding.step1.title": "Read the town state first",
  "ui.onboarding.step2.body":
    "Use display settings to choose zh-CN or English and increase UI scale. This changes shell presentation only and never changes simulation authority or saves.",
  "ui.onboarding.step2.title": "Choose language and shell scale",
  "ui.onboarding.step3.body":
    "Treat reasons, alerts, and evidence as structured explanations. Diagnostics stay outside the default player HUD unless explicitly opened.",
  "ui.onboarding.step3.title": "Follow evidence, not hidden truth",
  "ui.onboarding.summary":
    "Start from the current phase, next pressure, resident state, and structured reasons before using any debug-only tools.",
  "ui.onboarding.title": "M8 first-run path",
  "ui.settings.aria": "Display settings",
  "ui.settings.currentLocale": "Current locale: {locale}",
  "ui.settings.displayBoundary":
    "These shell display settings change text and HUD chrome only. They never change simulation authority, save schema, or Pixi world zoom.",
  "ui.settings.description":
    "Choose how player-facing shell chrome is presented, including language and display scale. These preferences stay local to the app shell.",
  "ui.settings.language": "Language",
  "ui.settings.option.system": "Follow system ({locale})",
  "ui.settings.persistence.preference_invalid":
    "Saved language settings were invalid and were reset to system mode.",
  "ui.settings.persistence.ready": "Saved in local app settings.",
  "ui.settings.persistence.storage_unavailable":
    "Local settings storage is unavailable. This choice will last for this session only.",
  "ui.settings.persistence.write_failed":
    "The language changed, but saving the preference failed. This choice will last for this session only.",
  "ui.settings.scale": "UI scale",
  "ui.settings.scale.current": "Current scale: {scale}",
  "ui.settings.scale.description":
    "Increase player-facing text and shell chrome size without changing the authoritative world view.",
  "ui.settings.scale.option.extra-large": "Extra large (120%)",
  "ui.settings.scale.option.large": "Large (110%)",
  "ui.settings.scale.option.standard": "Standard (100%)",
  "ui.settings.scale.persistence.preference_invalid":
    "Saved UI scale settings were invalid and were reset to Standard.",
  "ui.settings.scale.persistence.ready": "Saved in local app settings.",
  "ui.settings.scale.persistence.storage_unavailable":
    "Local settings storage is unavailable. This UI scale will last for this session only.",
  "ui.settings.scale.persistence.write_failed":
    "The UI scale changed, but saving the preference failed. This UI scale will last for this session only.",
  "ui.settings.source.manual": "Source: manual override",
  "ui.settings.source.system": "Source: system preference",
  "ui.settings.title": "Display settings",
  "ui.surface.alerts": "Town alerts",
  "ui.surface.topBar": "Town status",
  "ui.surface.topBarMeta": "{cycle} | {map} | {speed}",
} as const satisfies Record<string, string>;

const ZH_CN_MESSAGES = {
  "ui.alert.severity.danger": "危险",
  "ui.alert.severity.stable": "稳定",
  "ui.alert.severity.warning": "警戒",
  "ui.mainMenu.action.back": "返回",
  "ui.mainMenu.action.continue": "继续",
  "ui.mainMenu.action.continuePending": "继续中……",
  "ui.mainMenu.action.newGame": "新游戏",
  "ui.mainMenu.action.settings": "设置",
  "ui.mainMenu.aria": "主菜单",
  "ui.mainMenu.badge": "主菜单",
  "ui.mainMenu.continue.empty": "存在本地存档后即可使用继续。",
  "ui.mainMenu.continue.ready": "继续会载入这台设备上最近一次本地城镇记录。",
  "ui.mainMenu.cycle": "时序",
  "ui.mainMenu.cycleHint": "可结合当前时序与警戒态势，判断城镇压力正在如何积累。",
  "ui.mainMenu.firstPlay.action.continue": "继续：仅在存在本地存档时可用；否则会保持禁用。",
  "ui.mainMenu.firstPlay.action.newGame": "新游戏：进入城镇视图，先观察当前压力，再决定如何行动。",
  "ui.mainMenu.firstPlay.action.settings":
    "设置：选择简体中文或英文界面，并调整界面缩放，不改变模拟权威。",
  "ui.mainMenu.firstPlay.actions": "可用行动",
  "ui.mainMenu.firstPlay.boundary": "玩家引导与开发诊断分离；调试信息仅在显式诊断模式中显示。",
  "ui.mainMenu.firstPlay.boundaryTitle": "边界",
  "ui.mainMenu.firstPlay.nextGoal": "下一目标",
  "ui.mainMenu.firstPlay.nextGoal.dangerDetail":
    "先依据可见警报、居民状态、镇志证据与义务关系，再选择应对方式。",
  "ui.mainMenu.firstPlay.nextGoal.dangerTitle": "处理可见危险",
  "ui.mainMenu.firstPlay.nextGoal.lanternDetail":
    "先确认灯火覆盖、路线证据与守夜义务，再安排巡灯或补给。",
  "ui.mainMenu.firstPlay.nextGoal.lanternTitle": "补上灯火缺口",
  "ui.mainMenu.firstPlay.nextGoal.none": "当前没有紧急事项阻塞城镇。",
  "ui.mainMenu.firstPlay.nextGoal.noneDetail":
    "先查看阶段、居民状态、灯火压力、镇志证据与义务关系。",
  "ui.mainMenu.firstPlay.nextGoal.stableDetail":
    "可结合地图、居民状态与观察点，选择下一步稳妥行动。",
  "ui.mainMenu.firstPlay.nextGoal.stableTitle": "选择下一步稳妥行动",
  "ui.mainMenu.firstPlay.nextGoal.warningDetail":
    "先复核可见线索、反证、灯火覆盖与社会义务，再决定是否行动。",
  "ui.mainMenu.firstPlay.nextGoal.warningTitle": "复核可见警戒",
  "ui.mainMenu.firstPlay.phase": "如何阅读当前阶段",
  "ui.mainMenu.firstPlay.title": "首次游玩指引",
  "ui.mainMenu.language": "界面语言",
  "ui.mainMenu.language.system": "跟随系统",
  "ui.mainMenu.languageHint": "语言切换会立即更新壳层界面，并仅保存在当前设备配置中。",
  "ui.mainMenu.phase": "当前阶段",
  "ui.mainMenu.phaseHint": "先确认当前阶段，再决定开始新局还是继续本地进度。",
  "ui.mainMenu.phaseLabel.dawn": "黎明复盘",
  "ui.mainMenu.phaseLabel.day": "日间工作",
  "ui.mainMenu.phaseLabel.default": "当前城镇阶段",
  "ui.mainMenu.phaseLabel.dusk": "黄昏守望",
  "ui.mainMenu.phaseLabel.night": "夜间守望",
  "ui.mainMenu.settings.hint": "语言与界面缩放切换不会改变模拟权威，只会写入本地应用设置。",
  "ui.mainMenu.settings.summary":
    "进入城镇视图前，可在这里确认语言与界面缩放；这些设置只影响呈现，不改变模拟。",
  "ui.mainMenu.settings.title": "显示设置",
  "ui.mainMenu.summary": "先阅读当前阶段与下一处压力，再开始新局或继续最近一次本地记录。",
  "ui.input.booting": "外壳启动中",
  "ui.input.cameraDrag": "拖拽平移",
  "ui.input.cameraReset": "相机复位",
  "ui.input.inspect": "查看地块 {x},{y}",
  "ui.input.keyboard": "键盘 {code}",
  "ui.input.loaded": "已载入：{label}",
  "ui.input.pointer": "画布指针",
  "ui.input.ready": "就绪",
  "ui.input.select": "已选中：{target}",
  "ui.input.actionQueued": "已排入：{commandId}",
  "ui.input.zoom": "缩放 {zoom}",
  "ui.inspector.aria": "已选对象信息",
  "ui.inspector.currentJob": "当前工作",
  "ui.inspector.currentStep": "当前步骤",
  "ui.inspector.decision": "最近决策",
  "ui.inspector.health": "健康",
  "ui.inspector.lastInput": "最近输入",
  "ui.inspector.location": "{kind} · {tileLabel} {x},{y}",
  "ui.inspector.mood": "心情",
  "ui.inspector.needSummary": "{label}：{value}% · {state}",
  "ui.inspector.needs": "需求",
  "ui.inspector.noSelection.body": "在地图上选择居民、设施、灯柱或访客以查看详情。",
  "ui.inspector.noSelection.title": "尚未选择对象",
  "ui.inspector.roleSummary": "{role} · {summary}",
  "ui.inspector.selected": "已选对象",
  "ui.inspector.terrain": "地形",
  "ui.inspector.terrainUnknown": "未知地形",
  "ui.inspector.thoughts": "当前想法",
  "ui.inspector.tile": "地块",
  "ui.inspector.tileFocus": "地图地块",
  "ui.inspector.tileInspection": "地块查看",
  "ui.inspector.tileInspection.body": "当前未选中居民或地图对象。该地块是当前的查看焦点。",
  "ui.inspector.why": "原因说明",
  "ui.terrain.brush": "荒草",
  "ui.terrain.earth": "土地",
  "ui.terrain.lanternGlow": "灯光覆盖",
  "ui.terrain.path": "道路",
  "ui.terrain.water": "水域",
  "ui.entityKind.lanternKeeper": "守灯人",
  "ui.entityKind.resident": "居民",
  "ui.entityKind.structure": "设施",
  "ui.entityKind.visitor": "访客",
  "ui.hud.aria": "玩家 HUD",
  "ui.hud.actionFeedback.body":
    "{target} 已标记为补灯优先复核。该本地适配器只是可追踪的外壳状态，不是世界权威。",
  "ui.hud.actionFeedback.commandId": "命令编号：{commandId}",
  "ui.hud.actionFeedback.reason": "原因：{reasonCode}",
  "ui.hud.actionFeedback.title": "本地行动已排入",
  "ui.hud.command.lamp": "优先补灯",
  "ui.hud.command.chronicle": "镇志槽位",
  "ui.hud.command.inspect": "查看槽位",
  "ui.hud.command.placeholder.chronicle": "这里只提供视觉槽位；镇志命令接线留待后续玩法任务实现。",
  "ui.hud.command.placeholder.inspect":
    "这里只提供视觉槽位；选中对象的行动仍保持只读详情，等待后续命令接线。",
  "ui.hud.command.placeholder.lamp": "这里只提供视觉槽位；灯路相关命令仍由后续交互任务接线。",
  "ui.hud.command.playable.lamp.needsSelection": "选择守灯人或灯路相关对象后，可排入这条本地行动。",
  "ui.hud.command.playable.lamp.queued": "已为 {target} 排入本地补灯优先行动。",
  "ui.hud.command.playable.lamp.ready": "为 {target} 排入本地补灯优先行动。",
  "ui.hud.commandBar": "命令带",
  "ui.hud.commandBarHint": "可排入一条可追踪本地行动供复核；世界权威仍属于 Simulation Worker。",
  "ui.hud.currentState": "当前状态",
  "ui.hud.cycle": "时序",
  "ui.hud.events": "事件与观察点",
  "ui.hud.eventsHint": "夜幕收紧前，哪些事项需要留意。",
  "ui.hud.map": "地图",
  "ui.hud.nextGoal": "下一目标",
  "ui.hud.nextGoal.none": "当前没有紧急事项阻塞城镇。",
  "ui.hud.nextGoal.noneDetail": "可结合地图、居民状态与观察点，选择下一步的稳妥行动。",
  "ui.hud.nightRisk": "夜间风险",
  "ui.hud.nightRisk.breach": "失守",
  "ui.hud.nightRisk.noneDetected": "当前没有高压警报。",
  "ui.hud.nightRisk.stable": "稳定",
  "ui.hud.nightRisk.strained": "吃紧",
  "ui.hud.nightRisk.watch": "警戒",
  "ui.hud.phase": "阶段",
  "ui.hud.phaseMeaning.dawn": "先复盘伤势、证据与社会后果，再安排全天工作。",
  "ui.hud.phaseMeaning.day": "趁路线最容易解释时，推进建造、生产、调查与修复。",
  "ui.hud.phaseMeaning.default": "先读懂城镇状态，再依据可见目标与结构化原因行动。",
  "ui.hud.phaseMeaning.dusk": "在边界收紧前，准备灯火、路线、旅客与镇规。",
  "ui.hud.phaseMeaning.night": "守住边界，处理压力，避免付出隐藏代价的过激反应。",
  "ui.hud.phaseRiskSummary": "{phaseMeaning} · {nightRiskLabel}：{nightRisk}",
  "ui.hud.residentStep": "{role} · {step}",
  "ui.hud.resourceTrend.falling": "下降",
  "ui.hud.resourceTrend.rising": "上升",
  "ui.hud.resourceTrend.steady": "平稳",
  "ui.hud.residentSteady": "平稳",
  "ui.hud.residents": "需要留意的居民",
  "ui.hud.residentsHint": "与今夜工作相关、且已显露的社会或需求压力。",
  "ui.hud.selected": "已选详情",
  "ui.hud.speed": "速度",
  "ui.hud.tasks": "当前任务",
  "ui.hud.tasksHint": "已经在塑造下一步稳妥行动的工作。",
  "ui.need.state.high": "高",
  "ui.need.state.low": "低",
  "ui.need.state.steady": "平稳",
  "ui.onboarding.aria": "首次游玩指引",
  "ui.onboarding.authority": "权威边界",
  "ui.onboarding.copyLimit.privacy":
    "隐私限制：不包含遥测、账号、付费服务、崩溃上传或公开反馈流程。",
  "ui.onboarding.copyLimit.release":
    "发布限制：Web 仍为演示用途；Windows 仍为未签名的受控外部测试。",
  "ui.onboarding.copyLimit.save": "存档限制：公开存档兼容性仍为草案，且需通过后续闸门审核。",
  "ui.onboarding.copyLimit.scope":
    "文案范围：这里只说明当前壳层界面；完整 M8 内容翻译另有任务负责。",
  "ui.onboarding.release": "发布边界",
  "ui.onboarding.scopeLabel": "首次游玩指引",
  "ui.onboarding.step1.body":
    "先确认外壳已就绪，再查看当前时段、主要压力、警报与选中居民详情，然后再调整计划。",
  "ui.onboarding.step1.title": "先读懂城镇状态",
  "ui.onboarding.step2.body":
    "可在此切换简体中文或英文，并放大界面缩放。它只改变壳层呈现，不会改变模拟权威或存档。",
  "ui.onboarding.step2.title": "选择语言与壳层缩放",
  "ui.onboarding.step3.body":
    "把原因、警报与证据视为结构化说明。诊断信息默认不会出现在玩家 HUD，除非显式开启。",
  "ui.onboarding.step3.title": "依据证据而非隐藏真相",
  "ui.onboarding.summary":
    "先从当前时段、主要压力、居民状态与结构化原因入手，再使用任何调试专用工具。",
  "ui.onboarding.title": "M8 首次游玩路径",
  "ui.settings.aria": "显示设置",
  "ui.settings.currentLocale": "当前语言：{locale}",
  "ui.settings.displayBoundary":
    "这些壳层显示设置只会改变文字与 HUD 外观，不会改变模拟权威、存档格式或 Pixi 世界缩放。",
  "ui.settings.description":
    "选择玩家可见壳层界面的显示方式，包括语言与界面缩放。这些偏好仅保存在应用壳层本地。",
  "ui.settings.language": "语言",
  "ui.settings.option.system": "跟随系统（{locale}）",
  "ui.settings.persistence.preference_invalid": "已保存的语言设置无效，现已恢复为跟随系统。",
  "ui.settings.persistence.ready": "已保存在本地应用设置中。",
  "ui.settings.persistence.storage_unavailable": "本地设置存储不可用。本次选择仅在当前会话内生效。",
  "ui.settings.persistence.write_failed":
    "语言已切换，但保存偏好失败。本次选择仅在当前会话内生效。",
  "ui.settings.scale": "界面缩放",
  "ui.settings.scale.current": "当前缩放：{scale}",
  "ui.settings.scale.description": "放大玩家可见文字与壳层外观，但不会改变权威世界视图。",
  "ui.settings.scale.option.extra-large": "特大（120%）",
  "ui.settings.scale.option.large": "大（110%）",
  "ui.settings.scale.option.standard": "标准（100%）",
  "ui.settings.scale.persistence.preference_invalid": "已保存的界面缩放设置无效，现已恢复为标准。",
  "ui.settings.scale.persistence.ready": "已保存在本地应用设置中。",
  "ui.settings.scale.persistence.storage_unavailable":
    "本地设置存储不可用。本次界面缩放仅在当前会话内生效。",
  "ui.settings.scale.persistence.write_failed":
    "界面缩放已变更，但保存偏好失败。本次界面缩放仅在当前会话内生效。",
  "ui.settings.source.manual": "来源：手动覆盖",
  "ui.settings.source.system": "来源：系统偏好",
  "ui.settings.title": "显示设置",
  "ui.surface.alerts": "城镇警报",
  "ui.surface.topBar": "城镇状态",
  "ui.surface.topBarMeta": "{cycle} | {map} | {speed}",
} as const satisfies Partial<Record<keyof typeof EN_MESSAGES, string>>;

export type MessageKey = keyof typeof EN_MESSAGES;
type MessageCatalog = Readonly<Partial<Record<MessageKey, string>>>;
type TemplateValue = number | string;

export const LOCALE_PREFERENCE_STORAGE_KEY = "wuming-town.locale.v1";

const LOCALE_LABELS = {
  en: {
    en: "English",
    "zh-CN": "Simplified Chinese",
  },
  "zh-CN": {
    en: "英文",
    "zh-CN": "简体中文",
  },
} as const satisfies Record<LocaleId, Record<LocaleId, string>>;

const MESSAGE_CATALOGS: Readonly<Record<LocaleId, MessageCatalog>> = Object.freeze({
  en: EN_MESSAGES,
  "zh-CN": ZH_CN_MESSAGES,
});

const TEMPLATE_PARAMETER_PATTERN = /\{([a-zA-Z0-9_]+)\}/gu;
const SYSTEM_PREFERENCE: LocalePreferenceV1 = Object.freeze({
  source: "system",
  version: 1,
});

export function createDefaultShellLocaleState(candidates: readonly string[]): ShellLocaleState {
  return createShellLocaleState(SYSTEM_PREFERENCE, candidates, {
    diagnosticCode: "none",
    mode: "persistent",
  });
}

export function createShellLocaleState(
  preference: LocalePreferenceV1,
  candidates: readonly string[],
  persistence: LocalePersistenceState,
): ShellLocaleState {
  const systemLocale = resolveSystemLocale(candidates);
  const resolvedLocale =
    preference.source === "manual" && preference.manualLocale !== undefined
      ? preference.manualLocale
      : systemLocale;

  return {
    manualLocale: preference.manualLocale,
    persistence,
    resolvedLocale,
    source: preference.source,
    systemLocale,
  };
}

export function formatMessage(
  locale: LocaleId,
  key: MessageKey,
  values?: Readonly<Record<string, TemplateValue>>,
): string {
  const template = MESSAGE_CATALOGS[locale][key] ?? MESSAGE_CATALOGS.en[key];
  if (template === undefined) {
    return `[missing:${key}]`;
  }

  return template.replace(TEMPLATE_PARAMETER_PATTERN, (_, token: string) => {
    const value = values?.[token];
    return value === undefined ? `[missing-param:${key}:${token}]` : String(value);
  });
}

export function getLocaleDisplayName(locale: LocaleId, uiLocale: LocaleId): string {
  return LOCALE_LABELS[uiLocale][locale];
}

export function isDiagnosticsLocalizationKey(key: string): boolean {
  return readLocalizationNamespace(key) === "dev";
}

export function listSupportedLocales(): readonly LocaleId[] {
  return SUPPORTED_LOCALES;
}

export function loadLocalePreference(
  storage: LocaleStorageLike | undefined,
): LocalePreferenceLoadResult {
  if (storage === undefined) {
    return {
      persistence: {
        diagnosticCode: "storage_unavailable",
        mode: "session-only",
      },
      preference: SYSTEM_PREFERENCE,
    };
  }

  try {
    const rawValue = storage.getItem(LOCALE_PREFERENCE_STORAGE_KEY);
    if (rawValue === null) {
      return {
        persistence: {
          diagnosticCode: "none",
          mode: "persistent",
        },
        preference: SYSTEM_PREFERENCE,
      };
    }

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!isLocalePreferenceV1(parsedValue)) {
      return {
        persistence: {
          diagnosticCode: "preference_invalid",
          mode: "persistent",
        },
        preference: SYSTEM_PREFERENCE,
      };
    }

    return {
      persistence: {
        diagnosticCode: "none",
        mode: "persistent",
      },
      preference: parsedValue,
    };
  } catch {
    return {
      persistence: {
        diagnosticCode: "preference_invalid",
        mode: "persistent",
      },
      preference: SYSTEM_PREFERENCE,
    };
  }
}

export function readNavigatorLocaleCandidates(
  navigatorLike: NavigatorLanguageLike,
): readonly string[] {
  if (Array.isArray(navigatorLike.languages) && navigatorLike.languages.length > 0) {
    return navigatorLike.languages.filter(
      (candidate): candidate is string => typeof candidate === "string",
    );
  }

  if (typeof navigatorLike.language === "string") {
    return [navigatorLike.language];
  }

  return [];
}

export function resolveSystemLocale(candidates: readonly string[]): LocaleId {
  const firstCandidate = candidates[0];
  if (typeof firstCandidate !== "string") {
    return "en";
  }

  const trimmedCandidate = firstCandidate.trim();
  if (trimmedCandidate.length === 0) {
    return "en";
  }

  const primaryLanguage = trimmedCandidate.split("-")[0]?.toLowerCase() ?? "";
  return primaryLanguage === "zh" ? "zh-CN" : "en";
}

export function validateLocalizationCatalogs(): readonly LocalizationValidationIssue[] {
  const issues: LocalizationValidationIssue[] = [];
  const englishKeys = readMessageKeys(EN_MESSAGES);

  for (const key of englishKeys) {
    const englishTemplate = MESSAGE_CATALOGS.en[key];
    if (englishTemplate === undefined) {
      issues.push({
        issue: "missing_english_template",
        key,
      });
      continue;
    }

    const namespace = readLocalizationNamespace(key);
    const englishParams = readTemplateParameters(englishTemplate);

    for (const locale of SUPPORTED_LOCALES) {
      const localeTemplate = MESSAGE_CATALOGS[locale][key];
      if (localeTemplate === undefined) {
        if (locale === "zh-CN" && namespace !== "dev") {
          issues.push({
            issue: "missing_required_translation",
            key,
            locale,
          });
        }
        continue;
      }

      const localeParams = readTemplateParameters(localeTemplate);
      if (!areSortedListsEqual(englishParams, localeParams)) {
        issues.push({
          issue: "parameter_schema_mismatch",
          key,
          locale,
        });
      }
    }
  }

  const zhKeys = Object.keys(MESSAGE_CATALOGS["zh-CN"]);
  for (const key of zhKeys) {
    if (!(key in EN_MESSAGES)) {
      issues.push({
        issue: "zh_extra_key_without_english_source",
        key,
        locale: "zh-CN",
      });
    }
  }

  return issues;
}

export function writeManualLocalePreference(
  storage: LocaleStorageLike | undefined,
  locale: LocaleId,
): LocalePreferenceWriteResult {
  return writeLocalePreference(storage, {
    manualLocale: locale,
    source: "manual",
    version: 1,
  });
}

export function writeSystemLocalePreference(
  storage: LocaleStorageLike | undefined,
): LocalePreferenceWriteResult {
  return writeLocalePreference(storage, SYSTEM_PREFERENCE);
}

function areSortedListsEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function isLocalePreferenceV1(value: unknown): value is LocalePreferenceV1 {
  if (!isRecord(value)) {
    return false;
  }

  const candidate = value;
  if (candidate["version"] !== 1) {
    return false;
  }

  if (candidate["source"] !== "system" && candidate["source"] !== "manual") {
    return false;
  }

  if (candidate["source"] === "system") {
    return candidate["manualLocale"] === undefined;
  }

  return candidate["manualLocale"] === "en" || candidate["manualLocale"] === "zh-CN";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readMessageKeys(catalog: typeof EN_MESSAGES): readonly MessageKey[] {
  return Object.keys(catalog).filter((key): key is MessageKey => key in catalog);
}

function readLocalizationNamespace(key: string): LocalizationNamespace {
  const separatorIndex = key.indexOf(".");
  const namespace = separatorIndex >= 0 ? key.slice(0, separatorIndex) : key;
  if (
    namespace === "content" ||
    namespace === "dev" ||
    namespace === "reason" ||
    namespace === "ui"
  ) {
    return namespace;
  }

  return "ui";
}

function readTemplateParameters(template: string): readonly string[] {
  const tokens = new Set<string>();
  for (const match of template.matchAll(TEMPLATE_PARAMETER_PATTERN)) {
    const token = match[1];
    if (token !== undefined) {
      tokens.add(token);
    }
  }

  return [...tokens].sort();
}

function writeLocalePreference(
  storage: LocaleStorageLike | undefined,
  preference: LocalePreferenceV1,
): LocalePreferenceWriteResult {
  if (storage === undefined) {
    return {
      persistence: {
        diagnosticCode: "storage_unavailable",
        mode: "session-only",
      },
      preference,
    };
  }

  try {
    storage.setItem(LOCALE_PREFERENCE_STORAGE_KEY, JSON.stringify(preference));
    return {
      persistence: {
        diagnosticCode: "none",
        mode: "persistent",
      },
      preference,
    };
  } catch {
    return {
      persistence: {
        diagnosticCode: "write_failed",
        mode: "session-only",
      },
      preference,
    };
  }
}
