import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";
import { SIM_PROTOCOL_SMOKE } from "@wuming-town/sim-protocol";

export {
  buildM6GateSaveEnvelope,
  computeSha256Hex,
  decodeM6GateSaveEnvelope,
  encodeM6GateSaveEnvelope,
  type DecodedM6GateSaveEnvelope,
  type M6GateSaveEnvelope,
} from "./m6-gate-save";
export { createBrowserOpfsSaveStore, createOpfsSaveStore } from "./opfs-save-store";
export type {
  OpfsSaveStoreOptions,
  SaveExportPayload,
  SaveStoreDiagnosticValue,
  SaveStoreError,
  SaveStoreErrorCode,
  SaveStorePort,
  SaveStoreQuotaEstimate,
  SaveStoreResult,
  SaveStoreStatus,
  SaveSummary,
  SaveWriteRequest,
  StorageDirectoryEntryLike,
  StorageDirectoryLike,
  StorageFileLike,
  StorageWritableLike,
} from "./save-store-types";

export const PERSISTENCE_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/persistence",
  "package",
);

export const PERSISTENCE_PROTOCOL_SOURCE: string = SIM_PROTOCOL_SMOKE.packageName;
