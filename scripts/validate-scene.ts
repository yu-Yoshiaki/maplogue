// scene.json のスキーマ検証 CLI。監視セッションが編集後に必ず実行する。
// 使い方: npm run validate:scene  （tsx scripts/validate-scene.ts [path]）

import { readFileSync } from "node:fs";
import { validateScene } from "../src/scene/validateScene";

const target = process.argv[2] ?? "data/scene.json";

let parsed: unknown;
try {
  parsed = JSON.parse(readFileSync(target, "utf8"));
} catch (error) {
  console.error(`NG: ${target} は JSON として不正です: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const errors = validateScene(parsed);
if (errors.length > 0) {
  console.error(`NG: ${target} はスキーマ違反です:`);
  for (const message of errors) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}

console.log(`OK: ${target} は妥当な scene です`);
