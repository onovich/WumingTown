#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const failures = [];
const required = [
  "README.md",
  "CODEX_START_HERE.md",
  "AGENTS.md",
  "PLANS.md",
  "project-manifest.json",
  "coordination/roles.json",
  "coordination/project-state.json",
  ".agents/skills/wuming-town-agent-workflow/SKILL.md",
  "docs/01_design/01_game_program_design.md",
  "docs/05_tech/01_technical_architecture.md",
  "docs/06_engineering/00_coding_standard.md",
  "docs/07_roadmap/00_roadmap.md",
];
for (const rel of required)
  if (!fs.existsSync(path.join(root, rel))) failures.push(`missing required file: ${rel}`);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist"].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
const files = walk(root);
for (const file of files.filter((f) => f.endsWith(".json"))) {
  try {
    JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    failures.push(`invalid JSON ${path.relative(root, file)}: ${e.message}`);
  }
}
const linkPattern = /\[[^\]]*\]\((?!https?:|mailto:|#)([^)]+)\)/g;
for (const file of files.filter((f) => f.endsWith(".md"))) {
  const text = fs.readFileSync(file, "utf8");
  let match;
  while ((match = linkPattern.exec(text))) {
    const raw = match[1].split("#")[0].trim();
    if (!raw || raw.startsWith("<")) continue;
    const target = path.resolve(path.dirname(file), decodeURIComponent(raw));
    if (!fs.existsSync(target))
      failures.push(`broken relative link in ${path.relative(root, file)} -> ${raw}`);
  }
}
const taskFiles = fs
  .readdirSync(path.join(root, "coordination/tasks"))
  .filter((f) => f.endsWith(".json"));
if (taskFiles.length < 10)
  failures.push(`expected at least 10 initial tasks, found ${taskFiles.length}`);
const roleData = JSON.parse(fs.readFileSync(path.join(root, "coordination/roles.json"), "utf8"));
if (!roleData.roles?.some((r) => r.id === "reviewer" && r.write === false))
  failures.push("reviewer role must be read-only");
if (!roleData.roles?.some((r) => r.id === "project-director"))
  failures.push("project-director role missing");
const config = fs.readFileSync(path.join(root, ".codex/config.toml"), "utf8");
if (!config.includes("max_threads = 6") || !config.includes("max_depth = 1"))
  failures.push("Codex concurrency guardrails missing");

if (failures.length) {
  console.error(`Handoff validation failed (${failures.length}):`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(2);
}
const digest = crypto
  .createHash("sha256")
  .update(
    files
      .sort()
      .map((f) => `${path.relative(root, f)}\0${fs.statSync(f).size}`)
      .join("\n"),
  )
  .digest("hex");
console.log(
  `Handoff validation passed: ${files.length} files, ${taskFiles.length} tasks, ${roleData.roles.length} roles.`,
);
console.log(`Structure digest: ${digest}`);
