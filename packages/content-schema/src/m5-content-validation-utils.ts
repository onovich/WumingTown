import type { ContentSourceLocation } from "./content-fixtures";

export function fileLocation(filePath: string): ContentSourceLocation {
  return {
    filePath,
    line: 1,
    column: 1,
  };
}

export function fieldLocation(filePath: string): ContentSourceLocation {
  return {
    filePath,
    line: 1,
    column: 1,
  };
}

export function rootLocation(rootDir: string): ContentSourceLocation {
  return {
    filePath: rootDir,
    line: 1,
    column: 1,
  };
}

export function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseContentDocument(
  filePath: string,
  text: string,
): { readonly ok: true; readonly json: unknown } | { readonly ok: false; readonly error: string } {
  try {
    if (filePath.endsWith(".json5")) {
      return {
        ok: true,
        json: JSON.parse(stripJson5ToJson(text)),
      };
    }
    return {
      ok: true,
      json: JSON.parse(text),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse failure";
    return {
      ok: false,
      error: message,
    };
  }
}

function stripJson5ToJson(text: string): string {
  let output = "";
  let inString = false;
  let quote = "";
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    const next = text[index + 1] ?? "";

    if (inLineComment) {
      if (char === "\n" || char === "\r") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === "'" || char === '"') {
      inString = true;
      quote = char;
      output += char === "'" ? '"' : char;
      continue;
    }

    output += char;
  }

  return removeTrailingJsonCommas(quoteJson5Keys(output));
}

function removeTrailingJsonCommas(text: string): string {
  let output = "";
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      output += char;
      continue;
    }

    if (char === ",") {
      const next = nextNonWhitespace(text, index + 1);
      if (next === "}" || next === "]") {
        continue;
      }
    }

    output += char;
  }

  return output;
}

function nextNonWhitespace(text: string, offset: number): string | undefined {
  for (let index = offset; index < text.length; index += 1) {
    const char = text[index];
    if (char !== undefined && !isWhitespace(char)) {
      return char;
    }
  }
  return undefined;
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\n" || char === "\r" || char === "\t";
}

function quoteJson5Keys(text: string): string {
  return text.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)/g, '$1"$2"$3');
}

export function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
