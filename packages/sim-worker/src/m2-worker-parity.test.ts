import { describe, expect, it } from "vitest";

import {
  M2_WORK_LOGISTICS_SCENARIO_ID,
  createM2AdvanceCommandId,
  runM2WorkLogisticsReplay,
  type M2ReplayRun,
} from "@wuming-town/sim-core";
import {
  MAIN_TO_SIMULATION_MESSAGE_KIND,
  PLAYER_COMMAND_KIND,
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  type MainToSimulationMessage,
  type MetricsSampleMessage,
  type RenderSnapshotMessage,
  type SaveReadyMessage,
  type SimulationToMainMessage,
  type UiDeltaMessage,
} from "@wuming-town/sim-protocol";

import { createSimulationWorker } from "./index";

interface M2ParityDiagnostics {
  readonly seed: string;
  readonly scenarioId: typeof M2_WORK_LOGISTICS_SCENARIO_ID;
  readonly firstMismatchedCheckpointTick: number | null;
  readonly finalSnapshotSizeBytes: number;
  readonly workerLatencyMessages: number;
}

describe("M2 Worker/headless parity", () => {
  it("matches Node headless M2 hashes and keeps read models read-only", () => {
    const worker = createSimulationWorker();
    const expected = readM2Replay(
      runM2WorkLogisticsReplay({ seed: "2", checkpointTicks: [0, 6_000, 20_000] }),
    );
    const init = worker.receive(makeM2InitSession(1));
    const atZero = renderSnapshot(init);

    expect(atZero.payload).toMatchObject({
      entityCount: 20,
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      tick: 0,
      worldHash: expected.checkpoints[0]?.worldHash,
      readModelHash: expected.checkpoints[0]?.readModelHash,
      readOnly: true,
    });

    const at6000Responses = worker.receive(makeM2AdvanceBatch(2, 6_000));
    const at6000 = renderSnapshot(at6000Responses);
    const tamperedProjection = { ...at6000.payload, worldHash: "0x00000000" };
    const at20000Responses = worker.receive(makeM2AdvanceBatch(3, 20_000));
    const at20000 = renderSnapshot(at20000Responses);
    const diagnostics = createM2ParityDiagnostics("2", [atZero, at6000, at20000], expected);

    expect(tamperedProjection.worldHash).toBe("0x00000000");
    expect(at6000.payload).toMatchObject({
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      tick: 6_000,
      worldHash: expected.checkpoints[1]?.worldHash,
      readModelHash: expected.checkpoints[1]?.readModelHash,
      readOnly: true,
    });
    expect(at20000.payload).toMatchObject({
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      tick: 20_000,
      worldHash: expected.finalWorldHash,
      readModelHash: expected.finalReadModelHash,
      readOnly: true,
    });
    expect(uiDelta(at20000Responses).payload).toMatchObject({
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      readModelHash: expected.finalReadModelHash,
      readOnly: true,
      summaries: ["completed=4", "wood=24", "stone=12", "progress=240"],
    });
    expect(metricsSample(at20000Responses).payload).toMatchObject({
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      worldHash: expected.finalWorldHash,
      checkpointCount: 3,
    });
    expect(diagnostics).toMatchObject({
      seed: "2",
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      firstMismatchedCheckpointTick: null,
      workerLatencyMessages: 3,
    });
    expect(diagnostics.finalSnapshotSizeBytes).toBeGreaterThan(0);
  });

  it("returns M2 save metadata without exposing mutable authority through the Worker", () => {
    const worker = createSimulationWorker();

    worker.receive(makeM2InitSession(1));
    worker.receive(makeM2AdvanceBatch(2, 6_000));
    const saveReady = saveReadyMessage(worker.receive(makeRequestSave(3)));

    expect(saveReady.payload).toMatchObject({
      scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
      checkpointTick: 6_000,
    });
    expect(saveReady.payload.worldHash).toMatch(/^0x[0-9a-f]{8}$/);
  });
});

function makeM2InitSession(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-m2",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.InitSession,
    payload: {
      seed: "2",
      catalogVersion: M2_WORK_LOGISTICS_SCENARIO_ID,
    },
  };
}

function makeM2AdvanceBatch(sequence: number, tick: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-m2",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.PlayerCommandBatch,
    payload: {
      commands: [
        {
          commandId: createM2AdvanceCommandId(tick),
          kind: PLAYER_COMMAND_KIND.Noop,
        },
      ],
    },
  };
}

function makeRequestSave(sequence: number): MainToSimulationMessage {
  return {
    protocolVersion: SIM_PROTOCOL_VERSION,
    schemaVersion: SIM_SCHEMA_VERSION,
    sessionId: "session-m2",
    sequence,
    kind: MAIN_TO_SIMULATION_MESSAGE_KIND.RequestSave,
    payload: {
      reason: "manual",
    },
  };
}

function createM2ParityDiagnostics(
  seed: string,
  snapshots: readonly RenderSnapshotMessage[],
  expected: M2ReplayRun,
): M2ParityDiagnostics {
  let firstMismatchedCheckpointTick: number | null = null;

  for (let index = 0; index < snapshots.length; index += 1) {
    const snapshot = snapshots[index] ?? failMissingSnapshot();
    const checkpoint = expected.checkpoints[index] ?? failMissingCheckpoint();
    if (
      firstMismatchedCheckpointTick === null &&
      (snapshot.payload.tick !== checkpoint.tick ||
        snapshot.payload.worldHash !== checkpoint.worldHash ||
        snapshot.payload.readModelHash !== checkpoint.readModelHash)
    ) {
      firstMismatchedCheckpointTick = snapshot.payload.tick;
    }
  }

  const finalSnapshot = snapshots[snapshots.length - 1] ?? failMissingSnapshot();
  return {
    seed,
    scenarioId: M2_WORK_LOGISTICS_SCENARIO_ID,
    firstMismatchedCheckpointTick,
    finalSnapshotSizeBytes: JSON.stringify(finalSnapshot.payload).length,
    workerLatencyMessages: snapshots.length,
  };
}

function renderSnapshot(messages: readonly SimulationToMainMessage[]): RenderSnapshotMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot) {
      return message;
    }
  }

  throw new Error("expected RenderSnapshot message");
}

function uiDelta(messages: readonly SimulationToMainMessage[]): UiDeltaMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta) {
      return message;
    }
  }

  throw new Error("expected UiDelta message");
}

function metricsSample(messages: readonly SimulationToMainMessage[]): MetricsSampleMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample) {
      return message;
    }
  }

  throw new Error("expected MetricsSample message");
}

function saveReadyMessage(messages: readonly SimulationToMainMessage[]): SaveReadyMessage {
  for (const message of messages) {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.SaveReady) {
      return message;
    }
  }

  throw new Error("expected SaveReady message");
}

function readM2Replay(result: ReturnType<typeof runM2WorkLogisticsReplay>): M2ReplayRun {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.replay;
}

function failMissingSnapshot(): never {
  throw new Error("missing snapshot");
}

function failMissingCheckpoint(): never {
  throw new Error("missing checkpoint");
}
