import type { ShellReleaseGateInfo } from "@wuming-town/ui-react";

import * as harnessData from "./product-gate-harness.data.json";
import { readWebProductGateActiveEntityCount } from "./product-gate-fixture";

export interface WebReleaseGateBrowserTarget {
  readonly browser: string;
  readonly note: string;
}

export interface WebReleaseGateEvidenceSource {
  readonly commandStreamHash?: string;
  readonly contentHash?: string;
  readonly finalReadModelHash: string;
  readonly finalTick: number;
  readonly label: string;
  readonly scenarioId: string;
  readonly taskId: string;
}

export interface WebReleaseGateHarnessDescriptor {
  readonly assetPolicy: string;
  readonly authorityBoundary: string;
  readonly browserTargets: readonly WebReleaseGateBrowserTarget[];
  readonly buildReportFileName: string;
  readonly bundleBudgetMb: number;
  readonly expectedHeaders: readonly string[];
  readonly fixtureId: string;
  readonly fixtureLabel: string;
  readonly mapHeight: number;
  readonly mapWidth: number;
  readonly primaryEvidence: WebReleaseGateEvidenceSource;
  readonly regressionEvidence: WebReleaseGateEvidenceSource;
  readonly sabFallback: string;
  readonly strategyPaths: readonly string[];
  readonly targetActiveActors: number;
  readonly targetTotalEntities: number;
}

export const WEB_PRODUCT_GATE_HARNESS: WebReleaseGateHarnessDescriptor = harnessData;

export function createShellReleaseGateInfo(input: {
  readonly browserLabel: string;
  readonly crossOriginIsolated: boolean;
}): ShellReleaseGateInfo {
  const browserTargets = WEB_PRODUCT_GATE_HARNESS.browserTargets.map((target) => target.browser);
  const runtimeIsolation = input.crossOriginIsolated
    ? "cross-origin isolated"
    : "fallback / not isolated";

  return {
    fixtureId: WEB_PRODUCT_GATE_HARNESS.fixtureId,
    title: "Web Product Gate",
    browserTargets,
    runtimeBrowser: input.browserLabel,
    runtimeCrossOriginIsolated: input.crossOriginIsolated,
    sections: [
      {
        label: "Fixture",
        value: WEB_PRODUCT_GATE_HARNESS.fixtureLabel,
        detail: `Map ${String(WEB_PRODUCT_GATE_HARNESS.mapWidth)} x ${String(WEB_PRODUCT_GATE_HARNESS.mapHeight)} | ${String(readWebProductGateActiveEntityCount())} visible actors | ${String(WEB_PRODUCT_GATE_HARNESS.targetTotalEntities)} total-entity target for later gates`,
      },
      {
        label: "Evidence",
        value: `${WEB_PRODUCT_GATE_HARNESS.primaryEvidence.taskId} / ${WEB_PRODUCT_GATE_HARNESS.primaryEvidence.scenarioId}`,
        detail: `content ${WEB_PRODUCT_GATE_HARNESS.primaryEvidence.contentHash ?? "n/a"} | read-model ${WEB_PRODUCT_GATE_HARNESS.primaryEvidence.finalReadModelHash} | M4 regression ${WEB_PRODUCT_GATE_HARNESS.regressionEvidence.finalReadModelHash}`,
      },
      {
        label: "Targets",
        value: browserTargets.join(" + "),
        detail: `30 TPS Web gate later measures the same fixture scale; strategy paths ${WEB_PRODUCT_GATE_HARNESS.strategyPaths.join(", ")}`,
      },
      {
        label: "Build",
        value: `<= ${String(WEB_PRODUCT_GATE_HARNESS.bundleBudgetMb)} MB compressed target`,
        detail: `${WEB_PRODUCT_GATE_HARNESS.assetPolicy} Build artifact: ${WEB_PRODUCT_GATE_HARNESS.buildReportFileName}`,
      },
      {
        label: "Isolation",
        value: runtimeIsolation,
        detail: `${WEB_PRODUCT_GATE_HARNESS.expectedHeaders.join(" | ")}. ${WEB_PRODUCT_GATE_HARNESS.sabFallback}`,
      },
      {
        label: "Authority",
        value: "Worker/headless only",
        detail: WEB_PRODUCT_GATE_HARNESS.authorityBoundary,
      },
    ],
  };
}

export function readShellBrowserLabel(userAgent: string): string {
  if (userAgent.includes("Edg/")) {
    return "Edge-family browser";
  }

  if (userAgent.includes("Chrome/")) {
    return "Chrome-family browser";
  }

  return "Unknown browser shell";
}
