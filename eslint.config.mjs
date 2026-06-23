import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const nodeGlobals = {
  Buffer: "readonly",
  URL: "readonly",
  console: "readonly",
  process: "readonly",
};

const tsOnly = (configs) =>
  configs.map((config) => ({
    ...config,
    files: ["**/*.ts"],
  }));

export default tseslint.config(
  {
    ignores: [
      ".agents/**",
      "node_modules/**",
      "**/dist/**",
      "dist/**",
      "coverage/**",
      "docs/*.zip",
      "pnpm-lock.yaml",
      "**/*.sha256",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: nodeGlobals,
      sourceType: "module",
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...nodeGlobals,
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
      },
      sourceType: "commonjs",
    },
  },
  ...tsOnly(tseslint.configs.strictTypeChecked),
  ...tsOnly(tseslint.configs.stylisticTypeChecked),
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "never",
        },
      ],
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: false,
        },
      ],
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message: "Use named exports for package public APIs.",
        },
      ],
    },
  },
  {
    files: ["packages/sim-core/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "node:*",
            "electron",
            "fs",
            "node:fs",
            "path",
            "node:path",
            "pixi.js",
            "react",
            "react-dom",
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "Simulation core randomness must use injected deterministic streams.",
        },
        {
          object: "Date",
          property: "now",
          message: "Simulation core time must come from explicit tick context.",
        },
        {
          object: "performance",
          property: "now",
          message: "Simulation core time must come from explicit tick context.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message: "Use named exports for package public APIs.",
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.type='Identifier'][callee.property.name=/^(map|filter|reduce|flatMap)$/]",
          message: "Avoid allocation-heavy array callbacks in sim-core hot paths.",
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.type='Identifier'][callee.property.name='sort']",
          message: "Simulation sorting requires explicit bounded design and tie-breakers.",
        },
      ],
    },
  },
  prettier,
);
