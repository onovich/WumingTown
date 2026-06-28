#!/usr/bin/env node

await import("./register-ts-extension-loader.mjs");

const [
  { WEB_PRODUCT_GATE_READ_MODEL },
  { validateLocalizationCatalogs },
  { validateShellFixtureLocalization },
] = await Promise.all([
  import("../apps/web/src/product-gate-fixture.ts"),
  import("../packages/ui-react/src/localization.ts"),
  import("../packages/ui-react/src/shell-read-model-localization.ts"),
]);

const issues = [
  ...validateLocalizationCatalogs(),
  ...validateShellFixtureLocalization(WEB_PRODUCT_GATE_READ_MODEL),
];

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
