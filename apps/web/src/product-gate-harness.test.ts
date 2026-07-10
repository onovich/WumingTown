import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import * as ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  WEB_PRODUCT_GATE_READ_MODEL,
  readWebProductGateActiveEntityCount,
} from "./product-gate-fixture";
import { WEB_PRODUCT_GATE_HARNESS, createShellReleaseGateInfo } from "./product-gate-harness";

describe("web product gate harness", () => {
  it("pins the reviewed M5 and M4 evidence basis", () => {
    expect(WEB_PRODUCT_GATE_HARNESS.primaryEvidence).toMatchObject({
      taskId: "WM-0083",
      scenarioId: "m5.alpha_content_framework.first_season.v1",
      contentHash: "0xe55d3015",
      finalReadModelHash: "0x9ba83cb7",
    });
    expect(WEB_PRODUCT_GATE_HARNESS.regressionEvidence).toMatchObject({
      taskId: "WM-0067",
      scenarioId: "m4.core_vertical_slice.borrowed_shadow_lamps.v1",
      finalReadModelHash: "0xce261d9d",
    });
  });

  it("uses the reviewed Web gate map scale and active-actor fixture size", () => {
    expect(WEB_PRODUCT_GATE_READ_MODEL.mapWidth).toBe(192);
    expect(WEB_PRODUCT_GATE_READ_MODEL.mapHeight).toBe(192);
    expect(readWebProductGateActiveEntityCount()).toBe(40);
    expect(WEB_PRODUCT_GATE_HARNESS.targetTotalEntities).toBe(20000);
  });

  it("exposes browser, build and isolation assumptions without changing authority", () => {
    const info = createShellReleaseGateInfo({
      browserLabel: "Chrome-family browser",
      crossOriginIsolated: false,
    });

    expect(info.fixtureId).toBe("wm-0086-web-product-gate");
    expect(info.browserTargets).toContain("Chrome Stable");
    expect(info.browserTargets).toContain("Edge Stable");
    expect(info.sections.some((section) => section.value.includes("150 MB"))).toBe(true);
    expect(info.sections.some((section) => section.detail.includes("Transferable snapshot"))).toBe(
      true,
    );
    expect(info.sections.some((section) => section.detail.includes("Worker or headless"))).toBe(
      true,
    );
  });

  it("quarantines non-gameplay sources and APIs through the semantic default graph", () => {
    const graph = readDefaultGameplayGraph("shell-bootstrap.ts");
    const graphFileNames = [...graph.files].map((file) => path.basename(file));

    expect(graphFileNames).not.toEqual(
      expect.arrayContaining([
        "product-gate-fixture.ts",
        "reviewed-playable-session.ts",
        "smoke-read-model.ts",
      ]),
    );
    expect([...graph.sessionApiImports].sort()).toStrictEqual(
      [
        "createWebSimulationWorkerSession",
        "readWebGameSessionRenderProjection",
        "readWebGameSessionUiProjection",
        "startWebGameSession",
      ].sort(),
    );
    expect(graph.diagnosticsOnlyDynamicEdges).toStrictEqual([
      "shell-bootstrap.ts -> product-gate-harness.ts",
      "shell-bootstrap.ts -> web-storage-gate.ts",
    ]);
    for (const packageImport of graph.packageImports) {
      expect(packageImport.specifier, packageImport.from).not.toBe("@wuming-town/sim-core");
      expect(packageImport.specifier, packageImport.from).not.toContain("/src/");
      if (packageImport.specifier.startsWith("@wuming-town/")) {
        expect(packageImport.specifier.split("/")).toHaveLength(2);
      }
    }
    expect(readCalledPropertyReceivers("web-shell.e2e.test.ts", "dispatchEvent")).toStrictEqual([
      "window",
    ]);
  });
});

interface DefaultGameplayGraph {
  readonly diagnosticsOnlyDynamicEdges: string[];
  readonly files: Set<string>;
  readonly packageImports: { readonly from: string; readonly specifier: string }[];
  readonly sessionApiImports: Set<string>;
}

function readDefaultGameplayGraph(entryFileName: string): DefaultGameplayGraph {
  const graph: DefaultGameplayGraph = {
    diagnosticsOnlyDynamicEdges: [],
    files: new Set<string>(),
    packageImports: [],
    sessionApiImports: new Set<string>(),
  };
  const pending = [path.join(path.dirname(fileURLToPath(import.meta.url)), entryFileName)];
  while (pending.length > 0) {
    const file = pending.pop();
    if (file === undefined || graph.files.has(file)) continue;
    graph.files.add(file);
    const sourceFile = readTypeScriptSource(file);
    collectDynamicImports(sourceFile, graph);
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (isTypeOnlyModuleEdge(statement)) continue;
      const moduleSpecifier = readModuleSpecifier(statement);
      if (moduleSpecifier === undefined) continue;
      if (!moduleSpecifier.startsWith(".")) {
        graph.packageImports.push({ from: path.basename(file), specifier: moduleSpecifier });
        continue;
      }
      const target = resolveLocalModule(file, moduleSpecifier);
      if (path.basename(target) === "simulation-worker-session.ts") {
        collectImportedSymbols(statement, graph.sessionApiImports);
      }
      pending.push(target);
    }
  }
  graph.diagnosticsOnlyDynamicEdges.sort();
  return graph;
}

function isTypeOnlyModuleEdge(statement: ts.ImportDeclaration | ts.ExportDeclaration): boolean {
  return ts.isImportDeclaration(statement)
    ? statement.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword
    : statement.isTypeOnly;
}

function readTypeScriptSource(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function readModuleSpecifier(
  statement: ts.ImportDeclaration | ts.ExportDeclaration,
): string | undefined {
  return statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)
    ? statement.moduleSpecifier.text
    : undefined;
}

function resolveLocalModule(containingFile: string, specifier: string): string {
  const base = path.resolve(path.dirname(containingFile), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Unable to resolve ${specifier} from ${containingFile}.`);
}

function collectImportedSymbols(
  statement: ts.ImportDeclaration | ts.ExportDeclaration,
  output: Set<string>,
): void {
  if (ts.isImportDeclaration(statement)) {
    const clause = statement.importClause;
    if (clause?.name !== undefined) output.add("<default>");
    if (clause?.namedBindings !== undefined) {
      if (ts.isNamespaceImport(clause.namedBindings)) output.add("<namespace>");
      else {
        for (const element of clause.namedBindings.elements) {
          output.add(element.propertyName?.text ?? element.name.text);
        }
      }
    }
    return;
  }
  if (statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause)) {
    for (const element of statement.exportClause.elements) {
      output.add(element.propertyName?.text ?? element.name.text);
    }
  } else {
    output.add("<namespace>");
  }
}

function collectDynamicImports(sourceFile: ts.SourceFile, graph: DefaultGameplayGraph): void {
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1
    ) {
      const argument = node.arguments[0];
      if (argument !== undefined && ts.isStringLiteral(argument) && argument.text.startsWith(".")) {
        const target = resolveLocalModule(sourceFile.fileName, argument.text);
        if (!isGuardedByDiagnosticsVisibility(node)) {
          throw new Error(`Dynamic gameplay import is not diagnostics-guarded: ${target}`);
        }
        graph.diagnosticsOnlyDynamicEdges.push(
          `${path.basename(sourceFile.fileName)} -> ${path.basename(target)}`,
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function isGuardedByDiagnosticsVisibility(node: ts.Node): boolean {
  let current = node.parent;
  for (;;) {
    if (
      ts.isIfStatement(current) &&
      node.pos >= current.thenStatement.pos &&
      node.end <= current.thenStatement.end &&
      containsIdentifier(current.expression, "diagnosticsVisible")
    ) {
      return true;
    }
    if (ts.isSourceFile(current)) return false;
    current = current.parent;
  }
}

function containsIdentifier(node: ts.Node, name: string): boolean {
  let found = false;
  function visit(current: ts.Node): void {
    if (ts.isIdentifier(current) && current.text === name) found = true;
    if (!found) ts.forEachChild(current, visit);
  }
  visit(node);
  return found;
}

function readCalledPropertyReceivers(fileName: string, methodName: string): readonly string[] {
  const sourceFile = readTypeScriptSource(
    path.join(path.dirname(fileURLToPath(import.meta.url)), fileName),
  );
  const receivers: string[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === methodName
    ) {
      receivers.push(node.expression.expression.getText(sourceFile));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return receivers;
}
