import { contrastRatio, hexToRgb } from "@/lib/brand/color";
import type { Box } from "./text";

/**
 * Pengecekan otomatis tiap render (SPEC bagian 15): teks keluar dari area aman, blok
 * bertabrakan, kontras teks terhadap latar. Satuan mm.
 */
export interface CheckIssue {
  code: "outside-safe-area" | "overlap" | "low-contrast";
  message: string;
}

export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

const inside = (b: Box, a: Area, tol = 0.05) => b.x >= a.x - tol && b.y >= a.y - tol && b.x + b.w <= a.x + a.w + tol && b.y + b.h <= a.y + a.h + tol;
const overlaps = (a: Box, b: Box, gap = 0) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

/** `obstacles`: area yang tidak boleh ditimpa teks/logo (mis. lubang tali ID card); hanya dicek tabrakannya. */
export function checkLayout(boxes: Box[], safe: Area, obstacles: Box[] = []): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const b of boxes) {
    if (!inside(b, safe)) out.push({ code: "outside-safe-area", message: `"${b.id}" keluar dari area aman.` });
    if (b.fg && b.bg) {
      const ratio = contrastRatio(hexToRgb(b.fg), hexToRgb(b.bg));
      // Teks kecil (< 4 mm ~ 11 pt) butuh 4,5:1; teks besar 3:1.
      const need = (b.size ?? 0) >= 4 ? 3 : 4.5;
      if (ratio < need) out.push({ code: "low-contrast", message: `"${b.id}" kontras ${ratio.toFixed(1)}:1 (minimal ${need}:1).` });
    }
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (overlaps(boxes[i], boxes[j])) out.push({ code: "overlap", message: `"${boxes[i].id}" bertabrakan dengan "${boxes[j].id}".` });
  for (const b of boxes)
    for (const o of obstacles)
      if (overlaps(b, o)) out.push({ code: "overlap", message: `"${b.id}" menimpa area ${o.id}.` });
  return out;
}
