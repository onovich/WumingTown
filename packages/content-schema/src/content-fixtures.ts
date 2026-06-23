import { readFile, readdir } from "node:fs/promises";
import * as path from "node:path";

export const DEF_BASE_ID_PATTERN = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*){2,}$/;

export interface ContentSourceLocation {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
}

export interface ContentDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly location: ContentSourceLocation;
  readonly relatedLocations: readonly ContentSourceLocation[];
}

export interface ContentRawFile {
  readonly filePath: string;
  readonly kind: "definition" | "locale" | "patch";
  readonly text: string;
  readonly json: unknown;
}

export interface ContentFixture {
  readonly rootDir: string;
  readonly files: readonly ContentRawFile[];
}

export interface ValidatedDefinitionFile {
  readonly filePath: string;
  readonly id: string;
  readonly kind: string;
  readonly schemaVersion: number;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly tags: readonly string[];
  readonly references: readonly ContentReference[];
  readonly sourceNotes: readonly string[];
  readonly locations: {
    readonly schemaVersion: ContentSourceLocation;
    readonly id: ContentSourceLocation;
    readonly kind: ContentSourceLocation;
    readonly labelKey: ContentSourceLocation;
    readonly descriptionKey: ContentSourceLocation;
  };
}

export interface ContentReference {
  readonly id: string;
  readonly location: ContentSourceLocation;
}

export interface ValidatedLocaleFile {
  readonly filePath: string;
  readonly locale: string;
  readonly entries: ReadonlyMap<string, string>;
}

export interface ValidatedPatchFile {
  readonly filePath: string;
  readonly targetId: string;
  readonly targetLocation: ContentSourceLocation;
  readonly changes: ReadonlyMap<string, unknown>;
}

export interface ValidatedContentFixture {
  readonly rootDir: string;
  readonly definitions: readonly ValidatedDefinitionFile[];
  readonly locales: readonly ValidatedLocaleFile[];
  readonly patches: readonly ValidatedPatchFile[];
}

export interface ContentValidationOutcome {
  readonly ok: boolean;
  readonly diagnostics: readonly ContentDiagnostic[];
  readonly fixture?: ValidatedContentFixture;
}

export async function loadContentFixture(rootDir: string): Promise<ContentFixture> {
  const files: ContentRawFile[] = [];
  const filePaths = await collectContentFiles(rootDir);

  for (const filePath of filePaths) {
    const text = await readFile(filePath, "utf8");
    const json: unknown = JSON.parse(text);
    files.push({
      filePath,
      kind: classifyContentFile(rootDir, filePath),
      text,
      json,
    });
  }

  return {
    rootDir,
    files,
  };
}

export function validateContentFixture(fixture: ContentFixture): ContentValidationOutcome {
  const diagnostics: ContentDiagnostic[] = [];
  const definitions: ValidatedDefinitionFile[] = [];
  const locales: ValidatedLocaleFile[] = [];
  const patches: ValidatedPatchFile[] = [];
  const definitionsById = new Map<string, ValidatedDefinitionFile>();

  for (const file of fixture.files) {
    if (file.kind === "definition") {
      const parsed = parseDefinitionFile(file, diagnostics);
      if (parsed !== undefined) {
        definitions.push(parsed);
      }
      continue;
    }

    if (file.kind === "locale") {
      const parsed = parseLocaleFile(file, diagnostics);
      if (parsed !== undefined) {
        locales.push(parsed);
      }
      continue;
    }

    const parsed = parsePatchFile(file, diagnostics);
    if (parsed !== undefined) {
      patches.push(parsed);
    }
  }

  for (const definition of definitions) {
    const previous = definitionsById.get(definition.id);
    if (previous !== undefined) {
      diagnostics.push({
        code: "duplicate_def_id",
        message: `Duplicate def id ${definition.id}`,
        location: definition.locations.id,
        relatedLocations: [previous.locations.id],
      });
      continue;
    }

    definitionsById.set(definition.id, definition);
  }

  for (const definition of definitions) {
    if (!DEF_BASE_ID_PATTERN.test(definition.id)) {
      diagnostics.push({
        code: "invalid_def_id",
        message: `Invalid def id ${definition.id}; expected namespace segments like core.anomaly.borrowed_shadow.`,
        location: definition.locations.id,
        relatedLocations: [],
      });
    }

    if (definition.schemaVersion < 1) {
      diagnostics.push({
        code: "invalid_schema_version",
        message: `schemaVersion must be at least 1 for ${definition.id}`,
        location: definition.locations.schemaVersion,
        relatedLocations: [],
      });
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
  }

  for (const patch of patches) {
    if (!definitionsById.has(patch.targetId)) {
      diagnostics.push({
        code: "missing_patch_target",
        message: `Patch target ${patch.targetId} was not found`,
        location: patch.targetLocation,
        relatedLocations: [],
      });
    }
  }

  const patchValuesByTarget = new Map<
    string,
    Map<string, { value: string; location: ContentSourceLocation }>
  >();
  for (const patch of patches) {
    const targetChanges =
      patchValuesByTarget.get(patch.targetId) ??
      new Map<string, { value: string; location: ContentSourceLocation }>();
    for (const [pathName, value] of patch.changes.entries()) {
      const stableValue = stableSerialize(value);
      const existing = targetChanges.get(pathName);
      if (existing !== undefined && existing.value !== stableValue) {
        diagnostics.push({
          code: "patch_conflict",
          message: `Patch conflict on ${patch.targetId}.${pathName}`,
          location: patch.targetLocation,
          relatedLocations: [existing.location],
        });
      }
      if (existing === undefined) {
        targetChanges.set(pathName, {
          value: stableValue,
          location: patch.targetLocation,
        });
      }
    }
    patchValuesByTarget.set(patch.targetId, targetChanges);
  }

  if (diagnostics.length > 0) {
    return {
      ok: false,
      diagnostics,
    };
  }

  return {
    ok: true,
    diagnostics: [],
    fixture: {
      rootDir: fixture.rootDir,
      definitions: definitions.slice().sort((left, right) => compareStrings(left.id, right.id)),
      locales: locales.slice().sort((left, right) => compareStrings(left.locale, right.locale)),
      patches: patches.slice().sort((left, right) => {
        const targetOrder = compareStrings(left.targetId, right.targetId);
        if (targetOrder !== 0) {
          return targetOrder;
        }
        return compareStrings(left.filePath, right.filePath);
      }),
    },
  };
}

export async function discoverContentFixtureRoots(contentRoot: string): Promise<readonly string[]> {
  const entries = await readdir(contentRoot, { withFileTypes: true });
  const roots: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      roots.push(path.join(contentRoot, entry.name));
    }
  }

  roots.sort(compareStrings);
  return roots;
}

export function formatContentDiagnostic(diagnostic: ContentDiagnostic): string {
  return `${diagnostic.location.filePath}:${String(diagnostic.location.line)}:${String(
    diagnostic.location.column,
  )} ${diagnostic.code}: ${diagnostic.message}`;
}

async function collectContentFiles(rootDir: string): Promise<readonly string[]> {
  const directories = ["defs", "locales", "patches"];
  const filePaths: string[] = [];

  for (const directoryName of directories) {
    const directoryPath = path.join(rootDir, directoryName);
    const discovered = await collectJsonFiles(directoryPath);
    filePaths.push(...discovered);
  }

  filePaths.sort(compareStrings);
  return filePaths;
}

async function collectJsonFiles(directoryPath: string): Promise<readonly string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const filePaths: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      filePaths.push(...(await collectJsonFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      filePaths.push(entryPath);
    }
  }

  filePaths.sort(compareStrings);
  return filePaths;
}

function classifyContentFile(rootDir: string, filePath: string): "definition" | "locale" | "patch" {
  const relativePath = path.relative(rootDir, filePath);
  const segments = relativePath.split(path.sep);
  const category = segments[0];

  if (category === "defs") {
    return "definition";
  }
  if (category === "locales") {
    return "locale";
  }
  if (category === "patches") {
    return "patch";
  }

  throw new Error(`Unsupported content file path ${relativePath}`);
}

function parseDefinitionFile(
  file: ContentRawFile,
  diagnostics: ContentDiagnostic[],
): ValidatedDefinitionFile | undefined {
  const data = asRecord(file.json);
  if (data === undefined) {
    diagnostics.push(buildTypeDiagnostic(file.filePath, "definition", "an object"));
    return undefined;
  }

  const schemaVersion = readNumberField(data, "schemaVersion", file, diagnostics);
  const id = readStringField(data, "id", file, diagnostics);
  const kind = readStringField(data, "kind", file, diagnostics);
  const labelKey = readStringField(data, "labelKey", file, diagnostics);
  const descriptionKey = readStringField(data, "descriptionKey", file, diagnostics);
  const tagsRaw = readStringArrayField(data, "tags", file, diagnostics);
  const sourceNotesRaw = readStringArrayField(data, "sourceNotes", file, diagnostics);
  const referencesRaw = readStringArrayField(data, "references", file, diagnostics);
  const references = referencesRaw?.map((referenceId) => ({
    id: referenceId.value,
    location: referenceId.location,
  }));

  if (
    schemaVersion === undefined ||
    id === undefined ||
    kind === undefined ||
    labelKey === undefined ||
    descriptionKey === undefined ||
    tagsRaw === undefined ||
    sourceNotesRaw === undefined ||
    references === undefined
  ) {
    return undefined;
  }

  return {
    filePath: file.filePath,
    schemaVersion,
    id,
    kind,
    labelKey,
    descriptionKey,
    tags: tagsRaw.map((entry) => entry.value),
    sourceNotes: sourceNotesRaw.map((entry) => entry.value),
    references,
    locations: {
      schemaVersion: findPropertyLocation(file.filePath, file.text, "schemaVersion"),
      id: findPropertyLocation(file.filePath, file.text, "id"),
      kind: findPropertyLocation(file.filePath, file.text, "kind"),
      labelKey: findPropertyLocation(file.filePath, file.text, "labelKey"),
      descriptionKey: findPropertyLocation(file.filePath, file.text, "descriptionKey"),
    },
  };
}

function parseLocaleFile(
  file: ContentRawFile,
  diagnostics: ContentDiagnostic[],
): ValidatedLocaleFile | undefined {
  const data = asRecord(file.json);
  if (data === undefined) {
    diagnostics.push(buildTypeDiagnostic(file.filePath, "locale", "an object"));
    return undefined;
  }

  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "string") {
      diagnostics.push({
        code: "invalid_locale_value",
        message: `Locale entry ${key} must be a string`,
        location: findPropertyLocation(file.filePath, file.text, key),
        relatedLocations: [],
      });
      return undefined;
    }
    entries.set(key, value);
  }

  const locale = path.basename(file.filePath, ".json");

  return {
    filePath: file.filePath,
    locale,
    entries,
  };
}

function parsePatchFile(
  file: ContentRawFile,
  diagnostics: ContentDiagnostic[],
): ValidatedPatchFile | undefined {
  const data = asRecord(file.json);
  if (data === undefined) {
    diagnostics.push(buildTypeDiagnostic(file.filePath, "patch", "an object"));
    return undefined;
  }

  const targetId = readStringField(data, "targetId", file, diagnostics);
  const changesValue = data["changes"];
  const changesObject = asRecord(changesValue);
  if (changesObject === undefined) {
    diagnostics.push({
      code: "invalid_patch_changes",
      message: "Patch changes must be an object",
      location: findPropertyLocation(file.filePath, file.text, "changes"),
      relatedLocations: [],
    });
  }

  if (targetId === undefined || changesObject === undefined) {
    return undefined;
  }

  const changes = new Map<string, unknown>();
  for (const [key, value] of Object.entries(changesObject)) {
    changes.set(key, value);
  }

  const targetLocation = findPropertyLocation(file.filePath, file.text, "targetId");

  return {
    filePath: file.filePath,
    targetId,
    targetLocation,
    changes,
  };
}

function readStringField(
  data: Readonly<Record<string, unknown>>,
  fieldName: string,
  file: ContentRawFile,
  diagnostics: ContentDiagnostic[],
): string | undefined {
  const value = data[fieldName];
  if (typeof value !== "string") {
    diagnostics.push({
      code: "invalid_field_type",
      message: `${fieldName} must be a string`,
      location: findPropertyLocation(file.filePath, file.text, fieldName),
      relatedLocations: [],
    });
    return undefined;
  }

  return value;
}

function readNumberField(
  data: Readonly<Record<string, unknown>>,
  fieldName: string,
  file: ContentRawFile,
  diagnostics: ContentDiagnostic[],
): number | undefined {
  const value = data[fieldName];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    diagnostics.push({
      code: "invalid_field_type",
      message: `${fieldName} must be an integer`,
      location: findPropertyLocation(file.filePath, file.text, fieldName),
      relatedLocations: [],
    });
    return undefined;
  }

  return value;
}

function readStringArrayField(
  data: Readonly<Record<string, unknown>>,
  fieldName: string,
  file: ContentRawFile,
  diagnostics: ContentDiagnostic[],
): readonly { value: string; location: ContentSourceLocation }[] | undefined {
  const value = data[fieldName];
  if (!Array.isArray(value)) {
    diagnostics.push({
      code: "invalid_field_type",
      message: `${fieldName} must be an array of strings`,
      location: findPropertyLocation(file.filePath, file.text, fieldName),
      relatedLocations: [],
    });
    return undefined;
  }

  const valueLocations = findArrayItemLocations(file.filePath, file.text, fieldName);
  const items: { value: string; location: ContentSourceLocation }[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const item: unknown = value[index];
    const location =
      valueLocations[index] ?? findPropertyLocation(file.filePath, file.text, fieldName);
    if (typeof item !== "string") {
      diagnostics.push({
        code: "invalid_field_type",
        message: `${fieldName}[${String(index)}] must be a string`,
        location,
        relatedLocations: [],
      });
      return undefined;
    }
    items.push({ value: item, location });
  }

  return items;
}

function allLocalesContainKey(locales: readonly ValidatedLocaleFile[], key: string): boolean {
  for (const locale of locales) {
    if (!locale.entries.has(key)) {
      return false;
    }
  }
  return locales.length > 0;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return value;
}

function buildTypeDiagnostic(filePath: string, kind: string, expected: string): ContentDiagnostic {
  return {
    code: "invalid_document_type",
    message: `${kind} file must be ${expected}`,
    location: {
      filePath,
      line: 1,
      column: 1,
    },
    relatedLocations: [],
  };
}

function findPropertyLocation(
  filePath: string,
  text: string,
  propertyName: string,
): ContentSourceLocation {
  const pattern = new RegExp(`"${escapeRegex(propertyName)}"\\s*:`, "m");
  const match = pattern.exec(text);
  const offset = match?.index !== undefined ? match.index + match[0].length : 0;
  return offsetToLocation(filePath, text, skipWhitespace(text, offset));
}

function findArrayItemLocations(
  filePath: string,
  text: string,
  propertyName: string,
): readonly ContentSourceLocation[] {
  const start = findPropertyValueStart(text, propertyName);
  if (start === undefined || text[start] !== "[") {
    return [];
  }

  const locations: ContentSourceLocation[] = [];
  let index = start + 1;
  let inString = false;
  let escaped = false;
  let currentStringStart = -1;

  while (index < text.length) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        locations.push(offsetToLocation(filePath, text, currentStringStart + 1));
        inString = false;
      }
      index += 1;
      continue;
    }

    if (char === '"') {
      inString = true;
      currentStringStart = index;
    } else if (char === "]") {
      break;
    }

    index += 1;
  }

  return locations;
}

function findPropertyValueStart(text: string, propertyName: string): number | undefined {
  const pattern = new RegExp(`"${escapeRegex(propertyName)}"\\s*:`, "m");
  const match = pattern.exec(text);
  if (match?.index === undefined) {
    return undefined;
  }
  return skipWhitespace(text, match.index + match[0].length);
}

function offsetToLocation(filePath: string, text: string, offset: number): ContentSourceLocation {
  const lineStarts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      lineStarts.push(index + 1);
    }
  }

  let lineIndex = 0;
  for (let candidate = 1; candidate < lineStarts.length; candidate += 1) {
    if ((lineStarts[candidate] ?? 0) > offset) {
      break;
    }
    lineIndex = candidate;
  }

  const lineStart = lineStarts[lineIndex] ?? 0;
  return {
    filePath,
    line: lineIndex + 1,
    column: offset - lineStart + 1,
  };
}

function skipWhitespace(text: string, offset: number): number {
  let index = offset;
  while (index < text.length) {
    const char = text[index];
    if (char !== " " && char !== "\n" && char !== "\r" && char !== "\t") {
      break;
    }
    index += 1;
  }
  return index;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).sort(([left], [right]) => compareStrings(left, right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(",")}}`;
  }

  if (value === undefined || typeof value === "function") {
    return "null";
  }
  return JSON.stringify(value);
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
