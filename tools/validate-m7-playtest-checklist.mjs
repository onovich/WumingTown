import { readFile } from "node:fs/promises";

const CHECKLIST_PATH = new URL(
  "../docs/07_roadmap/08_m7_playtest_checklist_protocol.md",
  import.meta.url,
);

const requiredSnippets = [
  "Status: WM-0108 M7 preparation artifact.",
  "Web remains `demo-only`.",
  "Windows remains unsigned `ready-for-controlled-external-test`.",
  "M5 final world/read-model hashes: `0xfba70a5c` / `0x9ba83cb7`.",
  "No public recruitment",
  "No public release",
  "No store submission",
  "No signing, installer or updater",
  "No telemetry, analytics, account service, paid service, crash upload or hosted feedback",
  "Windows host-side diagnostic package writing remains blocked",
  "Windows/Web save-container interoperability remains blocked",
  "Public save compatibility is not promised",
  "Do not collect secrets, tokens, passwords, cookies, private keys, payment data or unrelated private paths.",
  "Do not collect full save files unless a later reviewed data-handling task explicitly permits it.",
  "Do not describe Wuming Town as authentic folklore",
  "M8 remains unstarted",
];

const checklistText = await readFile(CHECKLIST_PATH, "utf8");
const missing = [];

for (const snippet of requiredSnippets) {
  if (!checklistText.includes(snippet)) {
    missing.push(snippet);
  }
}

if (missing.length > 0) {
  console.error("M7 playtest checklist validation failed. Missing required snippets:");
  for (const snippet of missing) {
    console.error(`- ${snippet}`);
  }
  process.exitCode = 1;
} else {
  console.log(`M7 playtest checklist validation passed: ${requiredSnippets.length} snippets.`);
}
