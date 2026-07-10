import {
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  type MetricsSampleMessage,
  type SimulationToMainMessage,
} from "@wuming-town/sim-protocol";

export interface GameSessionWorkerOutboxMetrics {
  readonly droppedSnapshots: number;
  readonly queuedReliableMessages: number;
}

export class GameSessionWorkerOutbox {
  private readonly reliable: SimulationToMainMessage[] = [];
  private latestRender: SimulationToMainMessage | undefined;
  private latestUi: SimulationToMainMessage | undefined;
  private latestMetrics: MetricsSampleMessage | undefined;
  private droppedSnapshotCount = 0;

  enqueue(messages: readonly SimulationToMainMessage[]): void {
    for (const message of messages) this.enqueueOne(message);
  }

  createMetrics(): GameSessionWorkerOutboxMetrics {
    return {
      droppedSnapshots: this.droppedSnapshotCount,
      queuedReliableMessages: this.reliable.length,
    };
  }

  drain(): readonly SimulationToMainMessage[] {
    const output: SimulationToMainMessage[] = [];
    const queuedReliableMessages = this.reliable.length;
    for (const message of this.reliable) output.push(message);
    this.reliable.length = 0;
    if (this.latestRender !== undefined) output.push(this.latestRender);
    if (this.latestUi !== undefined) output.push(this.latestUi);
    if (this.latestMetrics !== undefined) {
      output.push({
        ...this.latestMetrics,
        payload: {
          ...this.latestMetrics.payload,
          droppedSnapshots: this.droppedSnapshotCount,
          queuedReliableMessages,
        },
      });
    }
    this.latestRender = undefined;
    this.latestUi = undefined;
    this.latestMetrics = undefined;
    sortBySequence(output);
    return output;
  }

  private enqueueOne(message: SimulationToMainMessage): void {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot) {
      if (this.latestRender !== undefined) this.droppedSnapshotCount += 1;
      this.latestRender = message;
      return;
    }
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta) {
      this.latestUi = message;
      return;
    }
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.MetricsSample) {
      this.latestMetrics = message;
      return;
    }
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.FatalSimulationError) {
      this.latestRender = undefined;
      this.latestUi = undefined;
      this.latestMetrics = undefined;
    }
    this.reliable.push(message);
  }
}

function sortBySequence(messages: SimulationToMainMessage[]): void {
  for (let index = 1; index < messages.length; index += 1) {
    const message = messages[index];
    if (message === undefined) continue;
    let insertion = index;
    while (insertion > 0 && (messages[insertion - 1]?.sequence ?? 0) > message.sequence) {
      messages[insertion] = messages[insertion - 1] ?? message;
      insertion -= 1;
    }
    messages[insertion] = message;
  }
}
