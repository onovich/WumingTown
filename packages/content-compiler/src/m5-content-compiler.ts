import {
  loadM5ContentPackFromDirectory,
  type ContentDiagnostic,
  type M5ContentManifest,
  type M5ContentPack,
  type M5ContentValidationCounters,
  type M5ValidatedContentPack,
  validateM5ContentPack,
} from "@wuming-town/content-schema";

export interface M5ContentCompilationCatalog {
  readonly manifest: M5ContentManifest;
  readonly contentManifestHash: string;
  readonly counters: M5ContentValidationCounters;
  readonly definitions: readonly M5CompiledContentDefinition[];
}

export interface M5CompiledContentDefinition {
  readonly defIndex: number;
  readonly id: string;
  readonly kind: string;
  readonly schemaVersion: number;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly tags: readonly string[];
  readonly references: readonly string[];
}

export interface M5ContentCompilationOutcome {
  readonly ok: boolean;
  readonly diagnostics: readonly ContentDiagnostic[];
  readonly catalog?: M5ContentCompilationCatalog;
}

export async function compileM5ContentPackFromDirectory(
  rootDir: string,
): Promise<M5ContentCompilationOutcome> {
  const pack = await loadM5ContentPackFromDirectory(rootDir);
  return compileM5ContentPack(pack);
}

export function compileM5ContentPack(pack: M5ContentPack): M5ContentCompilationOutcome {
  const validated = validateM5ContentPack(pack);
  if (!validated.ok || validated.pack === undefined) {
    return {
      ok: false,
      diagnostics: validated.diagnostics,
    };
  }

  return {
    ok: true,
    diagnostics: [],
    catalog: buildM5Catalog(validated.pack),
  };
}

function buildM5Catalog(pack: M5ValidatedContentPack): M5ContentCompilationCatalog {
  const definitions = pack.fixture.definitions
    .slice()
    .sort((left, right) => compareStrings(left.id, right.id))
    .map((definition, index) =>
      freezeValue({
        defIndex: index,
        id: definition.id,
        kind: definition.kind,
        schemaVersion: definition.schemaVersion,
        labelKey: definition.labelKey,
        descriptionKey: definition.descriptionKey,
        tags: freezeValue(definition.tags.slice()),
        references: freezeValue(definition.references.map((reference) => reference.id)),
      }),
    );
  const frozenDefinitions = freezeValue(definitions.slice());
  const manifest = freezeValue({
    schemaVersion: pack.manifest.schemaVersion,
    id: pack.manifest.id,
    version: pack.manifest.version,
    displayName: pack.manifest.displayName,
    capabilities: freezeValue(pack.manifest.capabilities.slice()),
    contentKinds: freezeValue(pack.manifest.contentKinds.slice()),
    locales: freezeValue(pack.manifest.locales.slice()),
    dependencies: freezeValue(pack.manifest.dependencies.slice()),
    maxFileBytes: pack.manifest.maxFileBytes,
    maxTotalBytes: pack.manifest.maxTotalBytes,
  });
  const counters = freezeValue({ ...pack.counters });
  const hashInput = {
    manifest,
    definitions: frozenDefinitions.map((definition) => ({
      defIndex: definition.defIndex,
      id: definition.id,
      kind: definition.kind,
      schemaVersion: definition.schemaVersion,
      references: definition.references,
      tags: definition.tags,
    })),
    counters,
  };

  return freezeValue({
    manifest,
    contentManifestHash: fnv1a32(stableSerialize(hashInput)),
    counters,
    definitions: frozenDefinitions,
  });
}

function freezeValue<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
  }
  return value;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => compareStrings(left, right));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
      .join(",")}}`;
  }

  if (value === undefined || typeof value === "function") {
    return "null";
  }
  return JSON.stringify(value);
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `0x${hash.toString(16).padStart(8, "0")}`;
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
