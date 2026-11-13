/**
 * Membangun katalog font terkurasi (SPEC bagian 6.3).
 *
 *   npm run fonts:build              # bangun yang belum ada, hapus yang tidak lagi di daftar
 *   npm run fonts:build -- --force   # bangun ulang semua
 *   npm run fonts:build -- --only "Lato,Lora"
 *
 * Masukan : data/fonts/families.txt (satu nama family per baris)
 * Keluaran: fonts/lib/<dir>/<Nama>-Regular.ttf, -Bold.ttf, file lisensi
 *           data/fonts/catalog.json (metadata yang dipakai mesin brand)
 *
 * Sumber: repo github.com/google/fonts (file + METADATA.pb) dan metadata fonts.google.com
 * (kategori, popularitas). Variable font dijadikan statis (Regular 400, Bold 700; sumbu lain
 * di nilai default) karena PDFKit dan resvg hanya memakai instance default. Semua file
 * dipangkas ke aksara Latin (rentang "latin" Google Fonts).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import subsetFont from "subset-font";
import * as fontkit from "fontkit";
import type { CatalogFont } from "../lib/brand/fonts";

const ROOT = path.resolve(import.meta.dirname, "..");
const LIST = path.join(ROOT, "data/fonts/families.txt");
const CATALOG = path.join(ROOT, "data/fonts/catalog.json");
const OUT = path.join(ROOT, "fonts/lib");
const RAW = "https://raw.githubusercontent.com/google/fonts/main";
const META_URL = "https://fonts.google.com/metadata/fonts";
const TAGS_URL = `${RAW}/tags/all/families.csv`;

/** Rentang unicode subset "latin" Google Fonts. */
const LATIN: [number, number][] = [
  [0x0000, 0x00ff], [0x0131, 0x0131], [0x0152, 0x0153], [0x02bb, 0x02bc], [0x02c6, 0x02c6],
  [0x02da, 0x02da], [0x02dc, 0x02dc], [0x0304, 0x0304], [0x0308, 0x0308], [0x0329, 0x0329],
  [0x2000, 0x206f], [0x20ac, 0x20ac], [0x2122, 0x2122], [0x2191, 0x2191], [0x2193, 0x2193],
  [0x2212, 0x2212], [0x2215, 0x2215], [0xfeff, 0xfeff], [0xfffd, 0xfffd],
];
const LATIN_TEXT = LATIN.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i))).join("");

/** Huruf yang wajib ada untuk teks Indonesia/Inggris sehari-hari. */
const REQUIRED = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?'\"()-/&@%+=*#";
/** Bagus bila ada (tanda kutip melengkung, tanda pisah, é untuk kata serapan). */
const NICE = "‘’“”–—…é•";

/** Nama folder di google/fonts yang tidak mengikuti aturan umum (huruf kecil tanpa spasi). */
const DIR_ALIAS: Record<string, string> = {};

const HEADING_ONLY = new Set(["Display", "Handwriting"]);

interface MetaFamily {
  family: string;
  category: string;
  stroke: string | null;
  classifications: string[];
  subsets: string[];
  popularity: number;
  designers: string[];
  primaryScript: string;
  isOpenSource: boolean;
}

interface PbFont { style: string; weight: number; filename: string }
interface Pb { license: string; fonts: PbFont[] }


const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(",").map((s) => s.trim())) : null;

async function get(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return r;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) {
      if (attempt >= 4) throw new Error(`${url}: ${(e as Error).message}`);
      await new Promise((res) => setTimeout(res, 500 * 2 ** attempt));
    }
  }
}

function parsePb(text: string): Pb {
  const license = /^license:\s*"([^"]+)"/m.exec(text)?.[1] ?? "";
  const fonts: PbFont[] = [];
  for (const m of text.matchAll(/fonts\s*\{([\s\S]*?)\n\}/g)) {
    const b = m[1];
    fonts.push({
      style: /style:\s*"([^"]+)"/.exec(b)?.[1] ?? "normal",
      weight: Number(/weight:\s*(\d+)/.exec(b)?.[1] ?? 400),
      filename: /filename:\s*"([^"]+)"/.exec(b)?.[1] ?? "",
    });
  }
  return { license, fonts };
}

const fileBase = (family: string) => family.replace(/[^A-Za-z0-9]/g, "");

/** Variable font -> statis pada bobot tertentu; sumbu lain di default. Lalu pangkas ke Latin. */
async function makeStatic(src: Buffer, weight: number | null): Promise<Buffer> {
  const axes = fontkit.create(src).variationAxes ?? {};
  const pin: Record<string, number> = {};
  for (const [tag, a] of Object.entries(axes)) {
    pin[tag] = tag === "wght" && weight != null ? Math.min(a.max, Math.max(a.min, weight)) : a.default;
  }
  return subsetFont(src, LATIN_TEXT, {
    targetFormat: "truetype",
    ...(Object.keys(pin).length ? { variationAxes: pin } : {}),
  });
}

function coverage(buf: Buffer) {
  const f = fontkit.create(buf);
  const has = (ch: string) => f.hasGlyphForCodePoint(ch.codePointAt(0)!);
  return {
    missing: [...REQUIRED].filter((c) => !has(c)).join(""),
    missingNice: [...NICE].filter((c) => !has(c)).join(""),
    family: f.familyName,
  };
}

async function buildFamily(name: string, meta: MetaFamily, tags: Map<string, Record<string, number>>, styleTags: Map<string, string[]>): Promise<CatalogFont> {
  const dir = DIR_ALIAS[name] ?? name.toLowerCase().replace(/[^a-z0-9]/g, "");
  let pb: Pb | null = null;
  let lic = "";
  for (const l of ["ofl", "apache"]) {
    const r = await get(`${RAW}/${l}/${dir}/METADATA.pb`);
    if (r.ok) {
      pb = parsePb(await r.text());
      lic = l;
      break;
    }
  }
  if (!pb) throw new Error(`tidak ditemukan di google/fonts (ofl/ atau apache/${dir}); lisensi UFL tidak dipakai`);
  const license = lic === "ofl" ? "OFL" : "Apache-2.0";
  const licenseFile = lic === "ofl" ? "OFL.txt" : "LICENSE.txt";

  const normal = pb.fonts.filter((f) => f.style === "normal");
  const variable = normal.find((f) => f.filename.includes("["));
  const headingOnly = HEADING_ONLY.has(meta.category);
  const outDir = path.join(OUT, dir);
  const base = fileBase(name);
  const regularPath = path.join(outDir, `${base}-Regular.ttf`);
  const boldPath = path.join(outDir, `${base}-Bold.ttf`);

  const download = async (file: string) => {
    const r = await get(`${RAW}/${lic}/${dir}/${encodeURIComponent(file)}`);
    if (!r.ok) throw new Error(`file ${file} tidak bisa diunduh`);
    return Buffer.from(await r.arrayBuffer());
  };

  let hasBold = false;
  const outputs: [string, Buffer][] = [];
  if (variable) {
    const src = await download(variable.filename);
    const axes = fontkit.create(src).variationAxes;
    const w = axes.wght;
    const regW = w ? Math.min(w.max, Math.max(w.min, 400)) : null;
    outputs.push([regularPath, await makeStatic(src, regW)]);
    if (w && w.min <= 700 && w.max >= 700) {
      outputs.push([boldPath, await makeStatic(src, 700)]);
      hasBold = true;
    }
  } else {
    const byW = new Map(normal.map((f) => [f.weight, f]));
    const reg = byW.get(400) ?? [...byW.values()].sort((a, b) => Math.abs(a.weight - 400) - Math.abs(b.weight - 400))[0];
    if (!reg) throw new Error("tidak ada file style normal");
    outputs.push([regularPath, await makeStatic(await download(reg.filename), null)]);
    const bold = byW.get(700);
    if (bold && bold !== reg) {
      outputs.push([boldPath, await makeStatic(await download(bold.filename), null)]);
      hasBold = true;
    }
  }
  if (!headingOnly && !hasBold) throw new Error("font teks isi wajib punya Regular dan Bold");

  let missingNice = "";
  for (const [p, buf] of outputs) {
    const c = coverage(buf);
    if (c.missing) throw new Error(`${path.basename(p)} tidak punya huruf: ${c.missing}`);
    missingNice += c.missingNice;
  }

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const [p, buf] of outputs) writeFileSync(p, buf);
  const licText = await get(`${RAW}/${lic}/${dir}/${licenseFile}`);
  if (!licText.ok) throw new Error(`file lisensi ${licenseFile} tidak ada`);
  writeFileSync(path.join(outDir, licenseFile), await licText.text());

  return entry(name, dir, meta, tags, styleTags, license, licenseFile, hasBold, [...new Set(missingNice)].join(""));
}

function entry(
  name: string, dir: string, meta: MetaFamily, tags: Map<string, Record<string, number>>, styleTags: Map<string, string[]>,
  license: CatalogFont["license"], licenseFile: string, hasBold: boolean, missingNice: string,
): CatalogFont {
  const base = fileBase(name);
  const outDir = path.join(OUT, dir);
  const files = { regular: `${dir}/${base}-Regular.ttf`, ...(hasBold ? { bold: `${dir}/${base}-Bold.ttf` } : {}) };
  const bytes = readdirSync(outDir).reduce((s, f) => s + statSync(path.join(outDir, f)).size, 0);
  return {
    family: name,
    dir,
    category: meta.category as CatalogFont["category"],
    stroke: meta.stroke,
    styles: styleTags.get(name) ?? [],
    expressive: tags.get(name) ?? {},
    headingOnly: HEADING_ONLY.has(meta.category),
    popularity: meta.popularity,
    designers: meta.designers,
    license,
    licenseFile,
    files,
    bytes,
    missingNice,
    source: `https://github.com/google/fonts/tree/main/${license === "OFL" ? "ofl" : "apache"}/${dir}`,
    specimen: `https://fonts.google.com/specimen/${name.replace(/ /g, "+")}`,
  };
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

async function main() {
  const names = readFileSync(LIST, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  if (dup.length) throw new Error(`nama ganda di daftar: ${dup.join(", ")}`);

  console.log(`Daftar: ${names.length} family. Mengambil metadata Google Fonts...`);
  const metaText = await (await get(META_URL)).text();
  const metaList: MetaFamily[] = JSON.parse(metaText.slice(metaText.indexOf("{"))).familyMetadataList;
  const meta = new Map(metaList.map((m) => [m.family, m]));

  // Tag Google Fonts: "Family,axes,/Group/Label,score". Tag tanpa sumbu diutamakan; bila family
  // hanya punya tag per posisi sumbu (mis. "wdth,wght@100,400"), skornya dirata-rata.
  const plain = new Map<string, Map<string, number>>();
  const located = new Map<string, Map<string, number[]>>();
  for (const line of (await (await get(TAGS_URL)).text()).split("\n")) {
    const m = /^([^,]+),("[^"]*"|[^,]*),(\/[^,]+),([\d.]+)/.exec(line.trim());
    if (!m) continue;
    const [, fam, axes, tag, score] = m;
    if (!axes) {
      if (!plain.has(fam)) plain.set(fam, new Map());
      plain.get(fam)!.set(tag, Number(score));
    } else {
      if (!located.has(fam)) located.set(fam, new Map());
      const l = located.get(fam)!;
      l.set(tag, [...(l.get(tag) ?? []), Number(score)]);
    }
  }
  const tags = new Map<string, Record<string, number>>();
  const styleTags = new Map<string, string[]>();
  for (const fam of new Set([...plain.keys(), ...located.keys()])) {
    const scores = new Map(plain.get(fam));
    for (const [tag, xs] of located.get(fam) ?? []) {
      if (!scores.has(tag)) scores.set(tag, Math.round(xs.reduce((a, b) => a + b, 0) / xs.length));
    }
    for (const [tag, score] of scores) {
      const [, group, label] = tag.split("/");
      if (group === "Expressive") {
        tags.set(fam, { ...tags.get(fam), [label]: score });
      } else if (["Sans", "Serif", "Script", "Monospace", "Theme"].includes(group) && score >= 50) {
        styleTags.set(fam, [...(styleTags.get(fam) ?? []), `${group}/${label}`]);
      }
    }
  }

  const old: CatalogFont[] = existsSync(CATALOG) ? JSON.parse(readFileSync(CATALOG, "utf8")).fonts : [];
  const oldBy = new Map(old.map((f) => [f.family, f]));
  const result = new Map<string, CatalogFont>();
  const errors: string[] = [];

  const unknown = names.filter((n) => !meta.has(n));
  for (const n of unknown) errors.push(`${n}: tidak ada di metadata Google Fonts (cek ejaan)`);

  const todo = names.filter((n) => meta.has(n));
  let done = 0;
  await pool(todo, 6, async (name) => {
    const m = meta.get(name)!;
    const prev = oldBy.get(name);
    const rebuild = force || !prev || (only ? only.has(name) : false) || !existsSync(path.join(OUT, prev.files.regular));
    try {
      if (!m.subsets.includes("latin")) throw new Error("tidak punya subset latin");
      result.set(name, rebuild
        ? await buildFamily(name, m, tags, styleTags)
        : entry(name, prev.dir, m, tags, styleTags, prev.license, prev.licenseFile, !!prev.files.bold, prev.missingNice));
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`);
    }
    done++;
    if (rebuild) console.log(`  [${done}/${todo.length}] ${name}${result.has(name) ? "" : " GAGAL"}`);
  });

  // Hapus folder yang tidak lagi dipakai.
  const keep = new Set([...result.values()].map((f) => f.dir));
  if (existsSync(OUT)) {
    for (const d of readdirSync(OUT)) {
      if (!keep.has(d) && statSync(path.join(OUT, d)).isDirectory()) {
        rmSync(path.join(OUT, d), { recursive: true });
        console.log(`  dihapus: ${d}`);
      }
    }
  }

  const fonts = names.map((n) => result.get(n)).filter((f): f is CatalogFont => !!f);
  const totalBytes = fonts.reduce((s, f) => s + f.bytes, 0);
  writeFileSync(CATALOG, JSON.stringify({
    $comment: "Dibuat oleh scripts/fonts-build.mts dari data/fonts/families.txt. Jangan diedit manual.",
    generatedAt: new Date().toISOString().slice(0, 10),
    count: fonts.length,
    totalBytes,
    fonts,
  }, null, 1) + "\n");

  const byCat = fonts.reduce<Record<string, number>>((a, f) => ({ ...a, [f.category]: (a[f.category] ?? 0) + 1 }), {});
  console.log(`\nSelesai: ${fonts.length} family, ${(totalBytes / 1024 / 1024).toFixed(1)} MB.`, byCat);
  if (errors.length) {
    console.log(`\n${errors.length} family gagal:`);
    for (const e of errors) console.log(`  - ${e}`);
    process.exitCode = 1;
  }
}

await main();
