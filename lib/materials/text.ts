import { readFileSync } from "node:fs";
import path from "node:path";
import * as fontkit from "fontkit";
import { escapeXml } from "@/lib/render/escape";
import type { FontRef } from "@/lib/brand/font-select";

/**
 * Pengukuran dan penempatan teks untuk template SVG (satuan mm). SVG tidak membungkus teks,
 * jadi lebar teks diukur dari file font katalog, lalu teks diperkecil atau dipecah per baris.
 */
const LIB = path.join(process.cwd(), "fonts/lib");
const cache = new Map<string, fontkit.Font & { layout(t: string): { advanceWidth: number } }>();

function font(rel: string) {
  let f = cache.get(rel);
  if (!f) {
    f = fontkit.create(readFileSync(path.join(LIB, rel))) as typeof f & object;
    cache.set(rel, f!);
  }
  return f!;
}

export interface TextStyle {
  font: FontRef;
  bold?: boolean;
  size: number;
  color: string;
  letterSpacing?: number;
  anchor?: "start" | "middle" | "end";
}

const fileOf = (s: TextStyle) => (s.bold && s.font.bold ? s.font.bold : s.font.regular);

/** Lebar teks dalam mm. */
export function measure(text: string, s: TextStyle): number {
  const f = font(fileOf(s));
  const w = (f.layout(text).advanceWidth / f.unitsPerEm) * s.size;
  return w + (s.letterSpacing ?? 0) * Math.max(0, [...text].length - 1);
}

/** Perkecil ukuran sampai muat di `maxWidth`, tidak di bawah `minSize`. */
export function fit(text: string, s: TextStyle, maxWidth: number, minSize: number): TextStyle {
  let size = s.size;
  while (size > minSize && measure(text, { ...s, size }) > maxWidth) size = Math.round((size - 0.05) * 100) / 100;
  return { ...s, size };
}

/** Pecah teks menjadi baris selebar `maxWidth`, maks. `maxLines`; baris terakhir diperkecil bila perlu. */
export function wrap(text: string, s: TextStyle, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next, s) <= maxWidth || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const head = lines.slice(0, maxLines - 1);
    head.push(lines.slice(maxLines - 1).join(" "));
    return head;
  }
  return lines;
}

/** Kotak batas teks (untuk pengecekan otomatis). */
export interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Warna teks dan latar di bawahnya, untuk cek kontras. */
  fg?: string;
  bg?: string;
  /** Ukuran huruf (mm) untuk menentukan ambang kontras. */
  size?: number;
}

/** Elemen <text> + kotak batasnya. y = baseline. */
export function text(id: string, value: string, x: number, y: number, s: TextStyle, bg?: string): { svg: string; box: Box } {
  const w = measure(value, s);
  const left = s.anchor === "end" ? x - w : s.anchor === "middle" ? x - w / 2 : x;
  const attrs = [
    `id="${id}"`,
    `x="${r(x)}"`,
    `y="${r(y)}"`,
    `font-family="${escapeXml(s.font.family)}"`,
    `font-size="${r(s.size)}"`,
    s.bold ? `font-weight="bold"` : "",
    s.anchor && s.anchor !== "start" ? `text-anchor="${s.anchor}"` : "",
    s.letterSpacing ? `letter-spacing="${r(s.letterSpacing)}"` : "",
    `fill="${s.color}"`,
  ].filter(Boolean);
  return {
    svg: `<text ${attrs.join(" ")}>${escapeXml(value)}</text>`,
    // Kira-kira: tinggi huruf kapital ~0,72 size di atas baseline, turunan ~0,22 di bawah.
    box: { id, x: left, y: y - s.size * 0.75, w, h: s.size * 0.98, fg: s.color, bg, size: s.size },
  };
}

export const r = (n: number) => String(Math.round(n * 1000) / 1000);

/** Lebar maju tiap huruf (mm), termasuk kerning, untuk menempatkan huruf satu per satu (mis. teks melingkar). */
export function advances(text: string, s: TextStyle): number[] {
  const f = font(fileOf(s)) as unknown as { unitsPerEm: number; layout(t: string, features?: string[]): { positions: { xAdvance: number }[]; glyphs: { codePoints: number[] }[] } };
  const run = f.layout(text);
  // Tanpa ligatur (teks huruf kapital), satu glyph = satu karakter; bila tidak, bagi rata.
  const chars = [...text];
  if (run.glyphs.length !== chars.length) {
    const w = measure(text, s) / chars.length;
    return chars.map(() => w);
  }
  return run.positions.map((p) => (p.xAdvance / f.unitsPerEm) * s.size);
}
