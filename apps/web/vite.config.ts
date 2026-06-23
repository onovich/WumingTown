import { defineConfig } from "vite";

const webViteConfig = defineConfig({
  base: "./",
  build: {
    emptyOutDir: true,
    outDir: "../desktop-electron/dist/renderer",
    sourcemap: true,
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});

export { webViteConfig as default };
