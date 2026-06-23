import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const expectedPackages = [
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

const internalScope = "@wuming-town/";
const errors = [];

const readJson = async (relativePath) => {
  const text = await readFile(path.join(root, relativePath), "utf8");
  return JSON.parse(text);
};

const collectTsFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectTsFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }

  return files;
};

const getInternalPackageName = (specifier) => {
  if (!specifier.startsWith(internalScope)) {
    return undefined;
  }

  const segments = specifier.split("/");
  return `${segments[0]}/${segments[1]}`;
};

const getDependencyEntries = (manifest) => ({
  ...manifest.dependencies,
  ...manifest.devDependencies,
  ...manifest.peerDependencies,
});

const readModuleSpecifiers = (filePath, sourceText) => {
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.ES2023, true);
  const specifiers = [];

  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }

    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      const literal = node.argument.literal;
      if (ts.isStringLiteral(literal)) {
        specifiers.push(literal.text);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return specifiers;
};

const manifests = new Map();

for (const packagePath of expectedPackages) {
  const manifestPath = `${packagePath}/package.json`;

  try {
    const manifest = await readJson(manifestPath);
    manifests.set(manifest.name, { manifest, packagePath });
  } catch (error) {
    errors.push(`Missing or invalid manifest: ${manifestPath} (${error.message})`);
  }
}

for (const expectedPath of expectedPackages) {
  const manifest = [...manifests.values()].find((entry) => entry.packagePath === expectedPath);

  if (manifest === undefined) {
    continue;
  }

  const packageName = manifest.manifest.name;
  const boundary = manifest.manifest.wumingBoundary;
  const allowed = new Set(boundary?.allowedInternalDependencies ?? []);
  const dependencies = getDependencyEntries(manifest.manifest);
  const sourceDirectory = path.join(root, expectedPath, "src");
  const sourceFiles = await collectTsFiles(sourceDirectory);

  for (const allowedPackageName of allowed) {
    if (!manifests.has(allowedPackageName)) {
      errors.push(`${packageName} allows unknown internal dependency ${allowedPackageName}`);
    }
  }

  for (const [dependencyName, dependencyVersion] of Object.entries(dependencies)) {
    const internalDependencyName = getInternalPackageName(dependencyName);

    if (internalDependencyName === undefined) {
      continue;
    }

    if (!manifests.has(internalDependencyName)) {
      errors.push(`${packageName} declares unknown internal dependency ${internalDependencyName}`);
      continue;
    }

    if (!allowed.has(internalDependencyName)) {
      errors.push(
        `${packageName} declares ${internalDependencyName} but does not allow it in wumingBoundary`,
      );
    }

    if (dependencyVersion !== "workspace:0.0.0") {
      errors.push(`${packageName} must declare ${internalDependencyName} as workspace:0.0.0`);
    }
  }

  for (const filePath of sourceFiles) {
    const sourceText = await readFile(filePath, "utf8");
    const specifiers = readModuleSpecifiers(filePath, sourceText);

    for (const specifier of specifiers) {
      const importedPackageName = getInternalPackageName(specifier);

      if (importedPackageName === undefined || importedPackageName === packageName) {
        continue;
      }

      if (specifier !== importedPackageName) {
        errors.push(`${path.relative(root, filePath)} deep imports ${specifier}`);
      }

      if (!manifests.has(importedPackageName)) {
        errors.push(`${path.relative(root, filePath)} imports unknown ${importedPackageName}`);
        continue;
      }

      if (!allowed.has(importedPackageName)) {
        errors.push(`${packageName} is not allowed to depend on ${importedPackageName}`);
      }

      if (dependencies[importedPackageName] !== "workspace:0.0.0") {
        errors.push(`${packageName} must declare ${importedPackageName} as workspace:0.0.0`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Package boundary check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Package boundary check passed for ${expectedPackages.length} workspaces.`);
}
