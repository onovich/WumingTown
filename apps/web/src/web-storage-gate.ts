/// <reference lib="dom" />

import {
  buildM6GateSaveEnvelope,
  decodeM6GateSaveEnvelope,
  encodeM6GateSaveEnvelope,
} from "@wuming-town/platform";
import type {
  PlatformCallResult,
  PlatformPortError,
  PlatformPorts,
  PlatformSaveExportPayload,
  PlatformSaveSummary,
  PlatformSaveStoreStatus,
} from "@wuming-town/platform";
import type {
  ShellState,
  ShellStorageActions,
  ShellStorageDiagnosticState,
  ShellStorageGateState,
  ShellStore,
} from "@wuming-town/ui-react";
import { getEntityTile } from "@wuming-town/ui-react";

import { WEB_PRODUCT_GATE_HARNESS } from "./product-gate-harness";

export const WEB_STORAGE_SAVE_ID = "m6-gate-slot";

const WINDOWS_INTEROP_DETAIL =
  "Blocked: the current Windows shell still exposes placeholder unavailable save ports, so Windows/Web container interoperability is not yet proven for M6.";

export interface WebStorageDebugState {
  readonly interoperabilityVerdict: "blocked" | "pending" | "proven";
  readonly lastActionLabel: string;
  readonly quotaAvailableBytes: number | null;
  readonly quotaBytes: number | null;
  readonly saveSlotCount: number;
  readonly statusTone: "danger" | "stable" | "warning";
  readonly storageKindLabel: string;
  readonly usageBytes: number | null;
  readonly diagnosticCode: string | undefined;
}

export interface WebStorageGateController {
  readonly actions: ShellStorageActions;
  readDebugState(): WebStorageDebugState;
  refresh(): Promise<void>;
}

export function createInitialStorageGateState(): ShellStorageGateState {
  return Object.freeze({
    diagnostic: undefined,
    interoperabilityDetail: WINDOWS_INTEROP_DETAIL,
    interoperabilityVerdict: "blocked",
    lastActionLabel: "Booting storage gate",
    quotaAvailableBytes: null,
    quotaBytes: null,
    saveId: WEB_STORAGE_SAVE_ID,
    saveSlots: Object.freeze([]),
    scopeNote:
      "M6 gate envelope only. This stores read-only shell evidence and does not promise public save compatibility beyond the product gate.",
    statusDetail: "Checking OPFS availability, quota estimate and existing save slots.",
    statusTone: "warning",
    storageKindLabel: "Checking OPFS",
    usageBytes: null,
    userMessage: "Preparing browser storage evidence.",
  });
}

export function createWebStorageGateController(input: {
  readonly onStorageGateStateChange?: () => void;
  readonly platformPorts: PlatformPorts;
  readonly store: ShellStore;
}): WebStorageGateController {
  const actions: ShellStorageActions = Object.freeze({
    onDeleteSave: async (): Promise<void> => {
      await runDeleteSave(input.platformPorts, input.store, input.onStorageGateStateChange);
    },
    onExportSave: async (): Promise<void> => {
      await runExportSave(input.platformPorts, input.store, input.onStorageGateStateChange);
    },
    onImportFile: async (file: File): Promise<void> => {
      await runImportFile(input.platformPorts, input.store, file, input.onStorageGateStateChange);
    },
    onLoadSave: async (): Promise<void> => {
      await runLoadSave(input.platformPorts, input.store, input.onStorageGateStateChange);
    },
    onRefreshStorage: async (): Promise<void> => {
      await refreshStorageState(input.platformPorts, input.store, input.onStorageGateStateChange);
    },
    onSaveFixture: async (): Promise<void> => {
      await runSaveFixture(input.platformPorts, input.store, input.onStorageGateStateChange);
    },
  });

  return {
    actions,
    readDebugState(): WebStorageDebugState {
      const state = input.store.getSnapshot().storageGate;
      return {
        diagnosticCode: state.diagnostic?.code,
        interoperabilityVerdict: state.interoperabilityVerdict,
        lastActionLabel: state.lastActionLabel,
        quotaAvailableBytes: state.quotaAvailableBytes,
        quotaBytes: state.quotaBytes,
        saveSlotCount: state.saveSlots.length,
        statusTone: state.statusTone,
        storageKindLabel: state.storageKindLabel,
        usageBytes: state.usageBytes,
      };
    },
    async refresh(): Promise<void> {
      await refreshStorageState(input.platformPorts, input.store, input.onStorageGateStateChange);
    },
  };
}

async function refreshStorageState(
  platformPorts: PlatformPorts,
  store: ShellStore,
  onStorageGateStateChange?: () => void,
): Promise<void> {
  const listResult = await platformPorts.saveStore.list();
  const describeResult = await readSaveStoreStatus(platformPorts);
  if (!listResult.ok) {
    applyFailureState(store, "Refresh storage", listResult.error);
    onStorageGateStateChange?.();
    return;
  }

  if (!describeResult.ok) {
    applyFailureState(store, "Refresh storage", describeResult.error);
    onStorageGateStateChange?.();
    return;
  }

  const storageKindLabel = describeResult.value.available ? "OPFS ready" : "OPFS unavailable";
  updateStorageGate(store, {
    diagnostic: undefined,
    lastActionLabel: "Refresh storage",
    quotaAvailableBytes: describeResult.value.quota.availableBytes,
    quotaBytes: describeResult.value.quota.quotaBytes,
    saveSlots: Object.freeze(listResult.value.map(mapSlotState)),
    statusDetail: `${String(listResult.value.length)} save slot(s) visible in OPFS.`,
    statusTone: "stable",
    storageKindLabel,
    usageBytes: describeResult.value.quota.usageBytes,
    userMessage: "Web storage evidence is current.",
  });
  onStorageGateStateChange?.();
}

async function runDeleteSave(
  platformPorts: PlatformPorts,
  store: ShellStore,
  onStorageGateStateChange?: () => void,
): Promise<void> {
  const removeResult = await platformPorts.saveStore.remove(WEB_STORAGE_SAVE_ID);
  if (!removeResult.ok) {
    applyFailureState(store, "Delete save", removeResult.error);
    onStorageGateStateChange?.();
    return;
  }

  await refreshStorageState(platformPorts, store, onStorageGateStateChange);
  updateStorageGate(store, {
    diagnostic: undefined,
    lastActionLabel: "Delete save",
    statusDetail: "Removed the Web storage gate slot from OPFS.",
    statusTone: "stable",
    userMessage: "Deleted the local gate save.",
  });
  onStorageGateStateChange?.();
}

async function runExportSave(
  platformPorts: PlatformPorts,
  store: ShellStore,
  onStorageGateStateChange?: () => void,
): Promise<void> {
  const exportResult =
    platformPorts.saveStore.export === undefined
      ? await buildExportFromRead(platformPorts)
      : await platformPorts.saveStore.export(WEB_STORAGE_SAVE_ID);
  if (!exportResult.ok) {
    applyFailureState(store, "Export save", exportResult.error);
    onStorageGateStateChange?.();
    return;
  }

  triggerDownload(exportResult.value);
  updateStorageGate(store, {
    diagnostic: undefined,
    lastActionLabel: "Export save",
    statusDetail: `${exportResult.value.summary.checksumSha256Hex.slice(0, 12)}... | ${String(exportResult.value.summary.sizeBytes)} bytes`,
    statusTone: "stable",
    userMessage: "Exported the gate save as a browser download.",
  });
  onStorageGateStateChange?.();
}

async function runImportFile(
  platformPorts: PlatformPorts,
  store: ShellStore,
  file: File,
  onStorageGateStateChange?: () => void,
): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let decoded;
  try {
    decoded = await decodeM6GateSaveEnvelope(bytes);
    validateEnvelopeSelection(store.getSnapshot(), decoded.data.selectedEntityId);
  } catch (error) {
    applyFailureState(store, "Import save", createInvalidEnvelopeError(file.name, error));
    onStorageGateStateChange?.();
    return;
  }

  const writeResult = await platformPorts.saveStore.writeAtomic({
    data: bytes,
    id: WEB_STORAGE_SAVE_ID,
  });
  if (!writeResult.ok) {
    applyFailureState(store, "Import save", writeResult.error);
    onStorageGateStateChange?.();
    return;
  }

  await refreshStorageState(platformPorts, store, onStorageGateStateChange);
  updateStorageGate(store, {
    diagnostic: undefined,
    lastActionLabel: "Import save",
    statusDetail: `${file.name} | ${decoded.checksumSha256Hex.slice(0, 12)}...`,
    statusTone: "stable",
    userMessage: "Imported the gate save into OPFS. Load it to restore the shell state.",
  });
  onStorageGateStateChange?.();
}

async function runLoadSave(
  platformPorts: PlatformPorts,
  store: ShellStore,
  onStorageGateStateChange?: () => void,
): Promise<void> {
  const readResult = await platformPorts.saveStore.read(WEB_STORAGE_SAVE_ID);
  if (!readResult.ok) {
    applyFailureState(store, "Load save", readResult.error);
    onStorageGateStateChange?.();
    return;
  }

  let decoded;
  try {
    decoded = await decodeM6GateSaveEnvelope(new Uint8Array(readResult.value));
    validateEnvelopeSelection(store.getSnapshot(), decoded.data.selectedEntityId);
  } catch (error) {
    applyFailureState(store, "Load save", createInvalidEnvelopeError("opfs", error));
    onStorageGateStateChange?.();
    return;
  }

  const currentState = store.getSnapshot();
  store.setState({
    ...currentState,
    inspectedTile: getEntityTile(
      currentState.readModel,
      decoded.data.selectedEntityId ?? undefined,
    ),
    lastInputLabel: `Loaded ${decoded.data.lastInputLabel}`,
    selectedEntityId: decoded.data.selectedEntityId ?? undefined,
    storageGate: withStorageGatePatch(currentState.storageGate, {
      diagnostic: undefined,
      lastActionLabel: "Load save",
      statusDetail: `${decoded.checksumSha256Hex.slice(0, 12)}... | ${decoded.data.runtimeBrowser}`,
      statusTone: "stable",
      userMessage: "Loaded the gate save and restored the shell selection.",
    }),
  });
  onStorageGateStateChange?.();
}

async function runSaveFixture(
  platformPorts: PlatformPorts,
  store: ShellStore,
  onStorageGateStateChange?: () => void,
): Promise<void> {
  const bytes = await encodeM6GateSaveEnvelope(buildEnvelope(store.getSnapshot()));
  const writeResult = await platformPorts.saveStore.writeAtomic({
    data: bytes,
    id: WEB_STORAGE_SAVE_ID,
  });
  if (!writeResult.ok) {
    applyFailureState(store, "Save fixture", writeResult.error);
    onStorageGateStateChange?.();
    return;
  }

  await refreshStorageState(platformPorts, store, onStorageGateStateChange);
  updateStorageGate(store, {
    diagnostic: undefined,
    lastActionLabel: "Save fixture",
    statusDetail: `${writeResult.value.checksumSha256Hex.slice(0, 12)}... | ${String(writeResult.value.sizeBytes)} bytes`,
    statusTone: "stable",
    userMessage: "Saved the current shell evidence envelope into OPFS.",
  });
  onStorageGateStateChange?.();
}

function applyFailureState(store: ShellStore, actionLabel: string, error: PlatformPortError): void {
  updateStorageGate(store, {
    diagnostic: mapDiagnostic(error),
    lastActionLabel: actionLabel,
    statusDetail: error.message,
    statusTone: error.recoverable === true ? "warning" : "danger",
    userMessage: error.userMessage ?? error.message,
  });
}

async function buildExportFromRead(
  platformPorts: PlatformPorts,
): Promise<PlatformCallResult<PlatformSaveExportPayload>> {
  const listResult = await platformPorts.saveStore.list();
  if (!listResult.ok) {
    return listResult;
  }

  const summary = listResult.value.find((candidate) => candidate.id === WEB_STORAGE_SAVE_ID);
  if (summary === undefined) {
    return {
      error: {
        code: "save_not_found",
        message: "Save m6-gate-slot does not exist.",
        userMessage: "There is no saved gate slot to export yet.",
      },
      ok: false,
    };
  }

  const readResult = await platformPorts.saveStore.read(WEB_STORAGE_SAVE_ID);
  if (!readResult.ok) {
    return readResult;
  }

  return {
    ok: true,
    value: {
      bytes: new Uint8Array(readResult.value),
      mediaType: "application/vnd.wuming-town.m6-gate+json",
      suggestedFileName: `wuming-town-${WEB_STORAGE_SAVE_ID}.wtsave`,
      summary,
    },
  };
}

function buildEnvelope(state: ShellState): ReturnType<typeof buildM6GateSaveEnvelope> {
  return buildM6GateSaveEnvelope({
    fixtureId: state.releaseGate.fixtureId,
    lastInputLabel: state.lastInputLabel,
    readModelHash: WEB_PRODUCT_GATE_HARNESS.primaryEvidence.finalReadModelHash,
    releaseGateTitle: state.releaseGate.title,
    runtimeBrowser: state.releaseGate.runtimeBrowser,
    savedAtUnixMs: Date.now(),
    selectedEntityId: state.selectedEntityId,
  });
}

function createInvalidEnvelopeError(sourceName: string, error: unknown): PlatformPortError {
  return {
    code: "invalid_envelope",
    detail: {
      sourceName,
    },
    message: error instanceof Error ? error.message : "The save envelope could not be decoded.",
    recoverable: true,
    userMessage: "That file is not a valid M6 gate save envelope.",
  };
}

function mapDiagnostic(error: PlatformPortError): ShellStorageDiagnosticState {
  return {
    code: error.code,
    detailJson: JSON.stringify(error.detail ?? {}, null, 2),
    message: error.message,
    recoverable: error.recoverable ?? false,
    userMessage: error.userMessage ?? error.message,
  };
}

function mapSlotState(summary: PlatformSaveSummary): ShellStorageGateState["saveSlots"][number] {
  return Object.freeze({
    checksumSha256Hex: summary.checksumSha256Hex,
    id: summary.id,
    sizeBytes: summary.sizeBytes,
    updatedAtUnixMs: summary.updatedAtUnixMs,
  });
}

async function readSaveStoreStatus(
  platformPorts: PlatformPorts,
): Promise<PlatformCallResult<PlatformSaveStoreStatus>> {
  if (platformPorts.saveStore.describe !== undefined) {
    return platformPorts.saveStore.describe();
  }

  return {
    error: {
      code: "unavailable",
      message: "The current platform bridge does not expose storage status.",
      userMessage: "This platform cannot report its storage status for the product gate yet.",
    },
    ok: false,
  };
}

function triggerDownload(payload: PlatformSaveExportPayload): void {
  const blob = new Blob([cloneBytes(payload.bytes)], {
    type: payload.mediaType,
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = payload.suggestedFileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

function updateStorageGate(store: ShellStore, patch: Partial<ShellStorageGateState>): void {
  const currentState = store.getSnapshot();
  store.setState({
    ...currentState,
    storageGate: withStorageGatePatch(currentState.storageGate, patch),
  });
}

function validateEnvelopeSelection(state: ShellState, selectedEntityId: string | null): void {
  if (selectedEntityId === null) {
    return;
  }

  for (const entity of state.readModel.entities) {
    if (entity.entityId === selectedEntityId) {
      return;
    }
  }

  throw new Error(
    `Selected entity ${selectedEntityId} is not present in the current gate fixture.`,
  );
}

function withStorageGatePatch(
  state: ShellStorageGateState,
  patch: Partial<ShellStorageGateState>,
): ShellStorageGateState {
  return Object.freeze({
    ...state,
    ...patch,
  });
}

function cloneBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
