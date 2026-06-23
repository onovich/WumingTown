import { CONTENT_SCHEMA_SMOKE } from "@wuming-town/content-schema";
import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";

export { formatUint32Hex, hashStringToUint32, mixUint32 } from "./deterministic-hash";
export {
  HEADLESS_SUMMARY_VERSION,
  advanceHeadlessTicks,
  createHeadlessRunner,
  queueHeadlessCommand,
  runHeadlessTicks,
  setHeadlessPaused,
  setHeadlessSpeed,
  stepHeadlessFrames,
  summarizeHeadlessRun,
} from "./runner";
export { TICKS_PER_DAY, TICKS_PER_SECOND, isSafeTick, requireSafeTick } from "./time";
export type {
  HeadlessCommandInput,
  HeadlessQueuedCommand,
  HeadlessRunSummary,
  HeadlessRunnerOptions,
  HeadlessRunnerState,
  QueueCommandResult,
} from "./runner";
export type { RunnerSpeed, Tick } from "./time";

export const SIM_CORE_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/sim-core",
  "package",
);

export const SIM_CORE_ALLOWED_INPUTS: readonly string[] = [CONTENT_SCHEMA_SMOKE.packageName];
