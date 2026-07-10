import { describe, expect, it } from "vitest";

import {
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  type SimulationToMainMessage,
} from "@wuming-town/sim-protocol";

import { createBrowserSimulationWorkerSession, createSimulationWorker } from "./index";
import {
  FakeBrowserWorker,
  findReady,
  findRender,
  findUi,
  initMessage,
} from "./game-session-worker-test-support";

describe("PR-1 GameSession browser validation", () => {
  it("closes on missing negotiated payload and safely drops a malformed stale render", () => {
    const fake = new FakeBrowserWorker();
    const session = createBrowserSimulationWorkerSession({
      sessionId: "session-a",
      workerFactory: () => fake,
    });
    const received: SimulationToMainMessage[] = [];
    session.subscribe((message) => received.push(message));
    const init = session.initGameSession({ seed: "5" });
    expect(session.getState()).toBe("initializing");
    const responses = createSimulationWorker().receive(init);
    for (const message of responses) fake.emit(message);
    expect(session.getState()).toBe("active");

    const currentRender = findRender(responses);
    fake.emit({
      ...currentRender,
      sequence: 100,
      payload: {
        ...currentRender.payload,
        snapshotSequence: 0,
        gameSession: "malformed stale payload is safely droppable",
      },
    });
    expect(session.getState()).toBe("active");

    fake.emit({
      ...findUi(responses),
      sequence: 101,
      payload: { tick: 0, summaries: [], readOnly: true },
    });
    expect(session.getState()).toBe("fatal");
    expect(fake.terminateCount).toBe(1);
    expect(received.at(-1)).toMatchObject({
      kind: SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError,
      payload: { reason: { code: "LifecycleError" } },
    });
  });

  it("does not enter active before Ready and fails an early projection closed", () => {
    const fake = new FakeBrowserWorker();
    const session = createBrowserSimulationWorkerSession({
      sessionId: "session-a",
      workerFactory: () => fake,
    });
    const init = session.initGameSession();
    expect(session.getState()).toBe("initializing");
    const responses = createSimulationWorker().receive(init);
    fake.emit(findRender(responses));
    expect(session.getState()).toBe("fatal");
    expect(fake.terminateCount).toBe(1);
  });

  it("closes and terminates on a duplicate Ready after activation", () => {
    const fake = new FakeBrowserWorker();
    const session = createBrowserSimulationWorkerSession({
      sessionId: "session-a",
      workerFactory: () => fake,
    });
    const responses = createSimulationWorker().receive(session.initGameSession());
    for (const message of responses) fake.emit(message);
    expect(session.getState()).toBe("active");

    const ready = findReady(responses);
    fake.emit({ ...ready, sequence: 100 });
    expect(session.getState()).toBe("fatal");
    expect(fake.terminateCount).toBe(1);
  });

  it("closes on mismatched Ready and an incoherent newer basis", () => {
    const mismatched = new FakeBrowserWorker();
    const first = createBrowserSimulationWorkerSession({
      sessionId: "session-a",
      workerFactory: () => mismatched,
    });
    first.initGameSession();
    const ready = findReady(createSimulationWorker().receive(initMessage()));
    mismatched.emit({
      ...ready,
      payload: { ...ready.payload, projectionContract: { kind: "game_session", version: 99 } },
    });
    expect(first.getState()).toBe("fatal");

    const fake = new FakeBrowserWorker();
    const second = createBrowserSimulationWorkerSession({
      sessionId: "session-a",
      workerFactory: () => fake,
    });
    const init = second.initGameSession();
    const responses = createSimulationWorker().receive(init);
    for (const message of responses) fake.emit(message);
    const ui = findUi(responses);
    const projection = ui.payload.gameSession;
    if (projection === undefined) throw new Error("missing projection");
    fake.emit({
      ...ui,
      sequence: 200,
      payload: {
        ...ui.payload,
        readModelHash: "0xincoherent",
        gameSession: {
          ...projection,
          basis: { ...projection.basis, snapshotSequence: 2, readModelHash: "0xincoherent" },
        },
      },
    });
    expect(second.getState()).toBe("active");
    const render = findRender(responses);
    const renderProjection = render.payload.gameSession;
    if (renderProjection === undefined) throw new Error("missing render projection");
    fake.emit({
      ...render,
      sequence: 201,
      payload: {
        ...render.payload,
        snapshotSequence: 2,
        gameSession: {
          ...renderProjection,
          basis: { ...renderProjection.basis, snapshotSequence: 2 },
        },
      },
    });
    expect(second.getState()).toBe("fatal");
  });

  it("fails schema-v2 and malformed newer render rows closed", () => {
    const schemaWorker = new FakeBrowserWorker();
    const schemaSession = createBrowserSimulationWorkerSession({
      sessionId: "session-a",
      workerFactory: () => schemaWorker,
    });
    schemaSession.initGameSession();
    const ready = findReady(createSimulationWorker().receive(initMessage()));
    schemaWorker.emit({ ...ready, schemaVersion: 2 });
    expect(schemaSession.getState()).toBe("fatal");

    const fake = new FakeBrowserWorker();
    const session = createBrowserSimulationWorkerSession({
      sessionId: "session-a",
      workerFactory: () => fake,
    });
    const init = session.initGameSession();
    const responses = createSimulationWorker().receive(init);
    for (const message of responses) fake.emit(message);
    const render = findRender(responses);
    const projection = render.payload.gameSession;
    const firstEntity = projection?.entities[0];
    if (projection === undefined || firstEntity === undefined) throw new Error("render missing");
    fake.emit({
      ...render,
      sequence: 300,
      payload: {
        ...render.payload,
        snapshotSequence: 2,
        tick: 3,
        worldHash: "0xmalformed",
        readModelHash: "0xmalformed-read",
        gameSession: {
          ...projection,
          basis: {
            ...projection.basis,
            tick: 3,
            snapshotSequence: 2,
            worldHash: "0xmalformed",
            readModelHash: "0xmalformed-read",
          },
          entities: [{ ...firstEntity, xQ16: -1 }],
        },
      },
    });
    expect(session.getState()).toBe("fatal");
  });
});
