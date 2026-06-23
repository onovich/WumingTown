import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const errors = [];
const expectedWorkspacePaths = [
  "apps/web",
  "apps/desktop-electron",
  "packages/foundation",
  "packages/content-schema",
  "packages/content-compiler",
  "packages/sim-core",
  "packages/sim-protocol",
  "packages/sim-worker",
  "packages/renderer-pixi",
  "packages/ui-react",
  "packages/persistence",
  "packages/platform",
  "packages/testkit",
  "packages/benchmarks",
  "tools/content-cli",
  "tools/headless-runner",
];

const readJson = async (relativePath) => {
  const text = await readFile(path.join(root, relativePath), "utf8");
  return JSON.parse(text);
};

const validateExactVersion = (owner, dependencyName, version) => {
  if (version === "workspace:0.0.0") {
    return;
  }

  if (
    version === "latest" ||
    version === "*" ||
    version.startsWith("^") ||
    version.startsWith("~") ||
    version.includes("x")
  ) {
    errors.push(`${owner} dependency ${dependencyName} is not exact: ${version}`);
  }
};

const validateManifest = async (relativePath) => {
  const manifest = await readJson(`${relativePath}/package.json`);

  if (manifest.private !== true) {
    errors.push(`${relativePath}/package.json must be private for the bootstrap phase.`);
  }

  if (manifest.type !== "module") {
    errors.push(`${relativePath}/package.json must declare type: module.`);
  }

  if (manifest.exports?.["."] !== "./src/index.ts") {
    errors.push(`${relativePath}/package.json must expose only ./src/index.ts.`);
  }

  if (manifest.wumingBoundary?.allowedInternalDependencies === undefined) {
    errors.push(
      `${relativePath}/package.json is missing wumingBoundary.allowedInternalDependencies.`,
    );
  }

  for (const dependencyGroup of ["dependencies", "devDependencies", "peerDependencies"]) {
    const dependencies = manifest[dependencyGroup] ?? {};
    for (const [dependencyName, version] of Object.entries(dependencies)) {
      validateExactVersion(relativePath, dependencyName, version);
    }
  }
};

const rootManifest = await readJson("package.json");
if (rootManifest.packageManager !== "pnpm@11.8.0") {
  errors.push("Root packageManager must be pnpm@11.8.0.");
}

for (const [dependencyName, version] of Object.entries(rootManifest.devDependencies ?? {})) {
  validateExactVersion("root", dependencyName, version);
}

for (const workspacePath of expectedWorkspacePaths) {
  await validateManifest(workspacePath);
}

const schemaEntries = await readdir(path.join(root, "schemas"), { withFileTypes: true });
for (const entry of schemaEntries) {
  if (entry.isFile() && entry.name.endsWith(".schema.json")) {
    await readJson(`schemas/${entry.name}`);
  }
}

if (errors.length > 0) {
  console.error("Content validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Content validation passed for ${expectedWorkspacePaths.length} workspaces.`);
}
