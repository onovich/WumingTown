#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const commands = [
  ["node", ["tools/write-environment-report.mjs"]],
  ["node", ["tools/assert-no-test-retries.mjs"]],
  ["pnpm", ["format:check"]],
  ["pnpm", ["lint"]],
  ["pnpm", ["typecheck"]],
  ["pnpm", ["content:validate"]],
  ["pnpm", ["boundaries:check"]],
  ["pnpm", ["test"]],
  ["pnpm", ["sim:replay-test"]],
  ["pnpm", ["test:e2e"]],
  ["pnpm", ["handoff:validate"]],
  ["pnpm", ["coord:validate"]],
];

for (const [command, args] of commands) {
  const display = `${command} ${args.join(" ")}`;
  console.log(`\n==> ${display}`);
  const result = spawnSync(command, args, {
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error !== undefined) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nci:local passed.");
