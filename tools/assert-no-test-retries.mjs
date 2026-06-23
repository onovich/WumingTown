#!/usr/bin/env node
import * as path from "node:path";

import { findRetryConfigurationFiles } from "./assert-no-test-retries-lib.mjs";

const roots = [
  path.join(process.cwd(), ".github"),
  path.join(process.cwd(), "apps"),
  path.join(process.cwd(), "packages"),
  path.join(process.cwd(), "tools"),
  path.join(process.cwd(), "package.json"),
  path.join(process.cwd(), "vitest.config.mjs"),
];

const findings = findRetryConfigurationFiles(roots);

if (findings.length > 0) {
  console.error("Detected non-zero retry configuration in test or CI sources:");
  for (const finding of findings) {
    console.error(`- ${finding.path}: ${finding.matches.join(", ")}`);
  }
  process.exit(1);
}

console.log("No non-zero test retry configuration found.");
