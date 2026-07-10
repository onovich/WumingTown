import { initializeGameSessionRuntime } from "./game-session-runtime";
import {
  GAME_SESSION_RUNTIME_VERSION,
  PR1_INTEGRATED_GAME_SESSION_ID,
  type Pr1IntegratedGameSessionScenarioOptions,
  type Pr1IntegratedGameSessionScenarioSummary,
} from "./game-session-types";
import { TICKS_PER_SECOND } from "./time";

export function runPr1IntegratedGameSessionScenario(
  options: Pr1IntegratedGameSessionScenarioOptions,
): Pr1IntegratedGameSessionScenarioSummary {
  const initialized = initializeGameSessionRuntime({ seed: options.seed });
  if (!initialized.ok) {
    throw new Error(
      `${initialized.reason} at initialization stage ${String(initialized.stageIndex)}`,
    );
  }

  const runtime = initialized.runtime;
  runtime.advanceTicks(options.ticks);
  const worldHash = runtime.createWorldHash();
  const readModelHash = runtime.createReadModelHash();
  const conservation = runtime.createConservationReport("terminal");
  return {
    version: GAME_SESSION_RUNTIME_VERSION,
    scenarioId: PR1_INTEGRATED_GAME_SESSION_ID,
    contentManifestHash: runtime.definition.contentManifestHash,
    seed: runtime.seed,
    ticksPerSecond: TICKS_PER_SECOND,
    finalTick: runtime.tick,
    residentCount: runtime.owners.residents.activeCount,
    worldHash,
    readModelHash,
    resources: conservation.resources,
    conservation,
    metrics: runtime.createMetrics(),
  };
}
