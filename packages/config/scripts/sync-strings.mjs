#!/usr/bin/env node
/**
 * Syncs PROTEGO i18n strings into packages/config.
 *
 * Source of truth (design handoff, not to be edited by hand):
 *   design/PROTEGO mobile safety system design/design/strings.ro.json
 *   design/PROTEGO mobile safety system design/design/strings.en.json
 *
 * Outputs (generated, not to be edited by hand):
 *   packages/config/src/i18n/strings.ro.json
 *   packages/config/src/i18n/strings.en.json
 *
 * Run: pnpm --filter @protego/config run strings:sync
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

const DESIGN_DIR = path.join(
  repoRoot,
  "design",
  "PROTEGO mobile safety system design",
  "design"
);

const OUT_DIR = path.join(__dirname, "..", "src", "i18n");
mkdirSync(OUT_DIR, { recursive: true });

for (const lang of ["ro", "en"]) {
  const src = path.join(DESIGN_DIR, `strings.${lang}.json`);
  const dest = path.join(OUT_DIR, `strings.${lang}.json`);
  const content = JSON.parse(readFileSync(src, "utf8"));
  writeFileSync(dest, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  console.log(`Synced ${dest}`);
}
