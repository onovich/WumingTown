import * as path from "node:path";

import type { ContentDiagnostic, ContentFixture, ContentRawFile } from "./content-fixtures";
import type { M5ContentPack, M5ContentPackFile, ParsedM5File } from "./m5-content-validation-types";
import { fileLocation } from "./m5-content-validation-utils";

export async function loadM5ContentPackFromDirectory(rootDir: string): Promise<M5ContentPack> {
  const { readFile } = await import("node:fs/promises");
  const filePaths = await collectPackFiles(rootDir);
  const files: M5ContentPackFile[] = [];

  for (const filePath of filePaths) {
    const text = await readFile(filePath, "utf8");
    files.push({
      relativePath: normalizePackPath(path.relative(rootDir, filePath)),
      text,
      byteLength: Buffer.byteLength(text, "utf8"),
    });
  }

  return {
    rootDir,
    files,
  };
}

export function validatePackFileSafety(
  file: M5ContentPackFile,
  byteLength: number,
  maxFileBytes: number,
  maxPathSegments: number,
  diagnostics: ContentDiagnostic[],
): void {
  const safety = validateRelativePackPath(file.relativePath, maxPathSegments);
  if (!safety.ok) {
    diagnostics.push({
      code: safety.code,
      message: safety.message,
      location: fileLocation(file.relativePath),
      relatedLocations: [],
    });
    return;
  }

  if (byteLength > maxFileBytes) {
    diagnostics.push({
      code: "m5_file_size_exceeded",
      message: `${file.relativePath} is ${String(byteLength)} bytes; maximum is ${String(
        maxFileBytes,
      )}`,
      location: fileLocation(file.relativePath),
      relatedLocations: [],
    });
  }

  if (isExecutableOrCodePath(file.relativePath)) {
    diagnostics.push({
      code: "m5_unsupported_capability",
      message: `${file.relativePath} is executable or code content; M5 data mods are data-only`,
      location: fileLocation(file.relativePath),
      relatedLocations: [],
    });
    return;
  }

  if (isArchivePath(file.relativePath)) {
    diagnostics.push({
      code: "m5_archive_file_forbidden",
      message: `${file.relativePath} is an archive; recursive archive expansion is forbidden`,
      location: fileLocation(file.relativePath),
      relatedLocations: [],
    });
    return;
  }

  if (!isAllowedPackPath(file.relativePath)) {
    diagnostics.push({
      code: "m5_unsupported_file_path",
      message: `${file.relativePath} is outside manifest, defs, locales or patches`,
      location: fileLocation(file.relativePath),
      relatedLocations: [],
    });
    return;
  }

  if (!isSupportedContentExtension(file.relativePath)) {
    diagnostics.push({
      code: "m5_unsupported_file_path",
      message: `${file.relativePath} must be JSON or JSON5 content`,
      location: fileLocation(file.relativePath),
      relatedLocations: [],
    });
  }
}

export function buildContentFixture(
  rootDir: string,
  parsedFiles: readonly ParsedM5File[],
  diagnostics: ContentDiagnostic[],
): ContentFixture {
  const files: ContentRawFile[] = [];
  for (const entry of parsedFiles) {
    if (entry.parseError !== undefined) {
      diagnostics.push({
        code: "m5_json_syntax",
        message: entry.parseError,
        location: fileLocation(entry.file.relativePath),
        relatedLocations: [],
      });
      continue;
    }

    if (!isFixtureContentPath(entry.file.relativePath)) {
      continue;
    }

    const kind = classifyFixtureFile(entry.file.relativePath);
    if (kind === undefined) {
      diagnostics.push({
        code: "m5_unsupported_file_path",
        message: `${entry.file.relativePath} is not under defs, locales or patches`,
        location: fileLocation(entry.file.relativePath),
        relatedLocations: [],
      });
      continue;
    }

    const contentFile: ContentRawFile = {
      filePath: toVirtualFilePath(rootDir, entry.file.relativePath),
      kind,
      text: entry.file.text,
      json: entry.json,
    };
    files.push(contentFile);
  }

  return {
    rootDir,
    files,
  };
}

export function isManifestPath(relativePath: string): boolean {
  return relativePath === "manifest.json" || relativePath === "manifest.json5";
}

export function isFixtureContentPath(relativePath: string): boolean {
  return (
    relativePath.startsWith("defs/") ||
    relativePath.startsWith("locales/") ||
    relativePath.startsWith("patches/")
  );
}

export function isDefinitionPath(relativePath: string): boolean {
  return relativePath.startsWith("defs/");
}

export function isLocalePath(relativePath: string): boolean {
  return relativePath.startsWith("locales/");
}

export function isJsonContentPath(relativePath: string): boolean {
  return (
    relativePath.endsWith(".json") ||
    relativePath.endsWith(".json5") ||
    isManifestPath(relativePath)
  );
}

function validateRelativePackPath(
  relativePath: string,
  maxPathSegments: number,
): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
  if (
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    /^[A-Za-z]:/.test(relativePath)
  ) {
    return {
      ok: false,
      code: "m5_unsafe_path",
      message: `${relativePath} is not a safe relative path`,
    };
  }

  if (relativePath.includes("\\") || relativePath.includes("\0")) {
    return {
      ok: false,
      code: "m5_unsafe_path",
      message: `${relativePath} contains an unsafe path separator or null byte`,
    };
  }

  const segments = relativePath.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    return {
      ok: false,
      code: "m5_unsafe_path",
      message: `${relativePath} contains unsafe path traversal`,
    };
  }

  if (segments.length > maxPathSegments) {
    return {
      ok: false,
      code: "m5_path_depth_exceeded",
      message: `${relativePath} exceeds maximum path depth ${String(maxPathSegments)}`,
    };
  }

  return { ok: true };
}

function isAllowedPackPath(relativePath: string): boolean {
  return (
    isManifestPath(relativePath) ||
    isFixtureContentPath(relativePath) ||
    isExecutableOrCodePath(relativePath) ||
    isArchivePath(relativePath)
  );
}

function classifyFixtureFile(relativePath: string): "definition" | "locale" | "patch" | undefined {
  if (relativePath.startsWith("defs/")) {
    return "definition";
  }
  if (relativePath.startsWith("locales/")) {
    return "locale";
  }
  if (relativePath.startsWith("patches/")) {
    return "patch";
  }
  return undefined;
}

function isSupportedContentExtension(filePath: string): boolean {
  return filePath.endsWith(".json") || filePath.endsWith(".json5");
}

function isExecutableOrCodePath(relativePath: string): boolean {
  return /\.(?:bat|cmd|cjs|dll|exe|js|mjs|node|ps1|sh|ts|tsx|wasm)$/i.test(relativePath);
}

function isArchivePath(relativePath: string): boolean {
  return /\.(?:7z|gz|rar|tar|tgz|zip)$/i.test(relativePath);
}

function toVirtualFilePath(rootDir: string, relativePath: string): string {
  return `${rootDir}/${relativePath}`;
}

function normalizePackPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

async function collectPackFiles(rootDir: string): Promise<readonly string[]> {
  const files = await collectFilesRecursive(rootDir);
  return files.slice().sort((left, right) => left.localeCompare(right));
}

async function collectFilesRecursive(directoryPath: string): Promise<readonly string[]> {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const childPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFilesRecursive(childPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(childPath);
    }
  }

  return files;
}
