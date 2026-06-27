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
  "ui.mainMenu.continue.ready": "Continue loads the latest local shell save.",
  "ui.mainMenu.cycle": "Season",
  "ui.mainMenu.cycleHint": "This start surface stays inside the current local shell profile.",
  "ui.mainMenu.language": "Presentation language",
  "ui.mainMenu.language.system": "Follow system",
  "ui.mainMenu.languageHint":
    "Language changes update shell UI immediately and stay local to this device profile.",
  "ui.mainMenu.phase": "Current phase",
  "ui.mainMenu.phaseHint": "Check the phase first, then decide whether to start fresh or continue.",
  "ui.mainMenu.settings.hint":
    "Language changes never change simulation authority and are stored in local app settings only.",
  "ui.mainMenu.settings.summary":
    "Choose language and confirm how the shell stores the preference before entering the town view.",
  "ui.mainMenu.settings.title": "Settings",
  "ui.mainMenu.summary":
    "Read the current phase, then start a new session or continue the latest local save.",
  "ui.inspector.aria": "Selected entity inspector",
  "ui.inspector.currentJob": "Current job",
  "ui.inspector.currentStep": "Current step",
  "ui.inspector.decision": "Decision",
  "ui.inspector.health": "Health",
  "ui.inspector.lastInput": "Last input",
  "ui.inspector.mood": "Mood",
  "ui.inspector.needs": "Needs",
  "ui.inspector.noSelection.body": "Use the map to inspect a resident, lantern keeper, or visitor.",
  "ui.inspector.noSelection.title": "No selection",
  "ui.inspector.selected": "Selected entity",
  "ui.inspector.thoughts": "Thoughts",
  "ui.inspector.tile": "tile",
  "ui.inspector.why": "Why this matters",
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
    "Use language settings to choose zh-CN or English. This changes shell presentation only and never changes simulation authority or saves.",
  "ui.onboarding.step2.title": "Choose presentation language",
  "ui.onboarding.step3.body":
    "Treat reasons, alerts, and evidence as structured explanations. Diagnostics stay outside the default player HUD unless explicitly opened.",
  "ui.onboarding.step3.title": "Follow evidence, not hidden truth",
  "ui.onboarding.summary":
    "Start from the current phase, next pressure, resident state, and structured reasons before using any debug-only tools.",
  "ui.onboarding.title": "M8 first-run path",
  "ui.settings.aria": "Language settings",
  "ui.settings.currentLocale": "Current locale: {locale}",
  "ui.settings.description":
    "Choose how player-facing shell chrome is presented. This preference is local to the app shell.",
  "ui.settings.language": "Language",
  "ui.settings.option.system": "Follow system ({locale})",
  "ui.settings.persistence.preference_invalid":
    "Saved language settings were invalid and were reset to system mode.",
  "ui.settings.persistence.ready": "Saved in local app settings.",
  "ui.settings.persistence.storage_unavailable":
    "Local settings storage is unavailable. This choice will last for this session only.",
  "ui.settings.persistence.write_failed":
    "The language changed, but saving the preference failed. This choice will last for this session only.",
  "ui.settings.source.manual": "Source: manual override",
  "ui.settings.source.system": "Source: system preference",
  "ui.settings.title": "Language settings",
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
  "ui.mainMenu.continue.ready": "继续会载入最近一次本地壳层存档。",
  "ui.mainMenu.cycle": "时序",
  "ui.mainMenu.cycleHint": "该起始界面只作用于当前本地壳层配置。",
  "ui.mainMenu.language": "界面语言",
  "ui.mainMenu.language.system": "跟随系统",
  "ui.mainMenu.languageHint": "语言切换会立即更新壳层界面，并仅保存在当前设备配置中。",
  "ui.mainMenu.phase": "当前阶段",
  "ui.mainMenu.phaseHint": "先确认当前阶段，再决定开始新局还是继续本地进度。",
  "ui.mainMenu.settings.hint": "语言切换不会改变模拟权威，只会写入本地应用设置。",
  "ui.mainMenu.settings.summary": "进入城镇视图前，可在这里确认语言与本地偏好保存方式。",
  "ui.mainMenu.settings.title": "设置",
  "ui.mainMenu.summary": "先阅读当前阶段，再开始新局或继续最近一次本地存档。",
  "ui.inspector.aria": "已选对象信息",
  "ui.inspector.currentJob": "当前工作",
  "ui.inspector.currentStep": "当前步骤",
  "ui.inspector.decision": "最近决策",
  "ui.inspector.health": "健康",
  "ui.inspector.lastInput": "最近输入",
  "ui.inspector.mood": "心情",
  "ui.inspector.needs": "需求",
  "ui.inspector.noSelection.body": "在地图上选择居民、守灯人或访客以查看详情。",
  "ui.inspector.noSelection.title": "尚未选择对象",
  "ui.inspector.selected": "已选对象",
  "ui.inspector.thoughts": "当前想法",
  "ui.inspector.tile": "地块",
  "ui.inspector.why": "原因说明",
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
    "可在此切换简体中文或英文。它只改变壳层呈现，不会改变模拟权威或存档。",
  "ui.onboarding.step2.title": "选择界面语言",
  "ui.onboarding.step3.body":
    "把原因、警报与证据视为结构化说明。诊断信息默认不会出现在玩家 HUD，除非显式开启。",
  "ui.onboarding.step3.title": "依据证据而非隐藏真相",
  "ui.onboarding.summary":
    "先从当前时段、主要压力、居民状态与结构化原因入手，再使用任何调试专用工具。",
  "ui.onboarding.title": "M8 首次游玩路径",
  "ui.settings.aria": "语言设置",
  "ui.settings.currentLocale": "当前语言：{locale}",
  "ui.settings.description": "选择玩家可见壳层界面的显示语言。该偏好仅保存在应用壳层本地。",
  "ui.settings.language": "语言",
  "ui.settings.option.system": "跟随系统（{locale}）",
  "ui.settings.persistence.preference_invalid": "已保存的语言设置无效，现已恢复为跟随系统。",
  "ui.settings.persistence.ready": "已保存在本地应用设置中。",
  "ui.settings.persistence.storage_unavailable": "本地设置存储不可用。本次选择仅在当前会话内生效。",
  "ui.settings.persistence.write_failed":
    "语言已切换，但保存偏好失败。本次选择仅在当前会话内生效。",
  "ui.settings.source.manual": "来源：手动覆盖",
  "ui.settings.source.system": "来源：系统偏好",
  "ui.settings.title": "语言设置",
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
