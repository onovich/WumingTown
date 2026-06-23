#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const outputPath = readOutputPath(process.argv.slice(2));
const report = {
  generatedAt: new Date().toISOString(),
  cwd: process.cwd(),
  nodeVersion: process.version,
  npmVersion: readCommandOutput("npm", ["--version"]),
  pnpmVersion: readCommandOutput("pnpm", ["--version"]),
  gitCommit: readCommandOutput("git", ["rev-parse", "HEAD"]),
  platform: process.platform,
  arch: process.arch,
  osRelease: os.release(),
  cpuModel: os.cpus()[0]?.model ?? "unknown",
  cpuCount: os.cpus().length,
  totalMemoryBytes: os.totalmem(),
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Environment report: ${toRelativePath(outputPath)}`);

function readOutputPath(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--output") {
      const value = argv[index + 1];

      if (value === undefined || value.length === 0) {
        throw new Error("--output requires a path");
      }

      return path.resolve(process.cwd(), value);
    }

    if (arg.startsWith("--output=")) {
      const value = arg.slice("--output=".length);

      if (value.length === 0) {
        throw new Error("--output requires a path");
      }

      return path.resolve(process.cwd(), value);
    }
  }

  return path.resolve(resolveArtifactRoot(), "environment", "tool-versions.json");
}

function resolveArtifactRoot() {
  const configuredRoot = process.env.WM_ARTIFACT_DIR;

  if (configuredRoot !== undefined && configuredRoot.length > 0) {
    return path.resolve(process.cwd(), configuredRoot);
  }

  return path.resolve(process.cwd(), "coordination", "artifacts", "WM-0010");
}

function readCommandOutput(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${String(result.stderr ?? result.stdout ?? "")}`,
    );
  }

  return result.stdout.trim();
}

function toRelativePath(targetPath) {
  return path.relative(process.cwd(), targetPath).replaceAll("\\", "/");
}
