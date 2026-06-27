import { describe, expect, it } from "vitest";

import {
  createShellLocaleState,
  formatMessage,
  loadLocalePreference,
  readNavigatorLocaleCandidates,
  resolveSystemLocale,
  validateLocalizationCatalogs,
  writeManualLocalePreference,
  writeSystemLocalePreference,
} from "./localization";

describe("localization", () => {
  it("validates the zh-CN and en catalogs", () => {
    expect(validateLocalizationCatalogs()).toStrictEqual([]);
  });

  it("uses the first browser candidate and resolves zh variants to zh-CN", () => {
    expect(resolveSystemLocale(["zh-Hant"])).toBe("zh-CN");
    expect(resolveSystemLocale(["zh-SG"])).toBe("zh-CN");
    expect(resolveSystemLocale(["en-US"])).toBe("en");
    expect(resolveSystemLocale(["", "zh-CN"])).toBe("en");
    expect(resolveSystemLocale([])).toBe("en");
  });

  it("prefers a valid manual override over browser candidates", () => {
    const state = createShellLocaleState(
      {
        manualLocale: "en",
        source: "manual",
        version: 1,
      },
      ["zh-CN"],
      {
        diagnosticCode: "none",
        mode: "persistent",
      },
    );

    expect(state.systemLocale).toBe("zh-CN");
    expect(state.resolvedLocale).toBe("en");
    expect(state.source).toBe("manual");
  });

  it("reads navigator languages before navigator.language", () => {
    expect(
      readNavigatorLocaleCandidates({
        language: "en-US",
        languages: ["zh-CN", "en-US"],
      }),
    ).toStrictEqual(["zh-CN", "en-US"]);
    expect(
      readNavigatorLocaleCandidates({
        language: "zh-CN",
      }),
    ).toStrictEqual(["zh-CN"]);
  });

  it("fails closed to system mode when stored preferences are malformed", () => {
    const result = loadLocalePreference({
      getItem() {
        return '{"version":2,"source":"manual","manualLocale":"zh-CN"}';
      },
      setItem() {
        throw new Error("unused");
      },
    });

    expect(result.preference).toStrictEqual({
      source: "system",
      version: 1,
    });
    expect(result.persistence).toStrictEqual({
      diagnosticCode: "preference_invalid",
      mode: "persistent",
    });
  });

  it("falls back to session-only storage when persistence is unavailable", () => {
    const result = loadLocalePreference(undefined);

    expect(result.preference).toStrictEqual({
      source: "system",
      version: 1,
    });
    expect(result.persistence).toStrictEqual({
      diagnosticCode: "storage_unavailable",
      mode: "session-only",
    });
  });

  it("keeps manual override in memory when writes fail", () => {
    const result = writeManualLocalePreference(
      {
        getItem() {
          return null;
        },
        setItem() {
          throw new Error("blocked");
        },
      },
      "zh-CN",
    );

    expect(result.preference).toStrictEqual({
      manualLocale: "zh-CN",
      source: "manual",
      version: 1,
    });
    expect(result.persistence).toStrictEqual({
      diagnosticCode: "write_failed",
      mode: "session-only",
    });
  });

  it("writes system mode without leaking a manual locale", () => {
    let persisted = "";
    const result = writeSystemLocalePreference({
      getItem() {
        return null;
      },
      setItem(_key, value) {
        persisted = value;
      },
    });

    expect(result.persistence).toStrictEqual({
      diagnosticCode: "none",
      mode: "persistent",
    });
    expect(persisted).toBe('{"source":"system","version":1}');
  });

  it("formats localized templates with named parameters", () => {
    expect(
      formatMessage("zh-CN", "ui.settings.option.system", {
        locale: "简体中文",
      }),
    ).toBe("跟随系统（简体中文）");
    expect(
      formatMessage("en", "ui.surface.topBarMeta", {
        cycle: "First season",
        map: "Town Basin",
        speed: "Paused",
      }),
    ).toBe("First season | Town Basin | Paused");
  });
});
