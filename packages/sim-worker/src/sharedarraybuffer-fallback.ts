export type SimulationWorkerSnapshotTransport = "shared-array-buffer" | "transferable-snapshot";

export type SimulationWorkerTransportReason =
  | "sharedarraybuffer_available"
  | "sharedarraybuffer_unavailable"
  | "cross_origin_isolation_unavailable";

export interface SimulationWorkerRuntimeFacts {
  readonly crossOriginIsolated: boolean;
  readonly sharedArrayBufferAvailable: boolean;
}

export interface SimulationWorkerTransportGate {
  readonly authorityOwner: "simulation-worker";
  readonly capImpact: string;
  readonly projectionPolicy: "read-only";
  readonly reason: SimulationWorkerTransportReason;
  readonly requiresCrossOriginIsolationForSab: boolean;
  readonly snapshotTransport: SimulationWorkerSnapshotTransport;
}

export function chooseSimulationWorkerTransport(
  runtime: SimulationWorkerRuntimeFacts,
): SimulationWorkerTransportGate {
  if (runtime.crossOriginIsolated && runtime.sharedArrayBufferAvailable) {
    return {
      authorityOwner: "simulation-worker",
      capImpact:
        "SAB may support future higher-throughput transport, but M6 still requires product-scale evidence before raising Web caps.",
      projectionPolicy: "read-only",
      reason: "sharedarraybuffer_available",
      requiresCrossOriginIsolationForSab: true,
      snapshotTransport: "shared-array-buffer",
    };
  }

  return {
    authorityOwner: "simulation-worker",
    capImpact:
      "Transferable snapshot fallback keeps the Web target at the conservative 3x/lower-cap product-gate path until product-scale evidence proves otherwise.",
    projectionPolicy: "read-only",
    reason: runtime.crossOriginIsolated
      ? "sharedarraybuffer_unavailable"
      : "cross_origin_isolation_unavailable",
    requiresCrossOriginIsolationForSab: true,
    snapshotTransport: "transferable-snapshot",
  };
}
