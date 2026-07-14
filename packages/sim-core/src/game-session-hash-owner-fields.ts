import type { EntityId } from "./entity-id";
import type {
  GameSessionOwnerGraph,
  GameSessionScenarioReferences,
} from "./game-session-initializer";
import type { GameSessionScenarioDefinition } from "./game-session-types";
import { createJobCoreHashFields } from "./job-core";
import {
  NEED_LANE_COMFORT,
  NEED_LANE_COUNT,
  NEED_LANE_HUNGER,
  NEED_LANE_REST,
  NEED_LANE_SAFETY,
  NEED_LANE_SOCIAL,
  createNeedStoreHashFields,
  type NeedLane,
} from "./m3-needs";
import { createM4LampNetworkHashFields } from "./m4-lamp-network";
import type { Tick } from "./time";
import { createStorageLogisticsHashFields } from "./storage-logistics-index";
import type { CanonicalWorldField } from "./world-hash";

const NEED_LANES: readonly NeedLane[] = [
  NEED_LANE_HUNGER,
  NEED_LANE_REST,
  NEED_LANE_COMFORT,
  NEED_LANE_SOCIAL,
  NEED_LANE_SAFETY,
];

export interface GameSessionOwnerHashContext {
  readonly definition: GameSessionScenarioDefinition;
  readonly owners: GameSessionOwnerGraph;
  readonly references: GameSessionScenarioReferences;
  readonly tick: Tick;
}

export function appendGameSessionOwnerHashFields(
  fields: CanonicalWorldField[],
  context: GameSessionOwnerHashContext,
  namespace: string,
): void {
  appendFields(fields, context.owners.map.createHashFields(`${namespace}.map`));
  appendResidents(fields, context, namespace);
  appendFields(
    fields,
    createNeedStoreHashFields(context.owners.needs.createSnapshot(), `${namespace}.needs`),
  );
  appendResourcesAndStorage(fields, context, namespace);
  appendFields(
    fields,
    createStorageLogisticsHashFields(
      context.owners.storage.createSnapshot(),
      `${namespace}.storage`,
    ),
  );
  appendJobAndReservationRecords(fields, context, namespace);
  appendWorkOffers(fields, context, namespace);
  appendRestFixtures(fields, context, namespace);
  appendEnvironment(fields, context, namespace);
  appendLamp(fields, context, namespace);
  appendBuildSite(fields, context, namespace);
  appendDerivedFacts(fields, context, namespace);
}

function appendResidents(
  fields: CanonicalWorldField[],
  context: GameSessionOwnerHashContext,
  namespace: string,
): void {
  for (let residentId = 0; residentId < context.owners.residents.activeCount; residentId += 1) {
    const resident = context.owners.residents.read(residentId);
    if (resident === undefined) continue;
    const prefix = `${namespace}.resident.${String(residentId)}`;
    fields.push({ name: `${prefix}.entityIndex`, value: resident.entity.index });
    fields.push({ name: `${prefix}.entityGeneration`, value: resident.entity.generation });
    fields.push({ name: `${prefix}.defId`, value: resident.defId });
    fields.push({ name: `${prefix}.activity`, value: resident.activity });
    fields.push({ name: `${prefix}.currentJobId`, value: resident.currentJobId });
    fields.push({ name: `${prefix}.reason`, value: resident.reason });
    fields.push({ name: `${prefix}.ownerVersion`, value: resident.ownerVersion });
    appendLocation(fields, context, resident.entity, `${prefix}.location`);
    appendNeedLanes(fields, context, residentId, `${prefix}.need`);
  }
}

function appendNeedLanes(
  fields: CanonicalWorldField[],
  context: GameSessionOwnerHashContext,
  residentId: number,
  prefix: string,
): void {
  fields.push({ name: `${prefix}.laneCount`, value: NEED_LANE_COUNT });
  for (const lane of NEED_LANES) {
    const lanePrefix = `${prefix}.${String(lane)}`;
    const change = context.owners.needs.readLaneLastChange(residentId, lane);
    fields.push({
      name: `${lanePrefix}.value`,
      value: context.owners.needs.readLaneValue(residentId, lane),
    });
    fields.push({
      name: `${lanePrefix}.laneVersion`,
      value: context.owners.needs.readLaneOwnerVersion(residentId, lane),
    });
    fields.push({
      name: `${lanePrefix}.updatePhase`,
      value: context.owners.needs.readLaneUpdatePhase(residentId, lane),
    });
    fields.push({ name: `${lanePrefix}.changeTick`, value: change?.tick ?? 0 });
    fields.push({ name: `${lanePrefix}.changeReason`, value: change?.reason ?? "none" });
    fields.push({ name: `${lanePrefix}.sourceSystemId`, value: change?.sourceSystemId ?? 0 });
    fields.push({ name: `${lanePrefix}.sourceEventId`, value: change?.sourceEventId ?? 0 });
    fields.push({ name: `${lanePrefix}.previousValue`, value: change?.previousValue ?? 0 });
    fields.push({ name: `${lanePrefix}.delta`, value: change?.delta ?? 0 });
  }
}

function appendResourcesAndStorage(
  fields: CanonicalWorldField[],
  context: GameSessionOwnerHashContext,
  namespace: string,
): void {
  for (let slot = 0; slot < context.references.resourceStackIds.length; slot += 1) {
    const stackId = context.references.resourceStackIds[slot];
    const stack =
      stackId === undefined
        ? undefined
        : context.owners.items.readStack(stackId, context.owners.reservations);
    if (stack === undefined) continue;
    const prefix = `${namespace}.resource.${String(slot)}`;
    fields.push({ name: `${prefix}.stackId`, value: stack.stackId });
    fields.push({ name: `${prefix}.entityIndex`, value: stack.entity.index });
    fields.push({ name: `${prefix}.entityGeneration`, value: stack.entity.generation });
    fields.push({ name: `${prefix}.defId`, value: stack.defId });
    fields.push({ name: `${prefix}.quantity`, value: stack.quantity });
    fields.push({ name: `${prefix}.capacity`, value: stack.capacity });
    fields.push({ name: `${prefix}.reservedQuantity`, value: stack.reservedQuantity });
    fields.push({ name: `${prefix}.item.rowVersion`, value: stack.rowVersion });
    fields.push({ name: `${prefix}.item.storeVersion`, value: stack.storeVersion });
    fields.push({
      name: `${prefix}.item.reservationVersion`,
      value: stack.reservationVersion,
    });
    appendLocation(fields, context, stack.entity, `${prefix}.stackLocation`);
    const storageEntity = context.references.resourceStorageEntities[slot];
    if (storageEntity !== undefined) {
      appendLocation(fields, context, storageEntity, `${prefix}.storageLocation`);
    }
    const storage = context.owners.storage.readSlot(slot);
    if (storage === undefined) continue;
    fields.push({ name: `${prefix}.desiredQuantity`, value: storage.desiredQuantity });
    fields.push({ name: `${prefix}.interactionCell`, value: storage.interactionCellIndex });
    fields.push({ name: `${prefix}.availableSupply`, value: storage.availableSupply });
    fields.push({ name: `${prefix}.availableCapacity`, value: storage.availableCapacity });
    fields.push({ name: `${prefix}.offerActive`, value: storage.offerActive });
    fields.push({ name: `${prefix}.storage.rowVersion`, value: storage.rowVersion });
    fields.push({ name: `${prefix}.storage.indexVersion`, value: storage.indexVersion });
    fields.push({ name: `${prefix}.storage.dirtyQueued`, value: storage.dirtyQueued });
    fields.push({ name: `${prefix}.dirtyHead`, value: storage.dirtyHead });
    fields.push({ name: `${prefix}.dirtyBacklog`, value: storage.dirtyBacklog });
  }
}

function appendJobAndReservationRecords(
  fields: CanonicalWorldField[],
  context: GameSessionOwnerHashContext,
  namespace: string,
): void {
  appendFields(
    fields,
    createJobCoreHashFields(context.owners.jobs.createSnapshot(), `${namespace}.jobs`),
  );
  const snapshot = context.owners.reservations.createSnapshot();
  const prefix = `${namespace}.reservations`;
  fields.push({ name: `${prefix}.snapshotVersion`, value: snapshot.snapshotVersion });
  fields.push({ name: `${prefix}.ledgerVersion`, value: snapshot.ledgerVersion });
  fields.push({ name: `${prefix}.activeCount`, value: snapshot.activeCount });
  fields.push({ name: `${prefix}.recordCount`, value: snapshot.records.length });
  for (const record of snapshot.records) {
    const recordPrefix = `${prefix}.record.${String(record.claimId)}`;
    fields.push({ name: `${recordPrefix}.channel`, value: record.channel });
    fields.push({ name: `${recordPrefix}.ownerIndex`, value: record.owner.index });
    fields.push({ name: `${recordPrefix}.ownerGeneration`, value: record.owner.generation });
    fields.push({ name: `${recordPrefix}.jobId`, value: record.jobId });
    fields.push({ name: `${recordPrefix}.jobGeneration`, value: record.jobGeneration });
    fields.push({ name: `${recordPrefix}.allocationEpoch`, value: record.allocationEpoch });
    fields.push({ name: `${recordPrefix}.amount`, value: record.amount });
    fields.push({ name: `${recordPrefix}.createdTick`, value: record.createdTick });
    fields.push({ name: `${recordPrefix}.leaseExpiryTick`, value: record.leaseExpiryTick });
    fields.push({ name: `${recordPrefix}.targetIndex`, value: record.target?.index ?? -1 });
    fields.push({
      name: `${recordPrefix}.targetGeneration`,
      value: record.target?.generation ?? -1,
    });
    fields.push({ name: `${recordPrefix}.cellIndex`, value: record.cellIndex ?? -1 });
    fields.push({ name: `${recordPrefix}.slot`, value: record.slot ?? -1 });
  }
}

function appendWorkOffers(
  fields: CanonicalWorldField[],
  context: GameSessionOwnerHashContext,
  namespace: string,
): void {
  for (let offerId = 0; offerId < context.owners.workOffers.capacity; offerId += 1) {
    const offer = context.owners.workOffers.readOffer(offerId);
    if (offer === undefined) continue;
    const prefix = `${namespace}.workOffer.${String(offerId)}`;
    fields.push({ name: `${prefix}.workType`, value: offer.workType });
    fields.push({ name: `${prefix}.regionId`, value: offer.regionId });
    fields.push({ name: `${prefix}.defId`, value: offer.defId });
    fields.push({ name: `${prefix}.urgencyBucket`, value: offer.urgencyBucket });
    fields.push({ name: `${prefix}.permissionId`, value: offer.permissionId });
    fields.push({ name: `${prefix}.targetId`, value: offer.targetId });
    fields.push({ name: `${prefix}.targetCellIndex`, value: offer.targetCellIndex });
    fields.push({ name: `${prefix}.scoreMilli`, value: offer.scoreMilli });
  }
}

function appendRestFixtures(
  fields: CanonicalWorldField[],
  context: GameSessionOwnerHashContext,
  namespace: string,
): void {
  for (let fixtureId = 0; fixtureId < context.references.bedEntities.length; fixtureId += 1) {
    const fixture = context.owners.restFixtures.readFixture(fixtureId);
    if (fixture === undefined) continue;
    const prefix = `${namespace}.restFixture.${String(fixtureId)}`;
    fields.push({ name: `${prefix}.entityIndex`, value: fixture.entity.index });
    fields.push({ name: `${prefix}.entityGeneration`, value: fixture.entity.generation });
    fields.push({ name: `${prefix}.kind`, value: fixture.kind });
    fields.push({ name: `${prefix}.restKind`, value: fixture.restKind });
    fields.push({ name: `${prefix}.regionId`, value: fixture.regionId });
    fields.push({ name: `${prefix}.targetCellIndex`, value: fixture.targetCellIndex });
    fields.push({ name: `${prefix}.interactionSpotId`, value: fixture.interactionSpotId });
    fields.push({ name: `${prefix}.scheduleWindow`, value: fixture.scheduleWindow });
    fields.push({ name: `${prefix}.weatherExposure`, value: fixture.weatherExposure });
    fields.push({ name: `${prefix}.permissionId`, value: fixture.permissionId });
    fields.push({ name: `${prefix}.recoveryQ16`, value: fixture.recoveryPerTickQ16 });
    fields.push({ name: `${prefix}.baseScoreMilli`, value: fixture.baseScoreMilli });
    fields.push({ name: `${prefix}.ownerVersion`, value: fixture.ownerVersion });
  }
}

function appendEnvironment(
  fields: CanonicalWorldField[],
  context: GameSessionOwnerHashContext,
  namespace: string,
): void {
  const dayNight = context.owners.environment.dayNight.createProjection(context.tick);
  const weather = context.owners.environment.weather.createProjection(context.tick);
  const prefix = `${namespace}.environment`;
  fields.push({ name: `${prefix}.day`, value: dayNight.day });
  fields.push({ name: `${prefix}.hour`, value: dayNight.hour });
  fields.push({ name: `${prefix}.tickOfDay`, value: dayNight.tickOfDay });
  fields.push({ name: `${prefix}.scheduleWindow`, value: dayNight.scheduleWindow });
  fields.push({ name: `${prefix}.scheduleVersion`, value: dayNight.scheduleWindowVersion });
  fields.push({ name: `${prefix}.dayReason`, value: dayNight.reason });
  fields.push({ name: `${prefix}.weather`, value: weather.currentWeather });
  fields.push({ name: `${prefix}.previousWeather`, value: weather.previousWeather });
  fields.push({ name: `${prefix}.transitionTick`, value: weather.transitionTick });
  fields.push({
    name: `${prefix}.commandWeather`,
    value: weather.commandForcedWeather ?? "none",
  });
  fields.push({ name: `${prefix}.weatherVersion`, value: weather.weatherVersion });
  fields.push({ name: `${prefix}.weatherReason`, value: weather.reason });
  fields.push({ name: `${prefix}.precipitation`, value: weather.severity.precipitation });
  fields.push({ name: `${prefix}.wind`, value: weather.severity.wind });
  fields.push({ name: `${prefix}.cold`, value: weather.severity.cold });
  fields.push({
    name: `${prefix}.outdoorPenaltyMilli`,
    value: weather.severity.outdoorExposurePenaltyMilli,
  });
}

function appendLamp(
  fields: CanonicalWorldField[],
  context: GameSessionOwnerHashContext,
  namespace: string,
): void {
  const snapshot = context.owners.lamps.createSnapshot();
  const prefix = `${namespace}.lamp`;
  appendFields(fields, createM4LampNetworkHashFields(snapshot, prefix));
  appendLocation(fields, context, context.references.lampEntity, `${prefix}.location`);
}

function appendBuildSite(
  fields: CanonicalWorldField[],
  context: GameSessionOwnerHashContext,
  namespace: string,
): void {
  const site = context.owners.buildSites.readSite(0, context.owners.reservations);
  const order = context.owners.buildSites.readBuildOrder(0, context.owners.reservations);
  if (site === undefined || order === undefined) return;
  const prefix = `${namespace}.buildSite.0`;
  fields.push({ name: `${prefix}.entityIndex`, value: site.site.index });
  fields.push({ name: `${prefix}.entityGeneration`, value: site.site.generation });
  fields.push({ name: `${prefix}.active`, value: site.active });
  fields.push({ name: `${prefix}.completed`, value: site.completed });
  fields.push({ name: `${prefix}.blueprintDefId`, value: site.blueprintDefId });
  fields.push({ name: `${prefix}.anchorX`, value: site.anchorX });
  fields.push({ name: `${prefix}.anchorY`, value: site.anchorY });
  fields.push({ name: `${prefix}.requiredDefA`, value: site.requiredDefA });
  fields.push({ name: `${prefix}.requiredDefB`, value: site.requiredDefB });
  fields.push({ name: `${prefix}.requiredAmountA`, value: site.requiredAmountA });
  fields.push({ name: `${prefix}.requiredAmountB`, value: site.requiredAmountB });
  fields.push({ name: `${prefix}.deliveredAmountA`, value: site.deliveredAmountA });
  fields.push({ name: `${prefix}.deliveredAmountB`, value: site.deliveredAmountB });
  fields.push({ name: `${prefix}.reservedCapacityA`, value: site.reservedCapacityA });
  fields.push({ name: `${prefix}.reservedCapacityB`, value: site.reservedCapacityB });
  fields.push({ name: `${prefix}.buildProgressTicks`, value: site.buildProgressTicks });
  fields.push({ name: `${prefix}.buildRequiredTicks`, value: site.buildRequiredTicks });
  fields.push({ name: `${prefix}.materialOfferA`, value: order.materialDemandOfferAActive });
  fields.push({ name: `${prefix}.materialOfferB`, value: order.materialDemandOfferBActive });
  fields.push({ name: `${prefix}.buildOffer`, value: order.buildOfferActive });
  fields.push({ name: `${prefix}.lanternState`, value: site.lanternState });
}

function appendDerivedFacts(
  fields: CanonicalWorldField[],
  context: GameSessionOwnerHashContext,
  namespace: string,
): void {
  const storage = context.owners.storage.createMetrics();
  const needs = context.owners.needUrgency.createMetrics();
  const rest = context.owners.restCandidates.createMetrics(context.owners.restFixtures);
  const path = context.owners.pathRequests.createMetrics();
  fields.push({ name: `${namespace}.derived.storageVersion`, value: storage.version });
  fields.push({ name: `${namespace}.derived.storageDirty`, value: storage.dirtyBacklog });
  fields.push({ name: `${namespace}.derived.needIndexVersion`, value: needs.indexVersion });
  fields.push({ name: `${namespace}.derived.needSourceVersion`, value: needs.sourceVersion });
  fields.push({ name: `${namespace}.derived.needDirty`, value: needs.dirtyBacklog });
  fields.push({ name: `${namespace}.derived.restIndexVersion`, value: rest.version });
  fields.push({ name: `${namespace}.derived.restDirty`, value: rest.dirtyBacklog });
  fields.push({ name: `${namespace}.derived.pathQueued`, value: path.queuedCount });
  fields.push({ name: `${namespace}.derived.pathAccepted`, value: path.acceptedResultCount });
  fields.push({ name: `${namespace}.derived.pathStale`, value: path.staleRejectedCount });
  fields.push({ name: `${namespace}.derived.pathNodes`, value: path.nodeExpansionTotal });
}

function appendLocation(
  fields: CanonicalWorldField[],
  context: GameSessionOwnerHashContext,
  entity: EntityId,
  prefix: string,
): void {
  const result = context.owners.locations.read(entity, context.owners.entities);
  fields.push({ name: `${prefix}.present`, value: result.ok });
  if (!result.ok) return;
  const location = result.location;
  fields.push({ name: `${prefix}.kind`, value: location.kind });
  fields.push({ name: `${prefix}.x`, value: location.x });
  fields.push({ name: `${prefix}.y`, value: location.y });
  fields.push({ name: `${prefix}.cellIndex`, value: location.cellIndex });
  fields.push({ name: `${prefix}.chunkIndex`, value: location.chunkIndex });
  fields.push({ name: `${prefix}.regionId`, value: location.regionId });
  fields.push({ name: `${prefix}.containerIndex`, value: location.containerIndex });
  fields.push({ name: `${prefix}.containerGeneration`, value: location.containerGeneration });
  fields.push({ name: `${prefix}.slot`, value: location.slot });
}

function appendFields(output: CanonicalWorldField[], input: readonly CanonicalWorldField[]): void {
  for (const field of input) output.push(field);
}
