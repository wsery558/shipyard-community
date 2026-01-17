import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = [
  path.join(ROOT, "packages", "open-core"),
  path.join(ROOT, "apps"),
  path.join(ROOT, "src"),        // include shims
  path.join(ROOT, "server.mjs"), // scan server imports too
];

const FILE_EXT = new Set([".mjs", ".js", ".jsx", ".ts", ".tsx", ".cjs"]);
const importRe = /\bimport\b|\brequire\s*\(|\bimport\s*\(/;

function walk(p, out = []) {
  if (!fs.existsSync(p)) return out;
  const st = fs.statSync(p);
  if (st.isFile()) { out.push(p); return out; }
  for (const name of fs.readdirSync(p)) {
    if (name === "node_modules" || name === ".git") continue;
    walk(path.join(p, name), out);
  }
  return out;
}

function readLines(f) {
  try { return fs.readFileSync(f, "utf8").split(/\r?\n/); }
  catch { return []; }
}

let bad = [];
for (const t of TARGET_DIRS) {
  const files = fs.existsSync(t) && fs.statSync(t).isFile() ? [t] : walk(t);
  for (const f of files) {
    const ext = path.extname(f);
    if (!FILE_EXT.has(ext) && !f.endsWith("server.mjs")) continue;

    const lines = readLines(f);
    lines.forEach((line, i) => {
      const s = line.trim();
      // ignore obvious comment lines
      if (s.startsWith("//") || s.startsWith("*") || s.startsWith("/*")) return;
      if (!importRe.test(s)) return;
      // ONLY flag actual import/require/import() lines
      if (s.includes("paid-platform")) bad.push(`${path.relative(ROOT, f)}:${i + 1}: ${s}`);
    });
  }
}

if (bad.length) {
  console.error("❌ Boundary violation: open surfaces import/require paid-platform:");
  for (const b of bad) console.error(" -", b);
  process.exit(2);
}
console.log("✅ Boundary OK: no import/require/import() of paid-platform found.");
