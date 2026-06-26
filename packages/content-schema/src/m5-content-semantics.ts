import type { ContentDiagnostic, ContentFixture } from "./content-fixtures";
import { isDefinitionPath } from "./m5-content-pack-files";
import {
  M5_CONTENT_SCHEMA_VERSION,
  M5_SUPPORTED_CONTENT_KINDS,
  type M5ContentKind,
  type M5ContentValidationCounters,
  type M5SemanticDefinition,
  type ParsedM5File,
  parseM5Kind,
} from "./m5-content-validation-types";
import { asRecord, fileLocation } from "./m5-content-validation-utils";

interface SemanticContext {
  readonly diagnostics: ContentDiagnostic[];
  readonly rawDefinitionsById: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
}

export function validateM5Semantics(
  definitions: readonly M5SemanticDefinition[],
  parsedFiles: readonly ParsedM5File[],
): readonly ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  const rawDefinitionsById = buildRawDefinitionsById(parsedFiles);
  const context: SemanticContext = {
    diagnostics,
    rawDefinitionsById,
  };

  const counts = new Map<M5ContentKind, number>();
  for (const definition of definitions) {
    const kind = parseM5Kind(definition.kind);
    if (kind === undefined) {
      diagnostics.push({
        code: "m5_unsupported_content_kind",
        message: `${definition.id} uses unsupported M5 content kind ${definition.kind}`,
        location: definition.locations.kind,
        relatedLocations: [],
      });
      continue;
    }

    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    validateM5Definition(definition, kind, context);
  }

  for (const requiredKind of M5_SUPPORTED_CONTENT_KINDS) {
    if ((counts.get(requiredKind) ?? 0) === 0) {
      diagnostics.push({
        code: "m5_missing_required_content_kind",
        message: `M5 content pack must include at least one ${requiredKind} definition`,
        location: definitions[0]?.locations.kind ?? fileLocation("defs"),
        relatedLocations: [],
      });
    }
  }

  return diagnostics;
}

export function buildSemanticDefinitions(
  parsedFiles: readonly ParsedM5File[],
): readonly M5SemanticDefinition[] {
  const definitions: M5SemanticDefinition[] = [];
  for (const entry of parsedFiles) {
    if (!isDefinitionPath(entry.file.relativePath)) {
      continue;
    }

    const data = asRecord(entry.json);
    const id = data?.["id"];
    const kind = data?.["kind"];
    const schemaVersion = data?.["schemaVersion"];
    if (typeof id !== "string" || typeof kind !== "string" || typeof schemaVersion !== "number") {
      continue;
    }

    const location = fileLocation(entry.file.relativePath);
    definitions.push({
      id,
      kind,
      schemaVersion,
      locations: {
        schemaVersion: location,
        id: location,
        kind: location,
      },
    });
  }
  return definitions;
}

export function buildCounters(
  byteCount: number,
  fixture: ContentFixture,
  definitions: readonly M5SemanticDefinition[],
  diagnosticCount: number,
): M5ContentValidationCounters {
  const kindCounts = countM5Kinds(definitions);
  return {
    fileCount: fixture.files.length,
    definitionCount: definitions.length,
    localeCount: fixture.files.filter((file) => file.kind === "locale").length,
    patchCount: fixture.files.filter((file) => file.kind === "patch").length,
    byteCount,
    anomalyCount: kindCounts.anomaly,
    factionHookCount: kindCounts.factionHook,
    governanceHookCount: kindCounts.governanceHook,
    seasonEventCount: kindCounts.seasonEvent,
    catalogEntryCount: kindCounts.catalogEntry,
    diagnosticCount,
  };
}

function validateM5Definition(
  definition: M5SemanticDefinition,
  kind: M5ContentKind,
  context: SemanticContext,
): void {
  const raw = context.rawDefinitionsById.get(definition.id);
  if (raw === undefined) {
    return;
  }

  if (definition.schemaVersion !== M5_CONTENT_SCHEMA_VERSION) {
    context.diagnostics.push({
      code: "m5_definition_schema_version_unsupported",
      message: `${definition.id} schemaVersion must be ${String(M5_CONTENT_SCHEMA_VERSION)}`,
      location: definition.locations.schemaVersion,
      relatedLocations: [],
    });
  }

  const budget = asRecord(raw["contentBudget"]);
  if (budget === undefined) {
    context.diagnostics.push({
      code: "m5_missing_content_budget",
      message: `${definition.id} must declare contentBudget`,
      location: definition.locations.id,
      relatedLocations: [],
    });
  } else {
    const bespoke = budget["bespokeRuntimeComponents"];
    if (typeof bespoke !== "number" || !Number.isInteger(bespoke) || bespoke !== 0) {
      context.diagnostics.push({
        code: "m5_bespoke_runtime_forbidden",
        message: `${definition.id} must set contentBudget.bespokeRuntimeComponents to 0`,
        location: definition.locations.id,
        relatedLocations: [],
      });
    }
  }

  if (kind === "m5.anomaly") {
    validateM5AnomalyDefinition(definition, raw, context.diagnostics);
    return;
  }

  if (kind === "m5.faction_hook") {
    validateMinStringArray(definition, raw, "factLanes", 2, context.diagnostics);
    validateMinStringArray(definition, raw, "sourceFacts", 1, context.diagnostics);
    validateMinStringArray(definition, raw, "policyContexts", 1, context.diagnostics);
    return;
  }

  if (kind === "m5.governance_hook") {
    validateStringField(definition, raw, "postId", context.diagnostics);
    validateMinStringArray(definition, raw, "authorities", 1, context.diagnostics);
    validateMinStringArray(definition, raw, "legitimacySources", 1, context.diagnostics);
    validateMinStringArray(definition, raw, "enforcementCosts", 1, context.diagnostics);
    return;
  }

  if (kind === "m5.season_event") {
    validateStringField(definition, raw, "theme", context.diagnostics);
    validateStringField(definition, raw, "pressureCategory", context.diagnostics);
    validateMinStringArray(definition, raw, "legalPreconditions", 1, context.diagnostics);
    validateMinStringArray(definition, raw, "warningSigns", 1, context.diagnostics);
    validatePositiveInteger(definition, raw, "cooldownTicks", context.diagnostics);
    validateStringField(definition, raw, "recoveryType", context.diagnostics);
    validateMinStringArray(definition, raw, "outcomes", 1, context.diagnostics);
    return;
  }

  validateStringField(definition, raw, "catalogKind", context.diagnostics);
  validateMinStringArray(definition, raw, "ownerSurfaces", 1, context.diagnostics);
  validateMinStringArray(definition, raw, "systemValue", 1, context.diagnostics);
  validateMinStringArray(definition, raw, "reusableTags", 1, context.diagnostics);
}

function validateM5AnomalyDefinition(
  definition: M5SemanticDefinition,
  raw: Readonly<Record<string, unknown>>,
  diagnostics: ContentDiagnostic[],
): void {
  validateMinStringArray(definition, raw, "ruleComponents", 1, diagnostics);
  validateMinStringArray(definition, raw, "affectedSystems", 3, diagnostics);
  validateMinStringArray(definition, raw, "evidenceClasses", 4, diagnostics);
  validateMinStringArray(definition, raw, "nonCombatResolutions", 1, diagnostics);
  validateMinStringArray(definition, raw, "stateMachine", 3, diagnostics);
  validateStringField(definition, raw, "commonMisread", diagnostics);
  validateMinStringArray(definition, raw, "accidentReviewKeys", 1, diagnostics);
}

function validateStringField(
  definition: M5SemanticDefinition,
  raw: Readonly<Record<string, unknown>>,
  fieldName: string,
  diagnostics: ContentDiagnostic[],
): void {
  const value = raw[fieldName];
  if (typeof value !== "string" || value.length === 0) {
    diagnostics.push({
      code: "m5_semantic_field_invalid",
      message: `${definition.id}.${fieldName} must be a non-empty string`,
      location: definition.locations.id,
      relatedLocations: [],
    });
  }
}

function validateMinStringArray(
  definition: M5SemanticDefinition,
  raw: Readonly<Record<string, unknown>>,
  fieldName: string,
  minItems: number,
  diagnostics: ContentDiagnostic[],
): void {
  const value = raw[fieldName];
  if (!Array.isArray(value) || value.length < minItems) {
    diagnostics.push({
      code: "m5_semantic_field_invalid",
      message: `${definition.id}.${fieldName} must include at least ${String(minItems)} item(s)`,
      location: definition.locations.id,
      relatedLocations: [],
    });
    return;
  }

  for (const entry of value) {
    if (typeof entry !== "string" || entry.length === 0) {
      diagnostics.push({
        code: "m5_semantic_field_invalid",
        message: `${definition.id}.${fieldName} must contain only non-empty strings`,
        location: definition.locations.id,
        relatedLocations: [],
      });
      return;
    }
  }
}

function validatePositiveInteger(
  definition: M5SemanticDefinition,
  raw: Readonly<Record<string, unknown>>,
  fieldName: string,
  diagnostics: ContentDiagnostic[],
): void {
  const value = raw[fieldName];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    diagnostics.push({
      code: "m5_semantic_field_invalid",
      message: `${definition.id}.${fieldName} must be a positive integer`,
      location: definition.locations.id,
      relatedLocations: [],
    });
  }
}

function buildRawDefinitionsById(
  parsedFiles: readonly ParsedM5File[],
): ReadonlyMap<string, Readonly<Record<string, unknown>>> {
  const rawDefinitionsById = new Map<string, Readonly<Record<string, unknown>>>();
  for (const entry of parsedFiles) {
    if (!isDefinitionPath(entry.file.relativePath)) {
      continue;
    }
    const data = asRecord(entry.json);
    const id = data?.["id"];
    if (data !== undefined && typeof id === "string") {
      rawDefinitionsById.set(id, data);
    }
  }
  return rawDefinitionsById;
}

function countM5Kinds(definitions: readonly M5SemanticDefinition[]): {
  readonly anomaly: number;
  readonly factionHook: number;
  readonly governanceHook: number;
  readonly seasonEvent: number;
  readonly catalogEntry: number;
} {
  let anomaly = 0;
  let factionHook = 0;
  let governanceHook = 0;
  let seasonEvent = 0;
  let catalogEntry = 0;

  for (const definition of definitions) {
    const kind = parseM5Kind(definition.kind);
    if (kind === "m5.anomaly") {
      anomaly += 1;
    } else if (kind === "m5.faction_hook") {
      factionHook += 1;
    } else if (kind === "m5.governance_hook") {
      governanceHook += 1;
    } else if (kind === "m5.season_event") {
      seasonEvent += 1;
    } else if (kind === "m5.catalog_entry") {
      catalogEntry += 1;
    }
  }

  return {
    anomaly,
    factionHook,
    governanceHook,
    seasonEvent,
    catalogEntry,
  };
}
