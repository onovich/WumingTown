import { spawnSync } from "node:child_process";
import { access, cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = fileURLToPath(new URL(".", import.meta.url));
const DIST_ROOT = path.join(APP_ROOT, "..", "..", "dist", "desktop");
const OUTPUT_DIR = path.join(DIST_ROOT, "win-unpacked");
const APP_BUNDLE_DIR = path.join(OUTPUT_DIR, "resources", "app");
const EXE_NAME = "WumingTown.exe";
const CACHE_ROOT = path.join(DIST_ROOT, ".cache");
const require = createRequire(import.meta.url);

if (process.platform !== "win32") {
  throw new Error("desktop package-dir currently supports only win32 packaging.");
}

const ELECTRON_VERSION = await readPinnedElectronVersion();
const ELECTRON_ZIP_BASENAME = `electron-v${ELECTRON_VERSION}-win32-x64.zip`;
const ELECTRON_ZIP_PATH = path.join(CACHE_ROOT, ELECTRON_ZIP_BASENAME);
const ELECTRON_EXTRACT_DIR = path.join(CACHE_ROOT, `electron-v${ELECTRON_VERSION}-win32-x64`);
const ELECTRON_DOWNLOAD_URL = `https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/${ELECTRON_ZIP_BASENAME}`;
const ELECTRON_DIST_DIR = await resolveElectronDistDir();

await access(ELECTRON_DIST_DIR);
await access(path.join(APP_ROOT, "dist", "main", "main.js"));
await access(path.join(APP_ROOT, "dist", "renderer", "index.html"));

await rm(OUTPUT_DIR, {
  force: true,
  recursive: true,
});
await cp(ELECTRON_DIST_DIR, OUTPUT_DIR, {
  recursive: true,
});

await rename(path.join(OUTPUT_DIR, "electron.exe"), path.join(OUTPUT_DIR, EXE_NAME));
await mkdir(path.join(APP_BUNDLE_DIR, "dist"), {
  recursive: true,
});
await mkdir(path.join(APP_BUNDLE_DIR, "src"), {
  recursive: true,
});
await cp(path.join(APP_ROOT, "dist", "main"), path.join(APP_BUNDLE_DIR, "dist", "main"), {
  recursive: true,
});
await cp(path.join(APP_ROOT, "dist", "renderer"), path.join(APP_BUNDLE_DIR, "dist", "renderer"), {
  recursive: true,
});
await cp(
  path.join(APP_ROOT, "src", "preload.cjs"),
  path.join(APP_BUNDLE_DIR, "src", "preload.cjs"),
);

await writeFile(
  path.join(APP_BUNDLE_DIR, "package.json"),
  `${JSON.stringify(
    {
      main: "dist/main/main.js",
      name: "@wuming-town/desktop-electron",
      private: true,
      productName: "WumingTown",
      type: "module",
      version: "0.0.0",
    },
    null,
    2,
  )}\n`,
  "utf8",
);

async function readPinnedElectronVersion(): Promise<string> {
  const manifestText = await readFile(path.join(APP_ROOT, "package.json"), "utf8");
  const manifest: unknown = JSON.parse(manifestText);
  if (!isRecord(manifest)) {
    throw new Error("apps/desktop-electron/package.json must parse to an object.");
  }

  const version = readPinnedElectronVersionFromManifest(manifest);
  if (typeof version !== "string" || version.length === 0) {
    throw new Error("apps/desktop-electron/package.json must pin an electron devDependency.");
  }

  return version;
}

async function resolveElectronDistDir(): Promise<string> {
  const installedExecutablePath = tryReadInstalledElectronExecutablePath();
  if (installedExecutablePath !== undefined) {
    const installedDistDir = path.dirname(installedExecutablePath);
    try {
      await access(path.join(installedDistDir, "electron.exe"));
      return installedDistDir;
    } catch {
      // Fall through to the cached download path.
    }
  }

  await mkdir(CACHE_ROOT, {
    recursive: true,
  });
  await ensureElectronZipDownloaded();
  await rm(ELECTRON_EXTRACT_DIR, {
    force: true,
    recursive: true,
  });
  runProcess("powershell", [
    "-NoProfile",
    "-Command",
    `Expand-Archive -LiteralPath '${ELECTRON_ZIP_PATH}' -DestinationPath '${ELECTRON_EXTRACT_DIR}' -Force`,
  ]);
  await access(path.join(ELECTRON_EXTRACT_DIR, "electron.exe"));
  return ELECTRON_EXTRACT_DIR;
}

async function ensureElectronZipDownloaded(): Promise<void> {
  try {
    await access(ELECTRON_ZIP_PATH);
    return;
  } catch {
    // Download into the local cache when the zip is not present yet.
  }

  runProcess("curl.exe", ["-L", "--fail", "--output", ELECTRON_ZIP_PATH, ELECTRON_DOWNLOAD_URL]);
}

function runProcess(command: string, args: readonly string[]): void {
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${String(result.status)}`);
  }
}

function tryReadInstalledElectronExecutablePath(): string | undefined {
  try {
    const electronPath: unknown = require("electron");
    if (typeof electronPath === "string") {
      return electronPath;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPinnedElectronVersionFromManifest(
  manifest: Record<string, unknown>,
): string | undefined {
  const devDependencies = manifest["devDependencies"];
  if (!isRecord(devDependencies)) {
    return undefined;
  }

  const version = devDependencies["electron"];
  if (typeof version !== "string") {
    return undefined;
  }

  return version;
}
