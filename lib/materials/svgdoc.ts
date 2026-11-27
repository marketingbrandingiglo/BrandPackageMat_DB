import { SPECS } from "@/lib/brand/specs";
import { escapeXml } from "@/lib/render/escape";
import { r } from "./text";

/**
 * Kerangka dokumen SVG cetak: ukuran jadi (+ bleed bila SPECS.print.bleedMm > 0; sejak 2026-11-27
 * bleed = 0, jadi ukuran file = ukuran jadi), satuan viewBox mm, grup "panduan" tersembunyi berisi
 * area aman, garis potong (hanya bila ada bleed), dan panduan tambahan (mis. lubang tali ID card).
 * Posisi di template ditulis relatif terhadap garis potong (BLEED + nilai), jadi tetap benar bila bleed diubah.
 */
export const BLEED = SPECS.print.bleedMm;
export const SAFE = SPECS.print.safeAreaMm;

export interface Sheet {
  /** Ukuran dokumen (termasuk bleed bila ada). */
  W: number;
  H: number;
  /** Tepi area aman. */
  IN: number;
  safe: { x: number; y: number; w: number; h: number };
  size: { widthMm: number; heightMm: number };
}

export function sheet(trimW: number, trimH: number): Sheet {
  const W = trimW + 2 * BLEED;
  const H = trimH + 2 * BLEED;
  const IN = BLEED + SAFE;
  return { W, H, IN, safe: { x: IN, y: IN, w: W - 2 * IN, h: H - 2 * IN }, size: { widthMm: W, heightMm: H } };
}

export function svgDoc(s: Sheet, title: string, body: string, extraGuides = ""): string {
  const { W, H, IN } = s;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${r(W)}mm" height="${r(H)}mm" viewBox="0 0 ${r(W)} ${r(H)}">
  <title>${escapeXml(title)}</title>
${body}
  <g id="panduan" display="none">
${BLEED > 0 ? `    <rect id="potong" x="${BLEED}" y="${BLEED}" width="${r(W - 2 * BLEED)}" height="${r(H - 2 * BLEED)}" fill="none" stroke="#FF00FF" stroke-width="0.1"/>\n` : ""}    <rect id="area-aman" x="${IN}" y="${IN}" width="${r(W - 2 * IN)}" height="${r(H - 2 * IN)}" fill="none" stroke="#00AEEF" stroke-width="0.1"/>${extraGuides}
  </g>
</svg>`;
}
