#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const artifactRoot = resolveArtifactRoot();
const auditDir = path.join(artifactRoot, "audit");
const auditJsonPath = path.join(auditDir, "pnpm-audit.json");
const auditStderrPath = path.join(auditDir, "pnpm-audit.stderr.log");

mkdirSync(auditDir, { recursive: true });

const result = spawnSync("pnpm", ["audit", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

writeFileSync(auditJsonPath, normalizeOutput(result.stdout), "utf8");
writeFileSync(auditStderrPath, normalizeOutput(result.stderr), "utf8");

if (result.error !== undefined) {
  console.error(result.error.message);
  console.error(`Audit artifact: ${toRelativePath(auditJsonPath)}`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error("Dependency audit failed.");
  console.error(`Audit artifact: ${toRelativePath(auditJsonPath)}`);
  if (result.stderr.trim().length > 0) {
    console.error(result.stderr.trim());
  }
  process.exit(result.status);
}

const parsed = JSON.parse(result.stdout);
console.log("Dependency audit passed.");
console.log(JSON.stringify(parsed.metadata, null, 2));
console.log(`Audit artifact: ${toRelativePath(auditJsonPath)}`);

function resolveArtifactRoot() {
  const configuredRoot = process.env.WM_ARTIFACT_DIR;

  if (configuredRoot !== undefined && configuredRoot.length > 0) {
    return path.resolve(process.cwd(), configuredRoot);
  }

  return path.resolve(process.cwd(), "coordination", "artifacts", "WM-0010");
}

function normalizeOutput(output) {
  if (typeof output !== "string" || output.length === 0) {
    return "";
  }

  return output.endsWith("\n") ? output : `${output}\n`;
}

function toRelativePath(targetPath) {
  return path.relative(process.cwd(), targetPath).replaceAll("\\", "/");
}
