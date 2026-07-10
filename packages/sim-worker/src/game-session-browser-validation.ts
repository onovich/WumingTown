import {
  SIMULATION_TO_MAIN_MESSAGE_KIND,
  SIM_PROTOCOL_VERSION,
  SIM_SCHEMA_VERSION,
  sameGameSessionProjectionBasis,
  validateGameSessionAlertsV1,
  validateGameSessionReadyContract,
  validateGameSessionRenderProjectionV1,
  validateGameSessionUiProjectionV1,
  type GameSessionProjectionBasisV1,
  type GameSessionProjectionRequestV1,
  type SimulationToMainMessage,
} from "@wuming-town/sim-protocol";

export type GameSessionBrowserValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly detail: string };

export class GameSessionBrowserProjectionValidator {
  private request: GameSessionProjectionRequestV1 | null = null;
  private readyAccepted = false;
  private latestRenderBasis: GameSessionProjectionBasisV1 | undefined;
  private pendingUiBasis: GameSessionProjectionBasisV1 | undefined;

  reset(request: GameSessionProjectionRequestV1 | null): void {
    this.request = request;
    this.readyAccepted = false;
    this.latestRenderBasis = undefined;
    this.pendingUiBasis = undefined;
  }

  isDroppableStaleRender(message: SimulationToMainMessage): boolean {
    return (
      this.latestRenderBasis !== undefined &&
      message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot &&
      Number.isSafeInteger(message.payload.snapshotSequence) &&
      message.payload.snapshotSequence >= 0 &&
      message.payload.snapshotSequence < this.latestRenderBasis.snapshotSequence
    );
  }

  validate(message: SimulationToMainMessage): GameSessionBrowserValidationResult {
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.Ready) {
      return this.validateReady(message);
    }
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot) {
      return this.validateRender(message);
    }
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta) {
      return this.validateUi(message);
    }
    if (message.kind === SIMULATION_TO_MAIN_MESSAGE_KIND.AlertBatch) {
      return this.validateAlerts(message);
    }
    return VALID;
  }

  private validateReady(
    message: Extract<
      SimulationToMainMessage,
      { readonly kind: typeof SIMULATION_TO_MAIN_MESSAGE_KIND.Ready }
    >,
  ): GameSessionBrowserValidationResult {
    if (this.readyAccepted) return invalid("GameSession Ready was already accepted");
    if (
      message.payload.acceptedProtocolVersion !== SIM_PROTOCOL_VERSION ||
      message.payload.acceptedSchemaVersion !== SIM_SCHEMA_VERSION
    ) {
      return invalid("Ready accepted versions or status do not match this browser session");
    }
    if (this.request === null) {
      if (message.payload.projectionContract !== undefined) {
        return invalid("Legacy Ready unexpectedly declared a GameSession projection contract");
      }
      this.readyAccepted = true;
      return VALID;
    }
    const result = validateGameSessionReadyContract(
      message.payload.projectionContract,
      this.request,
    );
    if (!result.ok) return invalid(result.reason.detail);
    this.readyAccepted = true;
    return VALID;
  }

  private validateRender(
    message: Extract<
      SimulationToMainMessage,
      { readonly kind: typeof SIMULATION_TO_MAIN_MESSAGE_KIND.RenderSnapshot }
    >,
  ): GameSessionBrowserValidationResult {
    const projection = message.payload.gameSession;
    if (this.request === null) {
      return projection === undefined
        ? VALID
        : invalid("Legacy render unexpectedly included a GameSession projection");
    }
    if (projection === undefined) {
      return invalid("Negotiated RenderSnapshot is missing gameSession");
    }
    if (!this.readyAccepted) return invalid("GameSession render arrived before accepted Ready");
    const result = validateGameSessionRenderProjectionV1(projection);
    if (!result.ok) return invalid(result.reason.detail);
    if (
      message.payload.snapshotSequence !== projection.basis.snapshotSequence ||
      message.payload.tick !== projection.basis.tick ||
      message.payload.worldHash !== projection.basis.worldHash ||
      message.payload.readModelHash !== projection.basis.readModelHash
    ) {
      return invalid("RenderSnapshot envelope facts do not match the GameSession basis");
    }
    if (
      this.pendingUiBasis !== undefined &&
      !sameGameSessionProjectionBasis(this.pendingUiBasis, projection.basis)
    ) {
      return invalid("Pending GameSession UI basis does not match the newer render");
    }
    this.pendingUiBasis = undefined;
    this.latestRenderBasis = projection.basis;
    return VALID;
  }

  private validateUi(
    message: Extract<
      SimulationToMainMessage,
      { readonly kind: typeof SIMULATION_TO_MAIN_MESSAGE_KIND.UiDelta }
    >,
  ): GameSessionBrowserValidationResult {
    const projection = message.payload.gameSession;
    if (this.request === null) {
      return projection === undefined
        ? VALID
        : invalid("Legacy UI unexpectedly included a GameSession projection");
    }
    if (projection === undefined) return invalid("Negotiated UiDelta is missing gameSession");
    if (!this.readyAccepted) return invalid("GameSession UI arrived before accepted Ready");
    const result = validateGameSessionUiProjectionV1(projection);
    if (!result.ok) return invalid(result.reason.detail);
    if (
      message.payload.tick !== projection.basis.tick ||
      message.payload.readModelHash !== projection.basis.readModelHash
    ) {
      return invalid("UiDelta envelope facts do not match the GameSession basis");
    }
    if (this.latestRenderBasis === undefined) {
      this.pendingUiBasis = projection.basis;
      return VALID;
    }
    if (projection.basis.snapshotSequence === this.latestRenderBasis.snapshotSequence) {
      return sameGameSessionProjectionBasis(this.latestRenderBasis, projection.basis)
        ? VALID
        : invalid("GameSession render and UI projection basis is incoherent");
    }
    if (projection.basis.snapshotSequence === this.latestRenderBasis.snapshotSequence + 1) {
      this.pendingUiBasis = projection.basis;
      return VALID;
    }
    return invalid("GameSession UI references an unknown render snapshot sequence");
  }

  private validateAlerts(
    message: Extract<
      SimulationToMainMessage,
      { readonly kind: typeof SIMULATION_TO_MAIN_MESSAGE_KIND.AlertBatch }
    >,
  ): GameSessionBrowserValidationResult {
    const alerts = message.payload.gameSession;
    if (alerts === undefined) return VALID;
    if (this.request === null) {
      return invalid("Legacy alert batch unexpectedly included GameSession alerts");
    }
    if (!this.readyAccepted) return invalid("GameSession alerts arrived before accepted Ready");
    const result = validateGameSessionAlertsV1(alerts);
    return result.ok ? VALID : invalid(result.reason.detail);
  }
}

function invalid(detail: string): GameSessionBrowserValidationResult {
  return { ok: false, detail };
}

const VALID: GameSessionBrowserValidationResult = { ok: true };
