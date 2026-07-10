import { describe, expect, it } from "vitest";

import {
  GAME_SESSION_PROJECTION_VERSION,
  SIMULATION_PROTOCOL_REASON_CODE,
  validateCoherentGameSessionProjectionPair,
  validateGameSessionProjectionRequest,
  validateGameSessionReadyContract,
  validateGameSessionRenderProjectionV1,
  validateGameSessionUiProjectionV1,
  type GameSessionProjectionBasisV1,
  type GameSessionProjectionRequestV1,
  type GameSessionRenderProjectionV1,
  type GameSessionUiProjectionV1,
} from "./index";

describe("GameSession projection v1 validation", () => {
  it("accepts only the reviewed request and matching Ready contract", () => {
    const request = projectionRequest();
    expect(validateGameSessionProjectionRequest(request)).toEqual({ ok: true });
    expect(validateGameSessionReadyContract(request, request)).toEqual({ ok: true });
    expect(validateGameSessionProjectionRequest({ ...request, version: 99 })).toMatchObject({
      ok: false,
      reason: { code: SIMULATION_PROTOCOL_REASON_CODE.UnsupportedSchemaVersion },
    });
    expect(validateGameSessionReadyContract({ ...request, version: 99 }, request)).toMatchObject({
      ok: false,
      reason: { code: SIMULATION_PROTOCOL_REASON_CODE.UnsupportedSchemaVersion },
    });
  });

  it("accepts bounded render and UI payloads with one coherent basis", () => {
    const render = renderProjection();
    const ui = uiProjection();
    expect(validateGameSessionRenderProjectionV1(render)).toEqual({ ok: true });
    expect(validateGameSessionUiProjectionV1(ui)).toEqual({ ok: true });
    expect(validateCoherentGameSessionProjectionPair(render, ui)).toEqual({ ok: true });
  });

  it("rejects malformed and duplicate render rows", () => {
    const render = renderProjection();
    expect(
      validateGameSessionRenderProjectionV1({
        ...render,
        entities: [{ ...render.entities[0], xQ16: -1 }],
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateGameSessionRenderProjectionV1({
        ...render,
        entities: [render.entities[0], render.entities[0]],
      }),
    ).toMatchObject({ ok: false });
  });

  it("rejects missing resident fields and required resource kinds", () => {
    const ui = uiProjection();
    const firstResident = ui.residents[0];
    expect(firstResident).toBeDefined();
    expect(
      validateGameSessionUiProjectionV1({
        ...ui,
        residents: ui.residents.map((resident, index) =>
          index === 0 ? { ...resident, comfort: undefined } : resident,
        ),
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateGameSessionUiProjectionV1({
        ...ui,
        resources: ui.resources.filter((resource) => resource.resourceKind !== "lamp_oil"),
      }),
    ).toMatchObject({ ok: false });
  });

  it("rejects incoherent tick/hash/version basis and malformed selection detail", () => {
    const render = renderProjection();
    const ui = uiProjection();
    expect(
      validateCoherentGameSessionProjectionPair(render, {
        ...ui,
        basis: { ...ui.basis, readModelHash: "0xdifferent" },
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateGameSessionUiProjectionV1({
        ...ui,
        selectionDetail: {
          kind: "resident",
          basis: { ...ui.basis, version: 1 },
          resident: ui.residents[0],
        },
      }),
    ).toMatchObject({ ok: false });
  });

  it("requires selection detail to share the complete containing UI basis", () => {
    const ui = uiProjection();
    const resident = ui.residents[0];
    if (resident === undefined) throw new Error("resident fixture missing");
    const selectionDetail: NonNullable<GameSessionUiProjectionV1["selectionDetail"]> = {
      kind: "resident",
      basis: { ...ui.basis, version: 1, ownerVersion: resident.ownerVersion },
      resident,
    };
    expect(validateGameSessionUiProjectionV1({ ...ui, selectionDetail })).toEqual({ ok: true });
    for (const basis of [
      { ...selectionDetail.basis, snapshotSequence: 0 },
      { ...selectionDetail.basis, worldHash: "0xforeign" },
      { ...selectionDetail.basis, contentManifestHash: "0xforeign" },
      { ...selectionDetail.basis, mapVersion: selectionDetail.basis.mapVersion + 1 },
      {
        ...selectionDetail.basis,
        derivedIndexVersion: selectionDetail.basis.derivedIndexVersion + 1,
      },
    ]) {
      expect(
        validateGameSessionUiProjectionV1({
          ...ui,
          selectionDetail: { ...selectionDetail, basis },
        }),
      ).toMatchObject({ ok: false });
    }
  });
});

function projectionRequest(): GameSessionProjectionRequestV1 {
  return { kind: "game_session", version: GAME_SESSION_PROJECTION_VERSION };
}

function projectionBasis(): GameSessionProjectionBasisV1 {
  return {
    projectionVersion: GAME_SESSION_PROJECTION_VERSION,
    scenarioId: "post-m8.pr1_integrated_gamesession.v1",
    contentManifestHash: "0xf625e427",
    tick: 30,
    snapshotSequence: 2,
    previousSnapshotSequence: 1,
    worldHash: "0xworld",
    readModelHash: "0xread",
    mapVersion: 40,
    reservationVersion: 2,
    jobVersion: 4,
    derivedIndexVersion: 3,
  };
}

function renderProjection(): GameSessionRenderProjectionV1 {
  return {
    basis: projectionBasis(),
    mapWidth: 64,
    mapHeight: 64,
    tileSizeQ16: 65_536,
    entities: [
      {
        entity: { index: 0, generation: 1 },
        kind: "resident",
        renderDefId: 1,
        xQ16: 65_536,
        yQ16: 131_072,
        facing: 2,
        animationState: "working",
        flags: 1,
      },
    ],
  };
}

function uiProjection(): GameSessionUiProjectionV1 {
  return {
    basis: projectionBasis(),
    paused: false,
    requestedSpeed: 1,
    effectiveTicksPerSecond: 30,
    dayIndex: 0,
    tickOfDay: 30,
    ticksPerDay: 43_200,
    dayPhase: "dawn",
    daylightQ16: 32_768,
    residents: createResidents(),
    resources: [
      resource(1, "food", 80),
      resource(2, "wood", 60),
      resource(3, "stone", 50),
      resource(4, "lamp_oil", 40),
    ],
    jobs: [
      {
        markerId: "resident:0",
        jobId: 0,
        state: "working",
        owner: { index: 0, generation: 1 },
        progressQ16: 32_768,
      },
    ],
    alerts: [
      {
        alertId: "resident:0:working",
        severity: "info",
        reason: { code: "game_session.job_working", source: "job", parameters: [0] },
        subject: { index: 0, generation: 1 },
      },
    ],
    selectionDetail: null,
    lampFuel: 40,
    lampStateCode: 0,
    buildProgressTicks: 0,
    buildRequiredTicks: 300,
    buildCompleted: false,
  };
}

function createResidents(): GameSessionUiProjectionV1["residents"] {
  return Array.from(
    { length: 8 },
    (_, residentId): GameSessionUiProjectionV1["residents"][number] => ({
      entity: { index: residentId, generation: 1 },
      residentId,
      residentDefId: residentId + 1,
      cellIndex: residentId,
      activity: residentId === 0 ? "working" : "idle",
      jobState: residentId === 0 ? "working" : "idle",
      currentJobId: residentId === 0 ? 0 : null,
      progressQ16: residentId === 0 ? 32_768 : 0,
      hunger: 800,
      rest: 800,
      comfort: 700,
      social: 700,
      safety: 900,
      ownerVersion: 1,
      reason: {
        code: residentId === 0 ? "game_session.job_working" : "game_session.no_indexed_work",
        source: "resident",
        parameters: [residentId],
      },
    }),
  );
}

function resource(
  defId: number,
  resourceKind: "food" | "wood" | "stone" | "lamp_oil",
  total: number,
): GameSessionUiProjectionV1["resources"][number] {
  return { defId, resourceKind, total, available: total, reserved: 0, ownerVersion: 1 };
}
