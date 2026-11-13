import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import * as fontkit from "fontkit";
import sharp, { type OverlayOptions } from "sharp";
import { escapeXml } from "@/lib/render/escape";
import { FONTS, type CatalogFont } from "./fonts";

/**
 * Lembar spesimen untuk seleksi font tahap (b): tiap kandidat dirender dengan file font
 * katalog (resvg, tanpa font sistem), lalu disusun dalam satu PNG berlabel kode (H01, B01, ...).
 * Tiap baris dirender terpisah dengan hanya satu file font, sehingga tidak bergantung pada
 * nama family/bobot di dalam file.
 */

const LIB = path.join(process.cwd(), "fonts/lib");
const LABEL_FONT = (FONTS.find((f) => f.family === "Inter") ?? FONTS[0]).files.regular;
const familyCache = new Map<string, string>();

function familyOf(rel: string): string {
  let n = familyCache.get(rel);
  if (!n) {
    n = fontkit.create(readFileSync(path.join(LIB, rel))).familyName;
    familyCache.set(rel, n);
  }
  return n;
}

/** Satu baris teks -> PNG transparan selebar `width`. Teks yang terlalu panjang terpotong. */
function line(text: string, rel: string, size: number, width: number, color = "#212122"): Buffer {
  const h = Math.ceil(size * 1.45);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}"><text x="0" y="${Math.round(size * 1.08)}" font-size="${size}" fill="${color}">${escapeXml(text)}</text></svg>`;
  const r = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: { loadSystemFonts: false, fontFiles: [path.join(LIB, rel)], defaultFontFamily: familyOf(rel) },
  });
  return r.render().asPng();
}

export interface SpecimenItem {
  code: string;
  font: CatalogFont;
  /** Boleh untuk teks isi; bila tidak, hanya baris heading dan contoh huruf. */
  body: boolean;
}

const W = 1500;
const COLS = 2;
const PAD = 28;
const TILE_W = W / COLS;
const TILE_H = 230;
const HEAD_H = 70;
export const PER_SHEET = 10;

async function sheet(title: string, items: SpecimenItem[], companyName: string): Promise<Buffer> {
  const rows = Math.ceil(items.length / COLS);
  const H = HEAD_H + rows * TILE_H;
  const inner = TILE_W - PAD * 2;
  const layers: OverlayOptions[] = [{ input: line(title, LABEL_FONT, 24, W - PAD * 2, "#5f5e5c"), left: PAD, top: 22 }];
  items.forEach((it, i) => {
    const left = (i % COLS) * TILE_W + PAD;
    const top = HEAD_H + Math.floor(i / COLS) * TILE_H;
    const f = it.font.files;
    layers.push({ input: line(`${it.code}${it.body ? "" : " · heading saja"}`, LABEL_FONT, 17, inner, "#e82827"), left, top: top + 12 });
    layers.push({ input: line(companyName, f.bold ?? f.regular, 46, inner), left, top: top + 44 });
    if (it.body) {
      layers.push({ input: line("Kami membantu usaha Anda tumbuh lewat layanan", f.regular, 21, inner), left, top: top + 118 });
      layers.push({ input: line("yang jujur, cepat, dan tepat. Telp. 0812 3456 7890", f.regular, 21, inner), left, top: top + 152 });
    } else {
      layers.push({ input: line("AaBbCcGgRr 0123456789", f.regular, 26, inner, "#5f5e5c"), left, top: top + 122 });
    }
  });
  const sep = (y: number) => `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="#e7e5e2" stroke-width="2"/>`;
  const grid = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${Array.from({ length: rows }, (_, r) => sep(HEAD_H + r * TILE_H)).join("")}<line x1="${TILE_W}" x2="${TILE_W}" y1="${HEAD_H}" y2="${H}" stroke="#e7e5e2" stroke-width="2"/></svg>`;
  return sharp({ create: { width: W, height: H, channels: 4, background: "#ffffff" } })
    .composite([{ input: Buffer.from(grid), left: 0, top: 0 }, ...layers])
    .png()
    .toBuffer();
}

/** Lembar spesimen, maks. 10 kandidat per gambar agar tetap terbaca setelah diperkecil. */
export async function specimenSheets(items: SpecimenItem[], companyName: string): Promise<Buffer[]> {
  const pages: SpecimenItem[][] = [];
  for (let i = 0; i < items.length; i += PER_SHEET) pages.push(items.slice(i, i + PER_SHEET));
  return Promise.all(
    pages.map((p, i) => sheet(`Kandidat font, lembar ${i + 1} dari ${pages.length} (${p[0].code}-${p[p.length - 1].code})`, p, companyName)),
  );
}
