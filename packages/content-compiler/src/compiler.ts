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

  return {
    ok: true,
    diagnostics: [],
    catalog: buildCatalog(validated.fixture),
  };
}

export function formatCompilationFailure(diagnostics: readonly ContentDiagnostic[]): string {
  return diagnostics.map((diagnostic) => formatContentDiagnostic(diagnostic)).join("\n");
}

function buildCatalog(fixture: ValidatedContentFixture): ContentCompilationCatalog {
  const appliedDefinitions = applyPatches(fixture.definitions, fixture.patches);
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
  const clonedDefinitions = definitions.map((definition) => ({
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

    for (const [pathName, value] of patch.changes.entries()) {
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
          location: target.locations.id,
        }));
        continue;
      }

      if (pathName === "labelKey" && typeof value === "string") {
        target.labelKey = value;
        continue;
      }

      if (pathName === "descriptionKey" && typeof value === "string") {
        target.descriptionKey = value;
        continue;
      }

      if (pathName === "kind" && typeof value === "string") {
        target.kind = value;
        continue;
      }

      if (pathName === "schemaVersion" && typeof value === "number" && Number.isInteger(value)) {
        target.schemaVersion = value;
      }
    }
  }

  return clonedDefinitions;
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
