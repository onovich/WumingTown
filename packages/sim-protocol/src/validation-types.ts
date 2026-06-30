import type { MainToSimulationMessageKind, ProtocolRejection } from "./types";
import type { SIM_PROTOCOL_VERSION, SIM_SCHEMA_VERSION } from "./constants";

export interface ProtocolInputRecord {
  readonly [key: string]: unknown;
  readonly catalogVersion?: unknown;
  readonly checkpointSequence?: unknown;
  readonly command?: unknown;
  readonly commandId?: unknown;
  readonly commands?: unknown;
  readonly entityId?: unknown;
  readonly kind?: unknown;
  readonly payload?: unknown;
  readonly paused?: unknown;
  readonly protocolVersion?: unknown;
  readonly reason?: unknown;
  readonly saveId?: unknown;
  readonly schemaVersion?: unknown;
  readonly seed?: unknown;
  readonly sequence?: unknown;
  readonly sessionId?: unknown;
  readonly speed?: unknown;
  readonly subject?: unknown;
  readonly text?: unknown;
  readonly anchorCell?: unknown;
  readonly basis?: unknown;
  readonly basisReadModelHash?: unknown;
  readonly basisSnapshotSequence?: unknown;
  readonly basisTick?: unknown;
  readonly blueprint?: unknown;
  readonly blueprintDefId?: unknown;
  readonly cellIndex?: unknown;
  readonly contentManifestHash?: unknown;
  readonly entity?: unknown;
  readonly gapId?: unknown;
  readonly generation?: unknown;
  readonly index?: unknown;
  readonly jobVersion?: unknown;
  readonly mapVersion?: unknown;
  readonly orientation?: unknown;
  readonly playableCommandContractVersion?: unknown;
  readonly priorityBand?: unknown;
  readonly requestedAction?: unknown;
  readonly reservationVersion?: unknown;
  readonly site?: unknown;
  readonly siteId?: unknown;
  readonly target?: unknown;
  readonly targetVersion?: unknown;
  readonly x?: unknown;
  readonly y?: unknown;
}

export interface ValidMainEnvelopeRecord {
  readonly protocolVersion: typeof SIM_PROTOCOL_VERSION;
  readonly schemaVersion: typeof SIM_SCHEMA_VERSION;
  readonly sessionId: string;
  readonly sequence: number;
  readonly kind: MainToSimulationMessageKind;
  readonly payload: unknown;
}

export type PayloadValidationResult<TPayload> =
  | {
      readonly ok: true;
      readonly payload: TPayload;
    }
  | {
      readonly ok: false;
      readonly reason: ProtocolRejection;
    };
