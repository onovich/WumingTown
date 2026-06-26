import { describe, expect, it } from "vitest";

import {
  WEB_PRODUCT_GATE_READ_MODEL,
  readWebProductGateActiveEntityCount,
} from "./product-gate-fixture";
import { WEB_PRODUCT_GATE_HARNESS, createShellReleaseGateInfo } from "./product-gate-harness";

describe("web product gate harness", () => {
  it("pins the reviewed M5 and M4 evidence basis", () => {
    expect(WEB_PRODUCT_GATE_HARNESS.primaryEvidence).toMatchObject({
      taskId: "WM-0083",
      scenarioId: "m5.alpha_content_framework.first_season.v1",
      contentHash: "0xe55d3015",
      finalReadModelHash: "0x9ba83cb7",
    });
    expect(WEB_PRODUCT_GATE_HARNESS.regressionEvidence).toMatchObject({
      taskId: "WM-0067",
      scenarioId: "m4.core_vertical_slice.borrowed_shadow_lamps.v1",
      finalReadModelHash: "0xce261d9d",
    });
  });

  it("uses the reviewed Web gate map scale and active-actor fixture size", () => {
    expect(WEB_PRODUCT_GATE_READ_MODEL.mapWidth).toBe(192);
    expect(WEB_PRODUCT_GATE_READ_MODEL.mapHeight).toBe(192);
    expect(readWebProductGateActiveEntityCount()).toBe(40);
    expect(WEB_PRODUCT_GATE_HARNESS.targetTotalEntities).toBe(20000);
  });

  it("exposes browser, build and isolation assumptions without changing authority", () => {
    const info = createShellReleaseGateInfo({
      browserLabel: "Chrome-family browser",
      crossOriginIsolated: false,
    });

    expect(info.fixtureId).toBe("wm-0086-web-product-gate");
    expect(info.browserTargets).toContain("Chrome Stable");
    expect(info.browserTargets).toContain("Edge Stable");
    expect(info.sections.some((section) => section.value.includes("150 MB"))).toBe(true);
    expect(info.sections.some((section) => section.detail.includes("Transferable snapshot"))).toBe(
      true,
    );
    expect(info.sections.some((section) => section.detail.includes("Worker or headless"))).toBe(
      true,
    );
  });
});
