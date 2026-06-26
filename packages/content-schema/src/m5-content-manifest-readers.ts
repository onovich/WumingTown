import type { ContentDiagnostic } from "./content-fixtures";
import { compareStrings, fieldLocation } from "./m5-content-validation-utils";

export function validateKnownFields(
  data: Readonly<Record<string, unknown>>,
  knownFields: readonly string[],
  code: string,
  filePath: string,
  diagnostics: ContentDiagnostic[],
): void {
  const known = new Set(knownFields);
  for (const key of Object.keys(data)) {
    if (!known.has(key)) {
      diagnostics.push({
        code,
        message: `Unknown field ${key}`,
        location: fieldLocation(filePath),
        relatedLocations: [],
      });
    }
  }
}

export function readString(
  data: Readonly<Record<string, unknown>>,
  fieldName: string,
  filePath: string,
  diagnostics: ContentDiagnostic[],
): string | undefined {
  const value = data[fieldName];
  if (typeof value !== "string" || value.length === 0) {
    diagnostics.push({
      code: "m5_manifest_invalid_shape",
      message: `${fieldName} must be a non-empty string`,
      location: fieldLocation(filePath),
      relatedLocations: [],
    });
    return undefined;
  }
  return value;
}

export function readInteger(
  data: Readonly<Record<string, unknown>>,
  fieldName: string,
  filePath: string,
  diagnostics: ContentDiagnostic[],
): number | undefined {
  const value = data[fieldName];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    diagnostics.push({
      code: "m5_manifest_invalid_shape",
      message: `${fieldName} must be an integer`,
      location: fieldLocation(filePath),
      relatedLocations: [],
    });
    return undefined;
  }
  return value;
}

export function readOptionalInteger(
  data: Readonly<Record<string, unknown>>,
  fieldName: string,
  filePath: string,
  diagnostics: ContentDiagnostic[],
): number | undefined {
  if (!(fieldName in data)) {
    return undefined;
  }
  return readInteger(data, fieldName, filePath, diagnostics);
}

export function readStringArray(
  data: Readonly<Record<string, unknown>>,
  fieldName: string,
  filePath: string,
  diagnostics: ContentDiagnostic[],
): readonly string[] | undefined {
  const value = data[fieldName];
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    diagnostics.push({
      code: "m5_manifest_invalid_shape",
      message: `${fieldName} must be an array of strings`,
      location: fieldLocation(filePath),
      relatedLocations: [],
    });
    return undefined;
  }
  return value.slice().sort(compareStrings);
}

export function readOptionalStringArray(
  data: Readonly<Record<string, unknown>>,
  fieldName: string,
  filePath: string,
  diagnostics: ContentDiagnostic[],
): readonly string[] | undefined {
  if (!(fieldName in data)) {
    return undefined;
  }
  return readStringArray(data, fieldName, filePath, diagnostics);
}
