#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import * as path from "node:path";

const roots = [
  path.join(process.cwd(), ".github"),
  path.join(process.cwd(), "apps"),
  path.join(process.cwd(), "packages"),
  path.join(process.cwd(), "tools"),
  path.join(process.cwd(), "package.json"),
  path.join(process.cwd(), "vitest.config.mjs"),
];

const fileExtensions = new Set([".js", ".json", ".mjs", ".ts", ".yml", ".yaml"]);
const forbiddenPatterns = [
  /\bretry\s*:\s*[1-9]\d*/u,
  /\bretries\s*:\s*[1-9]\d*/u,
  /\brepeatEach\s*:\s*[1-9]\d*/u,
  /--retry(?:=|\s+)[1-9]\d*/u,
];
const findings = [];

for (const root of roots) {
  collectFindings(root);
}

if (findings.length > 0) {
  console.error("Detected non-zero retry configuration in test or CI sources:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("No non-zero test retry configuration found.");

function collectFindings(targetPath) {
  if (!exists(targetPath)) {
    return;
  }

  const stats = statSync(targetPath);

  if (stats.isDirectory()) {
    for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
      collectFindings(path.join(targetPath, entry.name));
    }
    return;
  }

  if (!fileExtensions.has(path.extname(targetPath))) {
    return;
  }

  const text = readFileSync(targetPath, "utf8");

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) {
      findings.push(toRelativePath(targetPath));
      break;
    }
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
