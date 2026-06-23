import {
  compileContentFixtureByName,
  formatCompilationFailure,
} from "@wuming-town/content-compiler";
import { CONTENT_COMPILER_SMOKE } from "@wuming-town/content-compiler";
import { CONTENT_SCHEMA_SMOKE } from "@wuming-town/content-schema";
import { defineWorkspaceSmoke, type WorkspaceSmoke } from "@wuming-town/foundation";

export const CONTENT_CLI_SMOKE: WorkspaceSmoke = defineWorkspaceSmoke(
  "@wuming-town/content-cli",
  "tool",
);

export const CONTENT_CLI_PUBLIC_DEPENDENCIES: readonly string[] = [
  CONTENT_COMPILER_SMOKE.packageName,
  CONTENT_SCHEMA_SMOKE.packageName,
];

export interface ContentCliOptions {
  readonly fixtureName: string;
}

export function parseContentCliOptions(argv: readonly string[]): ContentCliResultOptions {
  let fixtureName: string | undefined;
  let index = 0;

  while (index < argv.length) {
    const arg = argv[index];

    if (arg === "--fixture") {
      const value = argv[index + 1];
      if (value === undefined || value.length === 0) {
        return failedOptions("--fixture requires a non-empty value");
      }
      fixtureName = value;
      index += 2;
      continue;
    }

    return failedOptions(`unsupported argument: ${arg ?? ""}`);
  }

  if (fixtureName === undefined) {
    return failedOptions("--fixture is required");
  }

  return {
    ok: true,
    options: {
      fixtureName,
    },
  };
}

export async function runContentCli(argv: readonly string[], io: ContentCliIo): Promise<number> {
  const parsed = parseContentCliOptions(argv);
  if (!parsed.ok) {
    io.writeError(parsed.error);
    return 1;
  }

  const result = await compileContentFixtureByName(parsed.options.fixtureName);
  if (!result.ok || result.catalog === undefined) {
    io.writeError(formatCompilationFailure(result.diagnostics));
    return 1;
  }

  io.writeLine(JSON.stringify(result.catalog, undefined, 2));
  return 0;
}

export interface ContentCliIo {
  writeLine(line: string): void;
  writeError(line: string): void;
}

type ContentCliResultOptions =
  | {
      readonly ok: true;
      readonly options: ContentCliOptions;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

function failedOptions(error: string): ContentCliResultOptions {
  return {
    ok: false,
    error,
  };
}
