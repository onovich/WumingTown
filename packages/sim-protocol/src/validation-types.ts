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
