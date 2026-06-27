#!/usr/bin/env node

import { validateLocalizationCatalogs } from "../packages/ui-react/src/localization.ts";

const issues = validateLocalizationCatalogs();

if (issues.length === 0) {
  console.log(
    "Localization validation passed: zh-CN/en catalogs are complete for player-visible keys.",
  );
  process.exit(0);
}

console.error("Localization validation failed.");
for (const issue of issues) {
  const localeSuffix = issue.locale === undefined ? "" : ` [${issue.locale}]`;
  console.error(`- ${issue.issue}: ${issue.key}${localeSuffix}`);
}

process.exit(1);
