#!/usr/bin/env node
import { findRetryConfigurationMatches } from "./assert-no-test-retries-lib.mjs";

const positiveCases = [
  "--retry=2",
  "--retry 2",
  "--retries=2",
  "--retries 2",
  "--repeat-each=2",
  "--repeat-each 2",
  "retry: 2",
  "retries: 2",
  "repeatEach: 2",
];

const negativeCases = ["retry: 0", "--retry 0", "--retries=0", "--repeat-each=0", "no retries"];

for (const sample of positiveCases) {
  if (findRetryConfigurationMatches(sample).length === 0) {
    throw new Error(`Expected retry guard to flag: ${sample}`);
  }
}

for (const sample of negativeCases) {
  if (findRetryConfigurationMatches(sample).length !== 0) {
    throw new Error(`Expected retry guard to ignore: ${sample}`);
  }
}

console.log("Retry guard self-check passed.");
