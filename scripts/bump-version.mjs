// Naikkan versi di package.json. Dipakai hanya saat push ke main (SPEC bagian 14).
// Pemakaian: npm run version:bump -- [minor|major]   (default: minor)
import { readFileSync, writeFileSync } from "node:fs";

const kind = process.argv[2] ?? "minor";
if (!["minor", "major"].includes(kind)) {
  console.error("Jenis harus 'minor' atau 'major'.");
  process.exit(1);
}
const file = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(readFileSync(file, "utf8"));
const m = /^(\d+)\.(\d+)/.exec(pkg.version);
if (!m) throw new Error(`Versi tidak valid: ${pkg.version}`);
const [major, minor] = [Number(m[1]), Number(m[2])];
const next = kind === "major" ? `${major + 1}.0` : `${major}.${minor + 1}`;
pkg.version = `${next}.0`;
writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
console.log(`Versi: ${major}.${minor} -> ${next} (${kind})`);
