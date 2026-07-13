import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const LEDGER_SOURCE_SUFFIX = "/packages/sim-core/src/reservation-ledger.ts";
const ROOT_METHODS = ["releaseClaimsInto", "readActiveClaimsInto"] as const;
const BROAD_OR_MATERIALIZING_CALLS = new Set([
  "acquire",
  "acquireInto",
  "createMetrics",
  "createRecordSnapshot",
  "createRecordView",
  "createSnapshot",
  "readRecord",
  "releaseClaims",
  "releaseReservationsForEntity",
  "releaseReservationsForOwnerJob",
]);
const FORBIDDEN_PROPERTY_CALLS = new Set([
  "concat",
  "filter",
  "flatMap",
  "join",
  "map",
  "reduce",
  "replace",
  "slice",
  "sort",
  "split",
]);

interface AuditContext {
  readonly checker: ts.TypeChecker;
  readonly sourceFile: ts.SourceFile;
  readonly ledgerClass: ts.ClassDeclaration;
}

interface ClosureAuditResult {
  readonly reached: ReadonlySet<string>;
  readonly violations: readonly string[];
}

describe("ReservationLedger exact custody TypeChecker closure", () => {
  it.each(ROOT_METHODS)("proves %s is independently allocation-free", (rootName) => {
    const context = createAuditContext();
    const result = auditMethodClosure(context, rootName);

    expect(result.violations).toEqual([]);
    expect(result.reached.has(`ReservationLedger.${rootName}`)).toBe(true);
    expect(result.reached.has("ReservationLedger.releaseClaimNoVersion")).toBe(
      rootName === "releaseClaimsInto",
    );
    expect(result.reached.has("ReservationLedger.readActiveClaimsInto")).toBe(
      rootName === "readActiveClaimsInto",
    );
    expect(result.reached.has("ReservationLedger.releaseClaimsInto")).toBe(
      rootName === "releaseClaimsInto",
    );
  });

  it("rejects a same-source foreign same-name receiver through the formal auditor", () => {
    const context = createSyntheticAuditContext(`
      class ForeignLedger { releaseClaimNoVersion(claimId: number): boolean { return claimId >= 0; } }
      class ReservationLedger {
        releaseClaimsInto(receiver: ForeignLedger): void { receiver.releaseClaimNoVersion(1); }
      }
    `);
    const result = auditMethodClosure(context, "releaseClaimsInto");

    expect(result.violations).toContain(
      "ReservationLedger.releaseClaimsInto: foreign project receiver ForeignLedger.releaseClaimNoVersion",
    );
  });

  it("rejects a non-this same-class receiver through the formal auditor", () => {
    const context = createSyntheticAuditContext(`
      class ReservationLedger { releaseClaimsInto(receiver: ReservationLedger): void { receiver.releaseClaimNoVersion(1); } releaseClaimNoVersion(claimId: number): boolean { return claimId >= 0; } }
    `);
    const result = auditMethodClosure(context, "releaseClaimsInto");

    expect(result.violations).toContain(
      "ReservationLedger.releaseClaimsInto: non-this project receiver receiver.releaseClaimNoVersion",
    );
  });

  it("fails an unresolved receiver closed through the formal auditor", () => {
    const context = createSyntheticAuditContext(`
      class ReservationLedger { releaseClaimsInto(receiver: unknown): void { receiver.missing(); } }
    `);
    const result = auditMethodClosure(context, "releaseClaimsInto");

    expect(result.violations).toContain(
      "ReservationLedger.releaseClaimsInto: unresolved call receiver.missing",
    );
  });

  it.each([
    ["new expression", "function root(): void { new Map(); }"],
    ["object literal", "function root(): void { void { value: 1 }; }"],
    ["array literal", "function root(): void { void [1]; }"],
    ["nested closure", "function root(): void { void (() => 1); }"],
    ["for-of", "function root(values: number[]): void { for (const value of values) void value; }"],
    ["unbounded loop", "function root(): void { while (true) break; }"],
    [
      "unreviewed for loop",
      "function root(limit: number): void { for (let i = 0; i < limit; i += 1) void i; }",
    ],
    ["spread", "function root(values: number[]): void { void [...values]; }"],
    ["template string", "function root(value: number): void { void `value ${value}`; }"],
    ["string concatenation", 'function root(value: number): void { void ("value" + value); }'],
    ["materializing call", "function root(values: number[]): void { void values.slice(); }"],
  ] as const)("rejects %s", (_label, source) => {
    const context = createSyntheticContext(source);
    const root = findFunction(context.sourceFile, "root");
    expect(scanForbiddenConstruction(root, context.checker)).toBeDefined();
  });
});

function createAuditContext(): AuditContext {
  const configPath = ts.findConfigFile(
    process.cwd(),
    (fileName): boolean => ts.sys.fileExists(fileName),
    "tsconfig.typecheck.json",
  );
  if (configPath === undefined) throw new Error("missing tsconfig.typecheck.json");
  const loaded = ts.readConfigFile(configPath, (fileName): string | undefined =>
    ts.sys.readFile(fileName),
  );
  if (loaded.error !== undefined) throw new Error(formatDiagnostic(loaded.error));
  const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, process.cwd());
  if (parsed.errors.length > 0) {
    let message = "";
    for (const error of parsed.errors) message += `${formatDiagnostic(error)}\n`;
    throw new Error(message);
  }
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  const sourceFile = program
    .getSourceFiles()
    .find((candidate) => normalizePath(candidate.fileName).endsWith(LEDGER_SOURCE_SUFFIX));
  if (sourceFile === undefined) throw new Error("missing ReservationLedger source file");
  const ledgerClass = sourceFile.statements.find(
    (statement): statement is ts.ClassDeclaration =>
      ts.isClassDeclaration(statement) && statement.name?.text === "ReservationLedger",
  );
  if (ledgerClass === undefined) throw new Error("missing ReservationLedger class");
  return { checker: program.getTypeChecker(), sourceFile, ledgerClass };
}

function auditMethodClosure(context: AuditContext, rootName: string): ClosureAuditResult {
  const root = findMethod(context.ledgerClass, rootName);
  const queue: ts.SignatureDeclaration[] = [root];
  const visited = new Set<ts.SignatureDeclaration>();
  const reached = new Set<string>();
  const violations: string[] = [];
  for (const declaration of queue) {
    if (visited.has(declaration)) continue;
    visited.add(declaration);
    reached.add(declarationLabel(declaration));
    const forbidden = scanForbiddenConstruction(declaration, context.checker);
    if (forbidden !== undefined) violations.push(`${declarationLabel(declaration)}: ${forbidden}`);
    visitCalls(declaration, (call) => {
      const target = context.checker.getResolvedSignature(call)?.getDeclaration();
      if (target === undefined) {
        violations.push(
          `${declarationLabel(declaration)}: unresolved call ${call.expression.getText()}`,
        );
        return;
      }
      const targetSource = target.getSourceFile();
      const targetName = declarationName(target);
      if (targetSource === context.sourceFile) {
        const receiverViolation = projectReceiverViolation(context, call, target);
        if (receiverViolation !== undefined) {
          violations.push(`${declarationLabel(declaration)}: ${receiverViolation}`);
          return;
        }
        if (BROAD_OR_MATERIALIZING_CALLS.has(targetName)) {
          violations.push(`${declarationLabel(declaration)}: broad call ${targetName}`);
          return;
        }
        queue.push(target);
        return;
      }
      if (!targetSource.isDeclarationFile || !isAllowedNativeCall(target)) {
        violations.push(
          `${declarationLabel(declaration)}: foreign receiver ${declarationLabel(target)}`,
        );
      }
    });
  }
  return { reached, violations };
}

function projectReceiverViolation(
  context: AuditContext,
  call: ts.CallExpression,
  target: ts.SignatureDeclaration,
): string | undefined {
  const owner = target.parent;
  if (owner === context.ledgerClass) {
    if (
      !ts.isPropertyAccessExpression(call.expression) ||
      call.expression.expression.kind !== ts.SyntaxKind.ThisKeyword
    ) {
      return `non-this project receiver ${call.expression.getText()}`;
    }
    return undefined;
  }
  if (owner === context.sourceFile && ts.isIdentifier(call.expression)) return undefined;
  return `foreign project receiver ${declarationLabel(target)}`;
}

function scanForbiddenConstruction(
  declaration: ts.SignatureDeclaration,
  checker: ts.TypeChecker,
): string | undefined {
  const body = declarationBody(declaration);
  if (body === undefined) return undefined;
  let found: string | undefined;
  function visit(node: ts.Node): void {
    if (found !== undefined) return;
    found = forbiddenNode(node, checker);
    if (found === undefined) ts.forEachChild(node, visit);
  }
  ts.forEachChild(body, visit);
  return found;
}

function forbiddenNode(node: ts.Node, checker: ts.TypeChecker): string | undefined {
  if (ts.isNewExpression(node)) return "new expression";
  if (ts.isObjectLiteralExpression(node)) return "object literal";
  if (ts.isArrayLiteralExpression(node)) return "array literal";
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return "nested closure";
  if (ts.isClassExpression(node)) return "nested class";
  if (ts.isForOfStatement(node)) return "for-of";
  if (ts.isWhileStatement(node) || ts.isDoStatement(node)) return "unbounded loop";
  if (ts.isForStatement(node) && !isReviewedBoundedFor(node)) return "unreviewed for loop";
  if (ts.isSpreadElement(node) || ts.isSpreadAssignment(node)) return "spread";
  if (ts.isAwaitExpression(node) || ts.isYieldExpression(node)) return "async suspension";
  if (ts.isTemplateExpression(node) || ts.isTaggedTemplateExpression(node)) {
    return "template string";
  }
  if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) return "regular expression";
  if (ts.isCallExpression(node) && isForbiddenCall(node)) return "materializing call";
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = checker.getTypeAtLocation(node.left).flags;
    const right = checker.getTypeAtLocation(node.right).flags;
    if ((left & ts.TypeFlags.StringLike) !== 0 || (right & ts.TypeFlags.StringLike) !== 0) {
      return "string concatenation";
    }
  }
  return undefined;
}

function isReviewedBoundedFor(node: ts.ForStatement): boolean {
  const source = node.getSourceFile();
  const initializer = node.initializer?.getText(source) ?? "";
  const condition = node.condition?.getText(source) ?? "";
  const incrementor = node.incrementor?.getText(source) ?? "";
  if (
    initializer === "let claimIndex = 0" &&
    condition === "claimIndex < claimCount" &&
    incrementor === "claimIndex += 1"
  ) {
    return true;
  }
  if (
    initializer === "let claimIndex = claimCount - 1" &&
    condition === "claimIndex >= 0" &&
    incrementor === "claimIndex -= 1"
  ) {
    return true;
  }
  return (
    initializer === "let priorIndex = 0" &&
    condition === "priorIndex < claimIndex" &&
    incrementor === "priorIndex += 1"
  );
}

function isForbiddenCall(call: ts.CallExpression): boolean {
  if (!ts.isPropertyAccessExpression(call.expression)) return false;
  return FORBIDDEN_PROPERTY_CALLS.has(call.expression.name.text);
}

function visitCalls(node: ts.Node, visit: (call: ts.CallExpression) => void): void {
  function walk(child: ts.Node): void {
    if (ts.isCallExpression(child)) visit(child);
    ts.forEachChild(child, walk);
  }
  const body = ts.isFunctionLike(node) ? declarationBody(node) : undefined;
  if (body !== undefined) ts.forEachChild(body, walk);
}

function isAllowedNativeCall(declaration: ts.SignatureDeclaration): boolean {
  const name = declarationName(declaration);
  const owner = declarationOwnerName(declaration);
  if (owner === "Map") return name === "get" || name === "set" || name === "delete";
  if (owner === "NumberConstructor") return name === "isSafeInteger";
  if (name !== "fill") return false;
  return owner === "Uint8Array" || owner === "Uint32Array" || owner === "Float64Array";
}

function declarationLabel(declaration: ts.Declaration): string {
  const owner = declarationOwnerName(declaration);
  const name = declarationName(declaration);
  return owner === undefined ? name : `${owner}.${name}`;
}

function declarationOwnerName(declaration: ts.Declaration): string | undefined {
  const parent = declaration.parent;
  if (!ts.isClassDeclaration(parent) && !ts.isInterfaceDeclaration(parent)) return undefined;
  return parent.name?.text;
}

function declarationName(declaration: ts.Declaration): string {
  const name = ts.getNameOfDeclaration(declaration);
  if (name !== undefined) return name.getText(declaration.getSourceFile()).replaceAll('"', "");
  return "<anonymous>";
}

function declarationBody(declaration: ts.SignatureDeclaration): ts.ConciseBody | undefined {
  if (
    ts.isMethodDeclaration(declaration) ||
    ts.isFunctionDeclaration(declaration) ||
    ts.isFunctionExpression(declaration) ||
    ts.isArrowFunction(declaration) ||
    ts.isConstructorDeclaration(declaration) ||
    ts.isGetAccessorDeclaration(declaration) ||
    ts.isSetAccessorDeclaration(declaration)
  ) {
    return declaration.body;
  }
  return undefined;
}

function findMethod(owner: ts.ClassDeclaration, name: string): ts.MethodDeclaration {
  const method = owner.members.find(
    (member): member is ts.MethodDeclaration =>
      ts.isMethodDeclaration(member) && member.name.getText() === name,
  );
  if (method === undefined) throw new Error(`missing ReservationLedger.${name}`);
  return method;
}

function findFunction(sourceFile: ts.SourceFile, name: string): ts.FunctionDeclaration {
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  if (declaration === undefined) throw new Error(`missing function ${name}`);
  return declaration;
}

function createSyntheticContext(source: string): {
  readonly checker: ts.TypeChecker;
  readonly sourceFile: ts.SourceFile;
} {
  const fileName = `${process.cwd()}/reservation-ledger-closure-fixture.ts`;
  const options: ts.CompilerOptions = { strict: true, target: ts.ScriptTarget.ES2022 };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (
    requested,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ): ts.SourceFile | undefined =>
    normalizePath(requested) === normalizePath(fileName)
      ? ts.createSourceFile(fileName, source, languageVersion, true, ts.ScriptKind.TS)
      : originalGetSourceFile(requested, languageVersion, onError, shouldCreateNewSourceFile);
  host.fileExists = (requested): boolean =>
    normalizePath(requested) === normalizePath(fileName) || ts.sys.fileExists(requested);
  host.readFile = (requested): string | undefined =>
    normalizePath(requested) === normalizePath(fileName) ? source : ts.sys.readFile(requested);
  const program = ts.createProgram({ rootNames: [fileName], options, host });
  const sourceFile = program.getSourceFile(fileName);
  if (sourceFile === undefined) throw new Error("missing synthetic source");
  return { checker: program.getTypeChecker(), sourceFile };
}

function createSyntheticAuditContext(source: string): AuditContext {
  const context = createSyntheticContext(source);
  const ledgerClass = context.sourceFile.statements.find(
    (statement): statement is ts.ClassDeclaration =>
      ts.isClassDeclaration(statement) && statement.name?.text === "ReservationLedger",
  );
  if (ledgerClass === undefined) throw new Error("missing synthetic ReservationLedger class");
  return { ...context, ledgerClass };
}

function formatDiagnostic(diagnostic: ts.Diagnostic): string {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
}

function normalizePath(fileName: string): string {
  return fileName.replaceAll("\\", "/");
}
