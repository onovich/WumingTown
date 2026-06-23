import * as path from "node:path";

import {
  formatContentDiagnostic,
  loadContentFixture,
  type ContentDiagnostic,
  type ContentFixture,
  type ValidatedContentFixture,
  type ValidatedDefinitionFile,
  type ValidatedLocaleFile,
  type ValidatedPatchFile,
  validateContentFixture,
} from "@wuming-town/content-schema";

export interface ContentCompilationCatalog {
  readonly fixtureRoot: string;
  readonly definitions: readonly CompiledContentDefinition[];
  readonly locales: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export interface CompiledContentDefinition {
  readonly id: string;
  readonly kind: string;
  readonly schemaVersion: number;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly tags: readonly string[];
  readonly sourceNotes: readonly string[];
  readonly references: readonly string[];
  readonly labelsByLocale: Readonly<Record<string, string>>;
  readonly descriptionsByLocale: Readonly<Record<string, string>>;
}

export interface ContentCompilationOutcome {
  readonly ok: boolean;
  readonly diagnostics: readonly ContentDiagnostic[];
  readonly catalog?: ContentCompilationCatalog;
}

export async function compileContentFixture(
  fixtureRoot: string,
): Promise<ContentCompilationOutcome> {
  const loaded = await loadContentFixture(fixtureRoot);
  return compileLoadedContentFixture(loaded);
}

export async function compileContentFixtureByName(
  fixtureName: string,
  contentRoot = path.join(process.cwd(), "sources", "content"),
): Promise<ContentCompilationOutcome> {
  return compileContentFixture(path.join(contentRoot, fixtureName));
}

export function compileLoadedContentFixture(fixture: ContentFixture): ContentCompilationOutcome {
  const validated = validateContentFixture(fixture);
  if (!validated.ok || validated.fixture === undefined) {
    return {
      ok: false,
      diagnostics: validated.diagnostics,
    };
  }

  const appliedDefinitions = applyPatches(validated.fixture.definitions, validated.fixture.patches);
  const postPatchDiagnostics = validatePatchedContentFixture(
    appliedDefinitions,
    validated.fixture.locales,
  );
  if (postPatchDiagnostics.length > 0) {
    return {
      ok: false,
      diagnostics: postPatchDiagnostics,
    };
  }

  return {
    ok: true,
    diagnostics: [],
    catalog: buildCatalog(validated.fixture, appliedDefinitions),
  };
}

export function formatCompilationFailure(diagnostics: readonly ContentDiagnostic[]): string {
  return diagnostics.map((diagnostic) => formatContentDiagnostic(diagnostic)).join("\n");
}

function buildCatalog(
  fixture: ValidatedContentFixture,
  appliedDefinitions: readonly ValidatedDefinitionFile[],
): ContentCompilationCatalog {
  const sortedDefinitions = appliedDefinitions
    .slice()
    .sort((left, right) => compareStrings(left.id, right.id));
  const localeBundles = buildLocaleBundles(fixture.locales, sortedDefinitions);
  const compiledDefinitions = sortedDefinitions.map((definition) =>
    freezeValue({
      id: definition.id,
      kind: definition.kind,
      schemaVersion: definition.schemaVersion,
      labelKey: definition.labelKey,
      descriptionKey: definition.descriptionKey,
      tags: freezeValue(definition.tags.slice()),
      sourceNotes: freezeValue(definition.sourceNotes.slice()),
      references: freezeValue(definition.references.map((reference) => reference.id)),
      labelsByLocale: freezeValue(collectLocalizedValues(localeBundles, definition, "labelKey")),
      descriptionsByLocale: freezeValue(
        collectLocalizedValues(localeBundles, definition, "descriptionKey"),
      ),
    }),
  );
  const frozenDefinitions = freezeValue(compiledDefinitions.slice());
  const frozenLocales = freezeValue(localeBundles);

  return freezeValue({
    fixtureRoot: fixture.rootDir,
    definitions: frozenDefinitions,
    locales: frozenLocales,
  });
}

function applyPatches(
  definitions: readonly ValidatedDefinitionFile[],
  patches: readonly ValidatedPatchFile[],
): readonly ValidatedDefinitionFile[] {
  const clonedDefinitions: MutableValidatedDefinitionFile[] = definitions.map((definition) => ({
    filePath: definition.filePath,
    id: definition.id,
    kind: definition.kind,
    schemaVersion: definition.schemaVersion,
    labelKey: definition.labelKey,
    descriptionKey: definition.descriptionKey,
    tags: definition.tags.slice(),
    references: definition.references.slice(),
    sourceNotes: definition.sourceNotes.slice(),
    locations: definition.locations,
  }));
  const definitionsById = new Map<string, (typeof clonedDefinitions)[number]>();
  for (const definition of clonedDefinitions) {
    definitionsById.set(definition.id, definition);
  }

  for (const patch of patches) {
    const target = definitionsById.get(patch.targetId);
    if (target === undefined) {
      continue;
    }

    for (const change of patch.changes) {
      const { key: pathName, value } = change;
      if (
        pathName === "tags" &&
        Array.isArray(value) &&
        value.every((entry) => typeof entry === "string")
      ) {
        target.tags = value.slice();
        continue;
      }

      if (
        pathName === "sourceNotes" &&
        Array.isArray(value) &&
        value.every((entry) => typeof entry === "string")
      ) {
        target.sourceNotes = value.slice();
        continue;
      }

      if (
        pathName === "references" &&
        Array.isArray(value) &&
        value.every((entry) => typeof entry === "string")
      ) {
        target.references = value.map((entry) => ({
          id: entry,
          location: change.location,
        }));
        continue;
      }

      if (pathName === "labelKey" && typeof value === "string") {
        target.labelKey = value;
        target.locations.labelKey = change.location;
        continue;
      }

      if (pathName === "descriptionKey" && typeof value === "string") {
        target.descriptionKey = value;
        target.locations.descriptionKey = change.location;
        continue;
      }

      if (pathName === "kind" && typeof value === "string") {
        target.kind = value;
        target.locations.kind = change.location;
        continue;
      }

      if (pathName === "schemaVersion" && typeof value === "number" && Number.isInteger(value)) {
        target.schemaVersion = value;
        target.locations.schemaVersion = change.location;
      }
    }
  }

  return clonedDefinitions;
}

function validatePatchedContentFixture(
  definitions: readonly ValidatedDefinitionFile[],
  locales: readonly ValidatedLocaleFile[],
): readonly ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  const definitionsById = new Map<string, ValidatedDefinitionFile>();

  for (const definition of definitions) {
    definitionsById.set(definition.id, definition);
  }

  for (const definition of definitions) {
    for (const reference of definition.references) {
      if (!definitionsById.has(reference.id)) {
        diagnostics.push({
          code: "missing_def_reference",
          message: `Missing referenced def ${reference.id} in ${definition.id}`,
          location: reference.location,
          relatedLocations: [],
        });
      }
    }

    const missingLocaleKeys = [definition.labelKey, definition.descriptionKey].filter(
      (key) => !allLocalesContainKey(locales, key),
    );

    for (const key of missingLocaleKeys) {
      diagnostics.push({
        code: "missing_localization_key",
        message: `Missing localization key ${key} for ${definition.id}`,
        location:
          key === definition.labelKey
            ? definition.locations.labelKey
            : definition.locations.descriptionKey,
        relatedLocations: [],
      });
    }
  }

  return diagnostics;
}

function buildLocaleBundles(
  locales: readonly ValidatedLocaleFile[],
  definitions: readonly ValidatedDefinitionFile[],
): Readonly<Record<string, Readonly<Record<string, string>>>> {
  const bundles: Record<string, Record<string, string>> = {};
  for (const locale of locales
    .slice()
    .sort((left, right) => compareStrings(left.locale, right.locale))) {
    const entries: Record<string, string> = {};
    const sortedKeys = Array.from(locale.entries.keys()).sort(compareStrings);
    for (const key of sortedKeys) {
      entries[key] = locale.entries.get(key) ?? "";
    }
    bundles[locale.locale] = freezeValue(entries);
  }

  for (const definition of definitions) {
    for (const locale of locales) {
      const bundle = bundles[locale.locale];
      if (bundle === undefined) {
        continue;
      }
      bundle[definition.labelKey] ??= "";
      bundle[definition.descriptionKey] ??= "";
    }
  }

  return bundles;
}

function collectLocalizedValues(
  localeBundles: Readonly<Record<string, Readonly<Record<string, string>>>>,
  definition: Pick<CompiledContentDefinition, "labelKey" | "descriptionKey">,
  fieldName: "labelKey" | "descriptionKey",
): Readonly<Record<string, string>> {
  const values: Record<string, string> = {};
  const sortedLocales = Object.keys(localeBundles).sort(compareStrings);
  for (const localeName of sortedLocales) {
    const bundle = localeBundles[localeName];
    if (bundle === undefined) {
      continue;
    }
    const key = definition[fieldName];
    values[localeName] = bundle[key] ?? "";
  }
  return values;
}

function allLocalesContainKey(locales: readonly ValidatedLocaleFile[], key: string): boolean {
  for (const locale of locales) {
    if (!locale.entries.has(key)) {
      return false;
    }
  }
  return locales.length > 0;
}

interface MutableValidatedDefinitionFile {
  filePath: string;
  id: string;
  kind: string;
  schemaVersion: number;
  labelKey: string;
  descriptionKey: string;
  tags: string[];
  references: ValidatedDefinitionFile["references"];
  sourceNotes: string[];
  locations: {
    schemaVersion: { filePath: string; line: number; column: number };
    id: { filePath: string; line: number; column: number };
    kind: { filePath: string; line: number; column: number };
    labelKey: { filePath: string; line: number; column: number };
    descriptionKey: { filePath: string; line: number; column: number };
  };
}

function freezeValue<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
  }
  return value;
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
