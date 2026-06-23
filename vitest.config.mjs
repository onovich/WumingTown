import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const fromRoot = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@wuming-town/benchmarks": fromRoot("./packages/benchmarks/src/index.ts"),
      "@wuming-town/content-cli": fromRoot("./tools/content-cli/src/index.ts"),
      "@wuming-town/content-compiler": fromRoot("./packages/content-compiler/src/index.ts"),
      "@wuming-town/content-schema": fromRoot("./packages/content-schema/src/index.ts"),
      "@wuming-town/desktop-electron": fromRoot("./apps/desktop-electron/src/index.ts"),
      "@wuming-town/foundation": fromRoot("./packages/foundation/src/index.ts"),
      "@wuming-town/headless-runner": fromRoot("./tools/headless-runner/src/index.ts"),
      "@wuming-town/persistence": fromRoot("./packages/persistence/src/index.ts"),
      "@wuming-town/platform": fromRoot("./packages/platform/src/index.ts"),
      "@wuming-town/renderer-pixi": fromRoot("./packages/renderer-pixi/src/index.ts"),
      "@wuming-town/sim-core": fromRoot("./packages/sim-core/src/index.ts"),
      "@wuming-town/sim-protocol": fromRoot("./packages/sim-protocol/src/index.ts"),
      "@wuming-town/sim-worker": fromRoot("./packages/sim-worker/src/index.ts"),
      "@wuming-town/testkit": fromRoot("./packages/testkit/src/index.ts"),
      "@wuming-town/ui-react": fromRoot("./packages/ui-react/src/index.ts"),
      "@wuming-town/web": fromRoot("./apps/web/src/index.ts"),
    },
  },
  test: {
    include: ["{apps,packages,tools}/*/src/**/*.test.ts"],
    passWithNoTests: false,
  },
});
