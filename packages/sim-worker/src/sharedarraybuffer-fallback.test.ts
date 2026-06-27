import { describe, expect, it } from "vitest";

import { chooseSimulationWorkerTransport } from "./sharedarraybuffer-fallback";

describe("chooseSimulationWorkerTransport", () => {
  it("uses transferable snapshot fallback when cross-origin isolation is unavailable", () => {
    const gate = chooseSimulationWorkerTransport({
      crossOriginIsolated: false,
      sharedArrayBufferAvailable: false,
    });

    expect(gate).toMatchObject({
      authorityOwner: "simulation-worker",
      projectionPolicy: "read-only",
      reason: "cross_origin_isolation_unavailable",
      requiresCrossOriginIsolationForSab: true,
      snapshotTransport: "transferable-snapshot",
    });
  });

  it("does not move authority when SharedArrayBuffer is available", () => {
    const gate = chooseSimulationWorkerTransport({
      crossOriginIsolated: true,
      sharedArrayBufferAvailable: true,
    });

    expect(gate).toMatchObject({
      authorityOwner: "simulation-worker",
      projectionPolicy: "read-only",
      reason: "sharedarraybuffer_available",
      snapshotTransport: "shared-array-buffer",
    });
  });
});
