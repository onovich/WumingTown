import type { EntityId } from "./entity-id";
import type { GameSessionOwnerGraph } from "./game-session-initializer";
import { GAME_SESSION_NO_JOB } from "./game-session-types";
import type { Tick } from "./time";

const PR1_MINIMAL_JOB_ID = 0;
const PR1_MINIMAL_JOB_KIND = 1;
const PR1_MINIMAL_JOB_WORK_Q16 = 2 * 65_536;
const PR1_MINIMAL_JOB_TICK_Q16 = 65_536;
const PR1_MINIMAL_JOB_LEASE_TICKS = 30;

interface MutableEntityId {
  index: number;
  generation: number;
}

interface MutableJobCreateInput {
  jobId: number;
  owner: MutableEntityId;
  jobKind: number;
  targetId: number;
  initialStep: "reserve";
  interruptionPolicy: "at_safe_point";
  requiredWorkQ16: number;
  createdTick: number;
}

interface MutableCellClaim {
  readonly channel: "cell";
  cellIndex: number;
}

interface MutableReservationRequest {
  owner: MutableEntityId;
  jobId: number;
  createdTick: Tick;
  leaseExpiryTick: Tick;
  readonly claims: readonly MutableCellClaim[];
}

export class GameSessionJobLifecycle {
  private readonly owners: GameSessionOwnerGraph;
  private readonly jobOwner: MutableEntityId = { index: 0, generation: 0 };
  private readonly reservationOwner: MutableEntityId = { index: 0, generation: 0 };
  private readonly cellClaim: MutableCellClaim = { channel: "cell", cellIndex: 0 };
  private readonly reservationClaims: readonly MutableCellClaim[];
  private readonly jobInput: MutableJobCreateInput;
  private readonly reservationRequest: MutableReservationRequest;
  private selectedResidentId = GAME_SESSION_NO_JOB;
  private selectedOfferId = GAME_SESSION_NO_JOB;
  private activeJobIdValue = GAME_SESSION_NO_JOB;
  private lifecycleStarted = false;
  private activePeakValue = 0;
  private reservationPeakValue = 0;
  private eventResultObjectCallCountValue = 0;

  constructor(owners: GameSessionOwnerGraph) {
    this.owners = owners;
    this.reservationClaims = [this.cellClaim];
    this.jobInput = {
      jobId: PR1_MINIMAL_JOB_ID,
      owner: this.jobOwner,
      jobKind: PR1_MINIMAL_JOB_KIND,
      targetId: 0,
      initialStep: "reserve",
      interruptionPolicy: "at_safe_point",
      requiredWorkQ16: PR1_MINIMAL_JOB_WORK_Q16,
      createdTick: 0,
    };
    this.reservationRequest = {
      owner: this.reservationOwner,
      jobId: PR1_MINIMAL_JOB_ID,
      createdTick: 0,
      leaseExpiryTick: PR1_MINIMAL_JOB_LEASE_TICKS,
      claims: this.reservationClaims,
    };
  }

  get activeJobCount(): number {
    return this.activeJobIdValue === GAME_SESSION_NO_JOB ? 0 : 1;
  }

  get activePeak(): number {
    return this.activePeakValue;
  }

  get reservationPeak(): number {
    return this.reservationPeakValue;
  }

  get eventResultObjectCallCount(): number {
    return this.eventResultObjectCallCountValue;
  }

  selectCandidate(residentId: number, offerId: number): void {
    if (this.lifecycleStarted || this.activeJobIdValue !== GAME_SESSION_NO_JOB) return;
    this.selectedResidentId = residentId;
    this.selectedOfferId = offerId;
  }

  acquireSelected(tick: Tick): void {
    if (
      this.lifecycleStarted ||
      this.selectedResidentId === GAME_SESSION_NO_JOB ||
      this.selectedOfferId === GAME_SESSION_NO_JOB
    ) {
      return;
    }

    const resident = this.owners.residents.read(this.selectedResidentId);
    const offer = this.owners.workOffers.readOffer(this.selectedOfferId);
    this.eventResultObjectCallCountValue += 2;
    if (resident === undefined || offer === undefined) return;

    this.lifecycleStarted = true;
    this.writeEntity(this.jobOwner, resident.entity);
    this.jobInput.targetId = offer.targetId;
    this.jobInput.createdTick = tick;
    const created = this.owners.jobs.createJob(this.jobInput, this.owners.entities);
    this.eventResultObjectCallCountValue += 1;
    if (!created.ok) return;

    this.writeEntity(this.reservationOwner, resident.entity);
    this.reservationRequest.createdTick = tick;
    this.reservationRequest.leaseExpiryTick = tick + PR1_MINIMAL_JOB_LEASE_TICKS;
    this.cellClaim.cellIndex = offer.targetCellIndex;
    const acquired = this.owners.reservations.acquire(
      this.reservationRequest,
      this.owners.entities,
    );
    this.eventResultObjectCallCountValue += 1;
    if (!acquired.ok) {
      this.owners.jobs.failJob(PR1_MINIMAL_JOB_ID, tick, "reservation");
      this.owners.residents.setJobState(
        this.selectedResidentId,
        GAME_SESSION_NO_JOB,
        "idle",
        "game_session.job_failed",
      );
      this.eventResultObjectCallCountValue += 2;
      return;
    }

    this.activeJobIdValue = PR1_MINIMAL_JOB_ID;
    this.activePeakValue = 1;
    if (this.owners.reservations.activeCount > this.reservationPeakValue) {
      this.reservationPeakValue = this.owners.reservations.activeCount;
    }
    this.owners.residents.setJobState(
      this.selectedResidentId,
      PR1_MINIMAL_JOB_ID,
      "moving",
      "game_session.job_reserved",
    );
    this.eventResultObjectCallCountValue += 1;
  }

  advanceActive(tick: Tick): void {
    if (this.activeJobIdValue === GAME_SESSION_NO_JOB) return;
    const job = this.owners.jobs.readJob(this.activeJobIdValue);
    this.eventResultObjectCallCountValue += 1;
    if (job === undefined) {
      this.activeJobIdValue = GAME_SESSION_NO_JOB;
      return;
    }

    if (job.status === "ready") {
      const entered = this.owners.jobs.enterStep(job.jobId, "interact", tick);
      this.eventResultObjectCallCountValue += 1;
      if (entered.ok) {
        this.owners.residents.setJobState(
          this.selectedResidentId,
          job.jobId,
          "working",
          "game_session.job_working",
        );
        this.eventResultObjectCallCountValue += 1;
      }
      return;
    }

    if (job.status !== "running") return;
    const advanced = this.owners.jobs.tickJob(job.jobId, tick, PR1_MINIMAL_JOB_TICK_Q16);
    this.eventResultObjectCallCountValue += 1;
    if (!advanced.ok || !advanced.readyToComplete) return;

    const completed = this.owners.jobs.completeJob(job.jobId, tick, this.owners.reservations);
    this.eventResultObjectCallCountValue += 1;
    if (!completed.ok) return;
    this.activeJobIdValue = GAME_SESSION_NO_JOB;
    this.owners.residents.setJobState(
      this.selectedResidentId,
      GAME_SESSION_NO_JOB,
      "idle",
      "game_session.job_completed",
    );
    this.eventResultObjectCallCountValue += 1;
  }

  private writeEntity(target: MutableEntityId, source: EntityId): void {
    target.index = source.index;
    target.generation = source.generation;
  }
}
