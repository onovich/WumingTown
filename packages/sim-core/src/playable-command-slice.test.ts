import { describe, expect, it } from "vitest";

import {
  PLAYABLE_COMMAND_SLICE_SCENARIO_ID,
  createPlayableCommandSliceRuntime,
  runPlayableCommandSliceScenario,
  type PlayableCommandBasis,
  type PrioritizeLampWorkCommandInput,
} from "./playable-command-slice";

describe("WM-0150 playable command-to-job slice", () => {
  it("projects command marker, pawn claim, movement, work and completion deterministically", () => {
    const runtime = createPlayableCommandSliceRuntime();
    const accepted = runtime.applyCommand(
      createLampCommand("lamp-1", runtime.readCommandBasis()),
      0,
    );

    expect(accepted).toMatchObject({
      status: "accepted",
      initialState: "claimed",
      job: { jobId: 0, jobKind: "lamp_refill" },
    });
    expect(runtime.readModel().jobMarkers[0]).toMatchObject({
      markerState: "claimed",
      owner: { index: 0, generation: 1 },
    });
    expect(runtime.readModel()).toMatchObject({
      commandBasis: {
        playableCommandContractVersion: 1,
        basisTick: 0,
      },
      lampAction: {
        available: false,
        target: { kind: "lamp_gap", gapId: "lamp-gap-0" },
      },
      placement: {
        valid: true,
        anchorCell: { x: 12, y: 7, cellIndex: 124 },
        interactionCells: [
          { x: 11, y: 7, cellIndex: 123 },
          { x: 12, y: 8, cellIndex: 140 },
        ],
      },
    });

    runtime.advanceTo(5);
    expect(runtime.readModel().basisTick).toBe(5);
    expect(runtime.readModel().jobMarkers[0]).toMatchObject({ markerState: "moving" });
    expect(runtime.readModel().pawns[0]).toMatchObject({ state: "moving" });

    runtime.advanceTo(20);
    expect(runtime.readModel().jobMarkers[0]).toMatchObject({ markerState: "working" });
    expect(runtime.readModel().pawns[0]).toMatchObject({ state: "working", cellIndex: 124 });

    runtime.advanceTo(45);
    expect(runtime.readModel().jobMarkers[0]).toMatchObject({
      markerState: "completed",
      progressQ16: 30,
    });
    expect(runtime.readModel().pawns[0]).toMatchObject({ state: "completed" });
  });

  it("leaves the authoritative read model unchanged when a duplicate lamp job is rejected", () => {
    const runtime = createPlayableCommandSliceRuntime();
    runtime.applyCommand(createLampCommand("lamp-original", runtime.readCommandBasis()), 0);
    runtime.advanceTo(45);

    const beforeRejected = runtime.readModel();
    const duplicate = runtime.applyCommand(
      createLampCommand("lamp-duplicate", runtime.readCommandBasis()),
      1,
    );

    expect(duplicate).toMatchObject({
      status: "rejected",
      reason: { code: "invalid_target", source: "job_driver" },
    });
    expect(runtime.readModel()).toStrictEqual(beforeRejected);
    expect(runtime.readModel().jobMarkers[0]).toMatchObject({
      commandId: "lamp-original",
      markerState: "completed",
    });
    expect(runtime.readModel().pawns[0]).toMatchObject({ state: "completed", jobId: -1 });
  });

  it("rejects stale reviewed bases when owner versions no longer match", () => {
    const versionCases: readonly StaleVersionCase[] = [
      { field: "basisSnapshotSequence" },
      { field: "targetVersion" },
      { field: "mapVersion" },
      { field: "reservationVersion" },
      { field: "jobVersion" },
    ];

    for (let index = 0; index < versionCases.length; index += 1) {
      const runtime = createPlayableCommandSliceRuntime();
      const versionCase = versionCases[index] ?? failMissingCase();
      const basis = runtime.readCommandBasis();
      const beforeRejected = runtime.readModel();
      const staleBasis = bumpVersionBasis(basis, versionCase.field);
      const result = runtime.applyCommand(
        createLampCommand(`lamp-stale-${String(index)}`, staleBasis),
        index,
      );

      expect(result).toMatchObject({
        status: "rejected",
        reason: {
          code: "stale_command",
          source: "command_validation",
          basis: {
            expectedVersion: readBasisVersion(basis, versionCase.field),
            observedVersion: readBasisVersion(staleBasis, versionCase.field),
          },
        },
      });
      expect(runtime.readModel()).toStrictEqual(beforeRejected);
    }
  });

  it("runs simple build progress through completion and covers structured reasons", () => {
    const summary = runPlayableCommandSliceScenario({ seed: "5", ticks: 240 });

    expect(summary).toMatchObject({
      scenarioId: PLAYABLE_COMMAND_SLICE_SCENARIO_ID,
      tickRate: 30,
      finalTick: 240,
      invariants: {
        lampJobCompleted: true,
        simpleBuildCompleted: true,
        structuredReasonsCovered: true,
        reservationsReleased: true,
        noRunningJobs: true,
      },
      readModel: {
        build: {
          site: { index: 4, generation: 1 },
          completed: true,
          deliveredWood: 6,
          deliveredStone: 2,
          reservedWood: 0,
          reservedStone: 0,
          buildProgressTicks: 120,
        },
        resources: {
          woodDefId: 1,
          woodTotal: 0,
          stoneDefId: 2,
          stoneTotal: 0,
        },
      },
    });
    expect(reasonCodes(summary.commandResults)).toEqual([
      "missing_resource",
      "no_path",
      "no_worker",
      "invalid_target",
      "rule_policy_denial",
      "stale_command",
    ]);
    expect(summary.replay).toMatchObject({
      deterministic: true,
      replayWorldHash: summary.worldHash,
      replayReadModelHash: summary.readModelHash,
    });
    expect(summary.metrics).toMatchObject({
      commandCount: 8,
      rejectedCommandCount: 6,
      staleRejectCount: 1,
      missingResourceRejectCount: 1,
      noPathRejectCount: 1,
      noWorkerRejectCount: 1,
      invalidTargetRejectCount: 1,
      policyRejectCount: 1,
    });
    expect(summary.metrics.candidateVisits).toBeGreaterThan(0);
    expect(summary.metrics.exactPathRequests).toBeGreaterThan(0);
    expect(summary.metrics.projectionBytes).toBeGreaterThan(0);
  });
});

interface StaleVersionCase {
  readonly field:
    | "basisSnapshotSequence"
    | "targetVersion"
    | "mapVersion"
    | "reservationVersion"
    | "jobVersion";
}

function createLampCommand(
  commandId: string,
  basis: ReturnType<ReturnType<typeof createPlayableCommandSliceRuntime>["readCommandBasis"]>,
): PrioritizeLampWorkCommandInput {
  return {
    commandId,
    kind: "PrioritizeLampWork",
    payload: {
      target: {
        kind: "lamp_gap",
        gapId: "lamp-gap-0",
        anchorCell: { x: 12, y: 7, cellIndex: 124 },
      },
      requestedAction: "auto",
      priorityBand: 1,
    },
    basis,
  };
}

function reasonCodes(
  results: readonly { readonly status: string; readonly reason?: { readonly code: string } }[],
): readonly string[] {
  const codes: string[] = [];
  for (const result of results) {
    if (result.status === "rejected" && result.reason !== undefined) {
      codes.push(result.reason.code);
    }
  }
  return codes;
}

function bumpVersionBasis(
  basis: PlayableCommandBasis,
  field: StaleVersionCase["field"],
): PlayableCommandBasis {
  if (field === "basisSnapshotSequence") {
    return { ...basis, basisSnapshotSequence: basis.basisSnapshotSequence + 1 };
  }
  if (field === "targetVersion")
    return { ...basis, targetVersion: readBasisVersion(basis, field) + 1 };
  if (field === "mapVersion") return { ...basis, mapVersion: readBasisVersion(basis, field) + 1 };
  if (field === "reservationVersion") {
    return { ...basis, reservationVersion: readBasisVersion(basis, field) + 1 };
  }
  return { ...basis, jobVersion: readBasisVersion(basis, field) + 1 };
}

function readBasisVersion(basis: PlayableCommandBasis, field: StaleVersionCase["field"]): number {
  if (field === "basisSnapshotSequence") return basis.basisSnapshotSequence;
  if (field === "targetVersion") return basis.targetVersion ?? failMissingVersion(field);
  if (field === "mapVersion") return basis.mapVersion ?? failMissingVersion(field);
  if (field === "reservationVersion") return basis.reservationVersion ?? failMissingVersion(field);
  return basis.jobVersion ?? failMissingVersion(field);
}

function failMissingVersion(field: StaleVersionCase["field"]): never {
  throw new Error(`missing ${field}`);
}

function failMissingCase(): never {
  throw new Error("missing stale version case");
}
