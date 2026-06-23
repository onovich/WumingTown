import { readdirSync, readFileSync, statSync } from "node:fs";
import * as path from "node:path";

const FILE_EXTENSIONS = new Set([".js", ".json", ".mjs", ".ts", ".yml", ".yaml"]);
const IGNORED_SUFFIXES = ["tools/assert-no-test-retries-self-check.mjs"];
const FORBIDDEN_PATTERNS = [
  /\bretry\s*:\s*[1-9]\d*/u,
  /\bretries\s*:\s*[1-9]\d*/u,
  /\brepeatEach\s*:\s*[1-9]\d*/u,
  /--retry(?:=|\s+)[1-9]\d*/u,
  /--retries(?:=|\s+)[1-9]\d*/u,
  /--repeat-each(?:=|\s+)[1-9]\d*/u,
];

export function findRetryConfigurationMatches(text) {
  const matches = [];

  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = text.match(pattern);

    if (match !== null) {
      matches.push(match[0]);
    }
  }

  return matches;
}

export function findRetryConfigurationFiles(roots) {
  const findings = [];

  for (const root of roots) {
    collectFindings(root, findings);
  }

  return findings;
}

function collectFindings(targetPath, findings) {
  if (!exists(targetPath)) {
    return;
  }

  const stats = statSync(targetPath);

  if (stats.isDirectory()) {
    for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
      collectFindings(path.join(targetPath, entry.name), findings);
    }
    return;
  }

  if (!FILE_EXTENSIONS.has(path.extname(targetPath))) {
    return;
  }

  const relativePath = toRelativePath(targetPath);

  if (IGNORED_SUFFIXES.includes(relativePath)) {
    return;
  }

  const text = readFileSync(targetPath, "utf8");
  const matches = findRetryConfigurationMatches(text);

  if (matches.length > 0) {
    findings.push({
      path: relativePath,
      matches,
    });
  }
}

function exists(targetPath) {
  try {
    statSync(targetPath);
    return true;
  } catch {
    return false;
  }
}

function toRelativePath(targetPath) {
  return path.relative(process.cwd(), targetPath).replaceAll("\\", "/");
}
