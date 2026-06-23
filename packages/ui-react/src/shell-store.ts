import type {
  TileCoordinate,
  WorldEntityReadModel,
  WorldReadModel,
} from "@wuming-town/sim-protocol";

export interface ShellState {
  readonly readModel: WorldReadModel;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly zoom: number;
  readonly lastInputLabel: string;
  readonly selectedEntityId: string | undefined;
  readonly hoverTile: TileCoordinate | undefined;
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
