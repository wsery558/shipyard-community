import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TEST_DIR = path.join(ROOT, "test");

if (!fs.existsSync(TEST_DIR)) {
  console.warn("⚠️  No ./test directory in open snapshot. Skipping smoke discovery.");
  process.exit(0);
}

const files = fs.readdirSync(TEST_DIR).filter(f => /smoke/i.test(f));
if (!files.length) {
  console.warn("⚠️  No smoke tests found under ./test (filename contains 'smoke'). Skipping.");
  process.exit(0);
}

console.log("✅ Smoke tests present:", files.join(", "));
process.exit(0);
