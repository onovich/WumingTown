import {
  DEFAULT_WALK_COST_MILLI,
  MAP_DIRECTION_EAST,
  MAP_DIRECTION_NORTH,
  MAP_DIRECTION_SOUTH,
  MAP_DIRECTION_WEST,
  type MapCardinalMovementIntoOutput,
  type MapGrid,
  type MapMovementCellIntoOutput,
} from "./map-grid";
import type { Tick } from "./time";

export type PathReason =
  | "path_cell_capacity_exceeded"
  | "path_request_sequence_invalid"
  | "path_tick_invalid"
  | "path_start_out_of_range"
  | "path_goal_out_of_range"
  | "path_start_blocked"
  | "path_goal_blocked"
  | "path_no_route"
  | "path_node_budget_exhausted"
  | "path_queue_full"
  | "path_queue_empty"
  | "path_stale_result"
  | "path_candidate_limit_invalid"
  | "path_output_capacity_exceeded";

export interface PathVersionBasis {
  readonly mapVersion: number;
  readonly navigationVersion: number;
  readonly regionVersion: number;
  readonly roomVersion: number;
  readonly regionGraphVersion: number;
}

export interface PathRequest {
  readonly requestSequence: number;
  readonly issuedTick: Tick;
  readonly startCellIndex: number;
  readonly goalCellIndex: number;
  readonly basis: PathVersionBasis;
  readonly maxNodeExpansions?: number;
}

export type PathSearchResult =
  | {
      readonly ok: true;
      readonly requestSequence: number;
      readonly basis: PathVersionBasis;
      readonly startCellIndex: number;
      readonly goalCellIndex: number;
      readonly path: Uint32Array;
      readonly pathCellCount: number;
      readonly pathCostMilli: number;
      readonly nodeExpansions: number;
    }
  | {
      readonly ok: false;
      readonly requestSequence: number;
      readonly basis: PathVersionBasis;
      readonly startCellIndex: number;
      readonly goalCellIndex: number;
      readonly reason: PathReason;
      readonly nodeExpansions: number;
    };

export interface PathSearchIntoOutput {
  ok: boolean;
  reason: PathReason | undefined;
  requestSequence: number;
  startCellIndex: number;
  goalCellIndex: number;
  mapVersion: number;
  navigationVersion: number;
  regionVersion: number;
  roomVersion: number;
  regionGraphVersion: number;
  pathCellCount: number;
  pathCostMilli: number;
  nodeExpansions: number;
}

export type PathEnqueueResult =
  | {
      readonly ok: true;
      readonly queuedCount: number;
      readonly queueBacklogPeak: number;
    }
  | {
      readonly ok: false;
      readonly reason: PathReason;
    };

export type PathBatchProcessResult =
  | {
      readonly ok: true;
      readonly processed: true;
      readonly result: PathSearchResult;
      readonly queuedCount: number;
    }
  | {
      readonly ok: true;
      readonly processed: false;
      readonly queuedCount: 0;
    }
  | {
      readonly ok: false;
      readonly reason: PathReason;
    };

export type PathCommitResult =
  | {
      readonly ok: true;
      readonly accepted: true;
      readonly result: PathSearchResult;
      readonly acceptedResultCount: number;
    }
  | {
      readonly ok: false;
      readonly accepted: false;
      readonly reason: Extract<PathReason, "path_stale_result">;
      readonly staleRejectedCount: number;
    };

export interface PathBatcherMetrics {
  readonly queuedCount: number;
  readonly processedCount: number;
  readonly acceptedResultCount: number;
  readonly staleRejectedCount: number;
  readonly queueBacklogPeak: number;
  readonly nodeExpansionTotal: number;
}

export interface PathCandidate {
  readonly candidateId: number;
  readonly targetCellIndex: number;
  readonly scoreMilli: number;
}

export interface TopKPathResolutionOptions {
  readonly originCellIndex: number;
  readonly candidates: readonly PathCandidate[];
  readonly maxExactPaths: number;
  readonly basis: PathVersionBasis;
  readonly issuedTick: Tick;
  readonly requestSequenceStart: number;
  readonly maxNodeExpansions?: number;
}

export type TopKPathResolutionResult =
  | {
      readonly ok: true;
      readonly candidateCount: number;
      readonly selectedCount: number;
      readonly exactPathCount: number;
      readonly capHitCount: number;
      readonly nodeExpansions: number;
      readonly results: readonly PathSearchResult[];
    }
  | {
      readonly ok: false;
      readonly reason: PathReason;
    };

const PATH_SEARCH_EPOCH_MAX = 0xffff_ffff;
const UINT32_INFINITY = 0xffff_ffff;

export class GridPathfinder {
  readonly cellCapacity: number;

  private readonly openCells: Uint32Array;
  private readonly parentCell: Uint32Array;
  private readonly gCostMilli: Uint32Array;
  private readonly fCostMilli: Uint32Array;
  private readonly seenEpoch: Uint32Array;
  private readonly closedEpoch: Uint32Array;
  private readonly pathScratch: Uint32Array;
  private readonly movementCellOutput: MapMovementCellIntoOutput;
  private readonly cardinalMovementOutput: MapCardinalMovementIntoOutput;
  private searchEpoch = 0;

  constructor(cellCapacity: number) {
    this.cellCapacity = requirePositiveSafeInteger(cellCapacity, "path cell capacity");
    this.openCells = new Uint32Array(cellCapacity);
    this.parentCell = new Uint32Array(cellCapacity);
    this.gCostMilli = new Uint32Array(cellCapacity);
    this.fCostMilli = new Uint32Array(cellCapacity);
    this.seenEpoch = new Uint32Array(cellCapacity);
    this.closedEpoch = new Uint32Array(cellCapacity);
    this.pathScratch = new Uint32Array(cellCapacity);
    this.movementCellOutput = {
      ok: false,
      reason: undefined,
      passable: false,
      walkCostMilli: 0,
      cellVersion: 0,
    };
    this.cardinalMovementOutput = { ok: false, reason: undefined, passable: false };
  }

  findPath(grid: MapGrid, request: PathRequest): PathSearchResult {
    const header = this.validateRequest(grid, request);

    if (!header.ok) {
      return this.createFailure(request, header.reason, 0);
    }

    if (request.startCellIndex === request.goalCellIndex) {
      return this.createTrivialPath(request);
    }

    const startPassable = grid.isCellPassableByIndex(request.startCellIndex);

    if (!startPassable.ok || !startPassable.passable) {
      return this.createFailure(request, "path_start_blocked", 0);
    }

    const goalPassable = grid.isCellPassableByIndex(request.goalCellIndex);

    if (!goalPassable.ok || !goalPassable.passable) {
      return this.createFailure(request, "path_goal_blocked", 0);
    }

    const maxNodeExpansions = request.maxNodeExpansions ?? this.cellCapacity;
    const budget = validateNodeBudget(maxNodeExpansions);

    if (!budget.ok) {
      return this.createFailure(request, budget.reason, 0);
    }

    const epoch = this.nextSearchEpoch();
    let openCount = 1;
    let nodeExpansions = 0;
    this.openCells[0] = request.startCellIndex;
    this.parentCell[request.startCellIndex] = request.startCellIndex;
    this.gCostMilli[request.startCellIndex] = 0;
    this.fCostMilli[request.startCellIndex] = this.heuristicMilli(
      grid,
      request.startCellIndex,
      request.goalCellIndex,
    );
    this.seenEpoch[request.startCellIndex] = epoch;

    while (openCount > 0) {
      const selectedOpenIndex = this.selectBestOpenIndex(openCount);
      const current = this.openCells[selectedOpenIndex] ?? 0;
      openCount -= 1;
      this.openCells[selectedOpenIndex] = this.openCells[openCount] ?? 0;

      if ((this.closedEpoch[current] ?? 0) === epoch) {
        continue;
      }

      if (current === request.goalCellIndex) {
        return this.createFoundPath(request, nodeExpansions);
      }

      if (nodeExpansions >= maxNodeExpansions) {
        return this.createFailure(request, "path_node_budget_exhausted", nodeExpansions);
      }

      this.closedEpoch[current] = epoch;
      nodeExpansions += 1;

      for (let direction = 0; direction < 4; direction += 1) {
        const neighbor = this.neighborIndex(grid, current, direction);

        if (neighbor >= 0) {
          const updated = this.tryRelaxNeighbor(
            grid,
            request.goalCellIndex,
            current,
            neighbor,
            epoch,
          );

          if (updated && openCount < this.openCells.length) {
            this.openCells[openCount] = neighbor;
            openCount += 1;
          }
        }
      }
    }

    return this.createFailure(request, "path_no_route", nodeExpansions);
  }

  findPathInto(
    grid: MapGrid,
    request: PathRequest,
    routeOutput: Uint32Array,
    output: PathSearchIntoOutput,
  ): void {
    this.resetIntoOutput(request, output);
    const invalidReason = this.validateRequestReason(grid, request);
    if (invalidReason !== undefined) {
      output.reason = invalidReason;
      return;
    }

    if (request.startCellIndex === request.goalCellIndex) {
      if (routeOutput.length < 1) {
        output.pathCellCount = 1;
        output.pathCostMilli = 0;
        output.reason = "path_output_capacity_exceeded";
        return;
      }
      routeOutput[0] = request.startCellIndex;
      output.ok = true;
      output.pathCellCount = 1;
      return;
    }

    if (!this.readPassableMovementCellInto(grid, request.startCellIndex)) {
      output.reason = "path_start_blocked";
      return;
    }

    if (!this.readPassableMovementCellInto(grid, request.goalCellIndex)) {
      output.reason = "path_goal_blocked";
      return;
    }

    const maxNodeExpansions = request.maxNodeExpansions ?? this.cellCapacity;
    if (!isPositiveSafeInteger(maxNodeExpansions)) {
      output.reason = "path_node_budget_exhausted";
      return;
    }

    const epoch = this.nextSearchEpoch();
    let openCount = 1;
    let nodeExpansions = 0;
    this.openCells[0] = request.startCellIndex;
    this.parentCell[request.startCellIndex] = request.startCellIndex;
    this.gCostMilli[request.startCellIndex] = 0;
    this.fCostMilli[request.startCellIndex] = this.heuristicMilli(
      grid,
      request.startCellIndex,
      request.goalCellIndex,
    );
    this.seenEpoch[request.startCellIndex] = epoch;

    while (openCount > 0) {
      const selectedOpenIndex = this.selectBestOpenIndex(openCount);
      const current = this.openCells[selectedOpenIndex] ?? 0;
      openCount -= 1;
      this.openCells[selectedOpenIndex] = this.openCells[openCount] ?? 0;

      if ((this.closedEpoch[current] ?? 0) === epoch) {
        continue;
      }
      if (current === request.goalCellIndex) {
        this.writeFoundPathInto(request, nodeExpansions, routeOutput, output);
        return;
      }
      if (nodeExpansions >= maxNodeExpansions) {
        output.reason = "path_node_budget_exhausted";
        output.nodeExpansions = nodeExpansions;
        return;
      }

      this.closedEpoch[current] = epoch;
      nodeExpansions += 1;
      for (let direction = 0; direction < 4; direction += 1) {
        const neighbor = this.neighborIndex(grid, current, direction);
        if (
          neighbor >= 0 &&
          this.tryRelaxNeighborInto(grid, request.goalCellIndex, current, neighbor, epoch) &&
          openCount < this.openCells.length
        ) {
          this.openCells[openCount] = neighbor;
          openCount += 1;
        }
      }
    }

    output.reason = "path_no_route";
    output.nodeExpansions = nodeExpansions;
  }

  private resetIntoOutput(request: PathRequest, output: PathSearchIntoOutput): void {
    output.ok = false;
    output.reason = undefined;
    output.requestSequence = request.requestSequence;
    output.startCellIndex = request.startCellIndex;
    output.goalCellIndex = request.goalCellIndex;
    output.mapVersion = request.basis.mapVersion;
    output.navigationVersion = request.basis.navigationVersion;
    output.regionVersion = request.basis.regionVersion;
    output.roomVersion = request.basis.roomVersion;
    output.regionGraphVersion = request.basis.regionGraphVersion;
    output.pathCellCount = 0;
    output.pathCostMilli = 0;
    output.nodeExpansions = 0;
  }

  private validateRequestReason(grid: MapGrid, request: PathRequest): PathReason | undefined {
    if (grid.cellCount > this.cellCapacity) return "path_cell_capacity_exceeded";
    if (!isSafeNonNegativeInteger(request.requestSequence)) return "path_request_sequence_invalid";
    if (!isSafeNonNegativeInteger(request.issuedTick)) return "path_tick_invalid";
    if (!isCellIndexInRange(request.startCellIndex, grid.cellCount))
      return "path_start_out_of_range";
    if (!isCellIndexInRange(request.goalCellIndex, grid.cellCount)) return "path_goal_out_of_range";
    return undefined;
  }

  private tryRelaxNeighborInto(
    grid: MapGrid,
    goalCellIndex: number,
    current: number,
    neighbor: number,
    epoch: number,
  ): boolean {
    if ((this.closedEpoch[neighbor] ?? 0) === epoch) return false;
    grid.canMoveBetweenCardinalNeighborsInto(current, neighbor, this.cardinalMovementOutput);
    if (!this.cardinalMovementOutput.ok || !this.cardinalMovementOutput.passable) return false;
    grid.readMovementCellByIndexInto(neighbor, this.movementCellOutput);
    if (!this.movementCellOutput.ok) return false;

    const previousSeen = (this.seenEpoch[neighbor] ?? 0) === epoch;
    const tentativeG = (this.gCostMilli[current] ?? 0) + this.movementCellOutput.walkCostMilli;
    if (
      tentativeG >= UINT32_INFINITY ||
      (previousSeen && tentativeG >= (this.gCostMilli[neighbor] ?? UINT32_INFINITY))
    ) {
      return false;
    }

    this.parentCell[neighbor] = current;
    this.gCostMilli[neighbor] = tentativeG;
    this.fCostMilli[neighbor] = tentativeG + this.heuristicMilli(grid, neighbor, goalCellIndex);
    this.seenEpoch[neighbor] = epoch;
    return true;
  }

  private readPassableMovementCellInto(grid: MapGrid, cellIndex: number): boolean {
    grid.readMovementCellByIndexInto(cellIndex, this.movementCellOutput);
    return this.movementCellOutput.ok && this.movementCellOutput.passable;
  }

  private writeFoundPathInto(
    request: PathRequest,
    nodeExpansions: number,
    routeOutput: Uint32Array,
    output: PathSearchIntoOutput,
  ): void {
    let cursor = request.goalCellIndex;
    let pathCount = 0;
    let reachedStart = false;
    while (pathCount < this.pathScratch.length) {
      this.pathScratch[pathCount] = cursor;
      pathCount += 1;
      if (cursor === request.startCellIndex) {
        reachedStart = true;
        break;
      }
      cursor = this.parentCell[cursor] ?? request.startCellIndex;
    }

    output.nodeExpansions = nodeExpansions;
    if (!reachedStart) {
      output.reason = "path_no_route";
      return;
    }
    if (routeOutput.length < pathCount) {
      output.pathCellCount = pathCount;
      output.pathCostMilli = this.gCostMilli[request.goalCellIndex] ?? 0;
      output.reason = "path_output_capacity_exceeded";
      return;
    }

    for (let index = 0; index < pathCount; index += 1) {
      routeOutput[index] = this.pathScratch[pathCount - 1 - index] ?? 0;
    }
    output.ok = true;
    output.reason = undefined;
    output.pathCellCount = pathCount;
    output.pathCostMilli = this.gCostMilli[request.goalCellIndex] ?? 0;
  }

  private validateRequest(
    grid: MapGrid,
    request: PathRequest,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: PathReason } {
    if (grid.cellCount > this.cellCapacity) {
      return { ok: false, reason: "path_cell_capacity_exceeded" };
    }

    if (!isSafeNonNegativeInteger(request.requestSequence)) {
      return { ok: false, reason: "path_request_sequence_invalid" };
    }

    if (!isSafeNonNegativeInteger(request.issuedTick)) {
      return { ok: false, reason: "path_tick_invalid" };
    }

    if (!isCellIndexInRange(request.startCellIndex, grid.cellCount)) {
      return { ok: false, reason: "path_start_out_of_range" };
    }

    if (!isCellIndexInRange(request.goalCellIndex, grid.cellCount)) {
      return { ok: false, reason: "path_goal_out_of_range" };
    }

    return { ok: true };
  }

  private tryRelaxNeighbor(
    grid: MapGrid,
    goalCellIndex: number,
    current: number,
    neighbor: number,
    epoch: number,
  ): boolean {
    if ((this.closedEpoch[neighbor] ?? 0) === epoch) {
      return false;
    }

    const movement = grid.canMoveBetweenCardinalNeighbors(current, neighbor);

    if (!movement.ok || !movement.passable) {
      return false;
    }

    const neighborCell = grid.readCellByIndex(neighbor);

    if (!neighborCell.ok) {
      return false;
    }

    const previousSeen = (this.seenEpoch[neighbor] ?? 0) === epoch;
    const tentativeG = (this.gCostMilli[current] ?? 0) + neighborCell.cell.walkCostMilli;

    if (
      tentativeG >= UINT32_INFINITY ||
      (previousSeen && tentativeG >= (this.gCostMilli[neighbor] ?? UINT32_INFINITY))
    ) {
      return false;
    }

    this.parentCell[neighbor] = current;
    this.gCostMilli[neighbor] = tentativeG;
    this.fCostMilli[neighbor] = tentativeG + this.heuristicMilli(grid, neighbor, goalCellIndex);
    this.seenEpoch[neighbor] = epoch;
    return true;
  }

  private selectBestOpenIndex(openCount: number): number {
    let bestOpenIndex = 0;
    let bestCellIndex = this.openCells[0] ?? 0;
    let bestCost = this.fCostMilli[bestCellIndex] ?? UINT32_INFINITY;

    for (let openIndex = 1; openIndex < openCount; openIndex += 1) {
      const candidateCellIndex = this.openCells[openIndex] ?? 0;
      const candidateCost = this.fCostMilli[candidateCellIndex] ?? UINT32_INFINITY;

      if (
        candidateCost < bestCost ||
        (candidateCost === bestCost && candidateCellIndex < bestCellIndex)
      ) {
        bestOpenIndex = openIndex;
        bestCellIndex = candidateCellIndex;
        bestCost = candidateCost;
      }
    }

    return bestOpenIndex;
  }

  private createTrivialPath(request: PathRequest): PathSearchResult {
    const path = new Uint32Array(1);
    path[0] = request.startCellIndex;
    return {
      ok: true,
      requestSequence: request.requestSequence,
      basis: request.basis,
      startCellIndex: request.startCellIndex,
      goalCellIndex: request.goalCellIndex,
      path,
      pathCellCount: 1,
      pathCostMilli: 0,
      nodeExpansions: 0,
    };
  }

  private createFoundPath(request: PathRequest, nodeExpansions: number): PathSearchResult {
    let cursor = request.goalCellIndex;
    let pathCount = 0;
    let reachedStart = false;

    while (pathCount < this.pathScratch.length) {
      this.pathScratch[pathCount] = cursor;
      pathCount += 1;

      if (cursor === request.startCellIndex) {
        reachedStart = true;
        break;
      }

      cursor = this.parentCell[cursor] ?? request.startCellIndex;
    }

    if (!reachedStart) {
      return this.createFailure(request, "path_no_route", nodeExpansions);
    }

    const path = new Uint32Array(pathCount);

    for (let index = 0; index < pathCount; index += 1) {
      path[index] = this.pathScratch[pathCount - 1 - index] ?? 0;
    }

    return {
      ok: true,
      requestSequence: request.requestSequence,
      basis: request.basis,
      startCellIndex: request.startCellIndex,
      goalCellIndex: request.goalCellIndex,
      path,
      pathCellCount: pathCount,
      pathCostMilli: this.gCostMilli[request.goalCellIndex] ?? 0,
      nodeExpansions,
    };
  }

  private createFailure(
    request: PathRequest,
    reason: PathReason,
    nodeExpansions: number,
  ): PathSearchResult {
    return {
      ok: false,
      requestSequence: request.requestSequence,
      basis: request.basis,
      startCellIndex: request.startCellIndex,
      goalCellIndex: request.goalCellIndex,
      reason,
      nodeExpansions,
    };
  }

  private nextSearchEpoch(): number {
    if (this.searchEpoch >= PATH_SEARCH_EPOCH_MAX) {
      this.seenEpoch.fill(0);
      this.closedEpoch.fill(0);
      this.searchEpoch = 0;
    }

    this.searchEpoch += 1;
    return this.searchEpoch;
  }

  private neighborIndex(grid: MapGrid, cellIndex: number, direction: number): number {
    const x = cellIndex % grid.width;

    if (direction === MAP_DIRECTION_NORTH) {
      return cellIndex >= grid.width ? cellIndex - grid.width : -1;
    }

    if (direction === MAP_DIRECTION_EAST) {
      return x + 1 < grid.width ? cellIndex + 1 : -1;
    }

    if (direction === MAP_DIRECTION_SOUTH) {
      return cellIndex + grid.width < grid.cellCount ? cellIndex + grid.width : -1;
    }

    if (direction === MAP_DIRECTION_WEST) {
      return x > 0 ? cellIndex - 1 : -1;
    }

    return -1;
  }

  private heuristicMilli(grid: MapGrid, fromCellIndex: number, toCellIndex: number): number {
    const fromX = fromCellIndex % grid.width;
    const fromY = Math.floor(fromCellIndex / grid.width);
    const toX = toCellIndex % grid.width;
    const toY = Math.floor(toCellIndex / grid.width);
    return (Math.abs(fromX - toX) + Math.abs(fromY - toY)) * DEFAULT_WALK_COST_MILLI;
  }
}

export class PathRequestBatcher {
  readonly capacity: number;
  readonly pathfinder: GridPathfinder;

  private readonly queue: (PathRequest | undefined)[];
  private head = 0;
  private tail = 0;
  private queued = 0;
  private processedTotal = 0;
  private acceptedTotal = 0;
  private staleRejectedTotal = 0;
  private queueBacklogPeak = 0;
  private nodeExpansionTotal = 0;

  constructor(capacity: number, pathfinder: GridPathfinder) {
    this.capacity = requirePositiveSafeInteger(capacity, "path request queue capacity");
    this.pathfinder = pathfinder;
    this.queue = new Array<PathRequest | undefined>(capacity);
  }

  get queuedCount(): number {
    return this.queued;
  }

  enqueue(request: PathRequest): PathEnqueueResult {
    if (this.queued >= this.capacity) {
      return { ok: false, reason: "path_queue_full" };
    }

    this.queue[this.tail] = request;
    this.tail = (this.tail + 1) % this.capacity;
    this.queued += 1;

    if (this.queued > this.queueBacklogPeak) {
      this.queueBacklogPeak = this.queued;
    }

    return {
      ok: true,
      queuedCount: this.queued,
      queueBacklogPeak: this.queueBacklogPeak,
    };
  }

  processNext(grid: MapGrid): PathBatchProcessResult {
    if (this.queued === 0) {
      return { ok: true, processed: false, queuedCount: 0 };
    }

    const request = this.queue[this.head];
    this.queue[this.head] = undefined;
    this.head = (this.head + 1) % this.capacity;
    this.queued -= 1;

    if (request === undefined) {
      return { ok: false, reason: "path_queue_empty" };
    }

    const result = this.pathfinder.findPath(grid, request);
    this.processedTotal += 1;
    this.nodeExpansionTotal += result.nodeExpansions;

    return {
      ok: true,
      processed: true,
      result,
      queuedCount: this.queued,
    };
  }

  commitResult(result: PathSearchResult, currentBasis: PathVersionBasis): PathCommitResult {
    if (!samePathBasis(result.basis, currentBasis)) {
      this.staleRejectedTotal += 1;
      return {
        ok: false,
        accepted: false,
        reason: "path_stale_result",
        staleRejectedCount: this.staleRejectedTotal,
      };
    }

    this.acceptedTotal += 1;
    return {
      ok: true,
      accepted: true,
      result,
      acceptedResultCount: this.acceptedTotal,
    };
  }

  createMetrics(): PathBatcherMetrics {
    return {
      queuedCount: this.queued,
      processedCount: this.processedTotal,
      acceptedResultCount: this.acceptedTotal,
      staleRejectedCount: this.staleRejectedTotal,
      queueBacklogPeak: this.queueBacklogPeak,
      nodeExpansionTotal: this.nodeExpansionTotal,
    };
  }
}

export function createGridPathfinder(cellCapacity: number): GridPathfinder {
  return new GridPathfinder(cellCapacity);
}

export function createPathRequestBatcher(
  capacity: number,
  pathfinder: GridPathfinder,
): PathRequestBatcher {
  return new PathRequestBatcher(capacity, pathfinder);
}

export function createPathVersionBasis(
  grid: MapGrid,
  versions: {
    readonly navigationVersion: number;
    readonly regionVersion: number;
    readonly roomVersion: number;
    readonly regionGraphVersion: number;
  },
): PathVersionBasis {
  return {
    mapVersion: grid.globalVersion,
    navigationVersion: versions.navigationVersion,
    regionVersion: versions.regionVersion,
    roomVersion: versions.roomVersion,
    regionGraphVersion: versions.regionGraphVersion,
  };
}

export function samePathBasis(left: PathVersionBasis, right: PathVersionBasis): boolean {
  return (
    left.mapVersion === right.mapVersion &&
    left.navigationVersion === right.navigationVersion &&
    left.regionVersion === right.regionVersion &&
    left.roomVersion === right.roomVersion &&
    left.regionGraphVersion === right.regionGraphVersion
  );
}

export function resolveTopKPathCandidates(
  pathfinder: GridPathfinder,
  grid: MapGrid,
  options: TopKPathResolutionOptions,
): TopKPathResolutionResult {
  if (!isPositiveSafeInteger(options.maxExactPaths)) {
    return { ok: false, reason: "path_candidate_limit_invalid" };
  }

  const selected: PathCandidate[] = [];

  for (const candidate of options.candidates) {
    insertTopKCandidate(selected, candidate, options.maxExactPaths);
  }

  const results: PathSearchResult[] = [];
  let nodeExpansions = 0;

  for (let index = 0; index < selected.length; index += 1) {
    const candidate = selected[index];

    if (candidate !== undefined) {
      const request: PathRequest = {
        requestSequence: options.requestSequenceStart + index,
        issuedTick: options.issuedTick,
        startCellIndex: options.originCellIndex,
        goalCellIndex: candidate.targetCellIndex,
        basis: options.basis,
      };

      const result = pathfinder.findPath(
        grid,
        options.maxNodeExpansions === undefined
          ? request
          : { ...request, maxNodeExpansions: options.maxNodeExpansions },
      );
      results.push(result);
      nodeExpansions += result.nodeExpansions;
    }
  }

  return {
    ok: true,
    candidateCount: options.candidates.length,
    selectedCount: selected.length,
    exactPathCount: selected.length,
    capHitCount: options.candidates.length > options.maxExactPaths ? 1 : 0,
    nodeExpansions,
    results,
  };
}

function insertTopKCandidate(
  selected: PathCandidate[],
  candidate: PathCandidate,
  maxExactPaths: number,
): void {
  let insertIndex = selected.length;

  for (let index = 0; index < selected.length; index += 1) {
    const current = selected[index];

    if (current !== undefined && isBetterCandidate(candidate, current)) {
      insertIndex = index;
      break;
    }
  }

  if (insertIndex >= maxExactPaths) {
    return;
  }

  const limit = Math.min(selected.length, maxExactPaths - 1);
  for (let index = limit; index > insertIndex; index -= 1) {
    const previous = selected[index - 1];

    if (previous !== undefined) {
      selected[index] = previous;
    }
  }

  selected[insertIndex] = candidate;

  if (selected.length > maxExactPaths) {
    selected.length = maxExactPaths;
  }
}

function isBetterCandidate(left: PathCandidate, right: PathCandidate): boolean {
  if (left.scoreMilli !== right.scoreMilli) {
    return left.scoreMilli > right.scoreMilli;
  }

  if (left.candidateId !== right.candidateId) {
    return left.candidateId < right.candidateId;
  }

  return left.targetCellIndex < right.targetCellIndex;
}

function validateNodeBudget(
  maxNodeExpansions: number,
): { readonly ok: true } | { readonly ok: false; readonly reason: PathReason } {
  if (!isPositiveSafeInteger(maxNodeExpansions)) {
    return { ok: false, reason: "path_node_budget_exhausted" };
  }

  return { ok: true };
}

/** @internal source-audit only; intentionally not re-exported from package root. */
export function isCellIndexInRange(cellIndex: number, cellCount: number): boolean {
  return Number.isSafeInteger(cellIndex) && cellIndex >= 0 && cellIndex < cellCount;
}

function requirePositiveSafeInteger(value: number, label: string): number {
  if (!isPositiveSafeInteger(value)) {
    throw new Error(`${label} must be a positive safe integer`);
  }

  return value;
}

/** @internal source-audit only; intentionally not re-exported from package root. */
export function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/** @internal source-audit only; intentionally not re-exported from package root. */
export function isSafeNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
