import type {
  TileCoordinate,
  WorldEntityReadModel,
  WorldReadModel,
} from "@wuming-town/sim-protocol";

export interface ShellState {
  readonly readModel: WorldReadModel;
  readonly releaseGate: ShellReleaseGateInfo;
  readonly storageGate: ShellStorageGateState;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly zoom: number;
  readonly lastInputLabel: string;
  readonly selectedEntityId: string | undefined;
  readonly hoverTile: TileCoordinate | undefined;
}

export interface ShellReleaseGateLine {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export interface ShellReleaseGateInfo {
  readonly fixtureId: string;
  readonly title: string;
  readonly browserTargets: readonly string[];
  readonly runtimeBrowser: string;
  readonly runtimeCrossOriginIsolated: boolean;
  readonly sections: readonly ShellReleaseGateLine[];
}

export interface ShellStorageDiagnosticState {
  readonly code: string;
  readonly detailJson: string;
  readonly message: string;
  readonly recoverable: boolean;
  readonly userMessage: string;
}

export interface ShellStorageGateState {
  readonly interoperabilityDetail: string;
  readonly interoperabilityVerdict: "blocked" | "pending" | "proven";
  readonly lastActionLabel: string;
  readonly quotaAvailableBytes: number | null;
  readonly quotaBytes: number | null;
  readonly scopeNote: string;
  readonly statusDetail: string;
  readonly statusTone: "danger" | "stable" | "warning";
  readonly storageKindLabel: string;
  readonly usageBytes: number | null;
  readonly userMessage: string;
  readonly saveId: string;
  readonly saveSlots: readonly ShellStorageSlotState[];
  readonly diagnostic: ShellStorageDiagnosticState | undefined;
}

export interface ShellStorageSlotState {
  readonly checksumSha256Hex: string;
  readonly id: string;
  readonly sizeBytes: number;
  readonly updatedAtUnixMs: number;
}

export interface ShellStorageActions {
  readonly onDeleteSave: () => Promise<void>;
  readonly onExportSave: () => Promise<void>;
  readonly onImportFile: (file: File) => Promise<void>;
  readonly onLoadSave: () => Promise<void>;
  readonly onRefreshStorage: () => Promise<void>;
  readonly onSaveFixture: () => Promise<void>;
}

export interface ShellStore {
  getSnapshot(): ShellState;
  subscribe(listener: () => void): () => void;
  setState(nextState: ShellState): void;
}

export function createShellStore(initialState: ShellState): ShellStore {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getSnapshot(): ShellState {
      return state;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
    setState(nextState: ShellState): void {
      if (nextState === state) {
        return;
      }

      state = nextState;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

export function getSelectedEntity(
  state: Pick<ShellState, "readModel" | "selectedEntityId">,
): WorldEntityReadModel | undefined {
  const selectedEntityId = state.selectedEntityId;
  if (selectedEntityId === undefined) {
    return undefined;
  }

  for (const entity of state.readModel.entities) {
    if (entity.entityId === selectedEntityId) {
      return entity;
    }
  }

  return undefined;
}
