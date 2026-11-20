import { createHash } from "node:crypto";
import { Resvg } from "@resvg/resvg-js";
import { DOMParser, type Element as XElement, type Node as XNode } from "@xmldom/xmldom";
import type { Palette } from "./palette";
import { sanitizeSvg, SvgRejected } from "./svg-sanitize";
import type { VisualPkg } from "./visual-types";

export * from "./visual-types";

/**
 * Tahap 5 (SPEC bagian 7): satu aset dekoratif SVG per paket, ditulis sesi pekerja Claude.
 * Modul ini memvalidasi SVG itu (keputusan pemilik 2026-11-20): hanya bentuk vektor sederhana,
 * tanpa teks, gambar, script, atau filter; warna hanya dari palet paket; ukuran maks. 150 KB.
 * Aset ditempatkan aplikasi di area sendiri pada materi (dipotong sesuai rasio area).
 */
export const VISUAL_VERSION = 1;
export const VISUAL_SIZE = 1200;
export const VISUAL_MAX_BYTES = 150 * 1024;
const MAX_ELEMENTS = 800;
const MIN_INK = 0.08;

const ELEMENTS = new Set(["svg", "g", "defs", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "linearGradient", "radialGradient", "stop", "clipPath", "title", "desc"]);
const COLOR_ATTRS = ["fill", "stroke", "stop-color", "color"];

export interface PaletteColor {
  hex: string;
  name: string;
}

/** Warna yang boleh dipakai aset satu paket: warna utama + logo, aksen paket, netral, putih. */
export function allowedColors(p: Palette, pkg: VisualPkg): PaletteColor[] {
  const list: PaletteColor[] = [];
  const add = (hex: string, name: string) => {
    const h = hex.toUpperCase();
    if (!list.some((x) => x.hex === h)) list.push({ hex: h, name });
  };
  add(p.primary.hex, p.primary.name.id);
  if (p.primaryText) add(p.primaryText.hex, p.primaryText.name.id);
  p.logoSecondary.forEach((s) => add(s.hex, s.name.id));
  p.packages[pkg].supporting.forEach((s) => add(s.hex, s.name.id));
  p.neutrals.forEach((s) => add(s.hex, s.name.id));
  add("#FFFFFF", "Putih");
  return list;
}

export function visualKey(logo: Buffer, p: Palette, pkg: VisualPkg): string {
  return createHash("sha256")
    .update(`v${VISUAL_VERSION}|${pkg}|`)
    .update(createHash("sha256").update(logo).digest("hex"))
    .update(allowedColors(p, pkg).map((c) => c.hex).join(","))
    .digest("hex")
    .slice(0, 32);
}

function normHex(v: string): string | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return `#${h.toUpperCase()}`;
}

export type VisualCheck = { ok: true; svg: string; colors: string[]; ink: number } | { ok: false; errors: string[] };

/** Validasi SVG aset dekoratif. */
export function validateVisual(input: string, allowed: PaletteColor[]): VisualCheck {
  const errors: string[] = [];
  const bytes = Buffer.byteLength(input);
  if (bytes > VISUAL_MAX_BYTES) errors.push(`Ukuran ${Math.round(bytes / 1024)} KB melebihi batas ${VISUAL_MAX_BYTES / 1024} KB; sederhanakan bentuk.`);
  const parseErr: string[] = [];
  const doc = new DOMParser({ onError: (l, m) => l !== "warning" && parseErr.push(String(m)) }).parseFromString(input, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.localName !== "svg" || parseErr.length) return { ok: false, errors: ["Bukan SVG/XML yang sah."] };
  const vb = (root.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  if (vb.join(" ") !== `0 0 ${VISUAL_SIZE} ${VISUAL_SIZE}`) errors.push(`viewBox harus "0 0 ${VISUAL_SIZE} ${VISUAL_SIZE}".`);

  const allow = new Set(allowed.map((c) => c.hex));
  const used = new Set<string>();
  const bad = new Set<string>();
  const badEls = new Set<string>();
  let count = 0;
  const checkColor = (v: string) => {
    const val = v.trim();
    if (!val || /^(none|transparent|inherit|currentColor)$/i.test(val) || /^url\(\s*#[^)]+\)$/i.test(val)) return;
    const h = normHex(val);
    if (h && allow.has(h)) used.add(h);
    else bad.add(val);
  };
  const walk = (el: XElement) => {
    for (const node of Array.from(el.childNodes as unknown as ArrayLike<XNode>)) {
      if (node.nodeType !== 1) continue;
      const c = node as XElement;
      const name = c.localName ?? c.nodeName;
      count++;
      if (!ELEMENTS.has(name)) badEls.add(name);
      visit(c);
      walk(c);
    }
  };
  const visit = (el: XElement) => {
    for (const a of Array.from(el.attributes as unknown as ArrayLike<{ name: string; value: string }>)) {
      const n = a.name.toLowerCase();
      if (n.startsWith("on") || n === "href" || n === "xlink:href") errors.push(`Atribut ${a.name} tidak diizinkan.`);
      if (n === "class") errors.push("Atribut class tidak diizinkan; tulis warna sebagai atribut.");
      if (n === "filter" || n === "mask") errors.push(`Atribut ${a.name} tidak diizinkan.`);
      if (COLOR_ATTRS.includes(n)) checkColor(a.value);
      if (n === "style") {
        for (const decl of a.value.split(";")) {
          const [p, ...rest] = decl.split(":");
          const prop = p?.trim().toLowerCase();
          if (!prop) continue;
          if (COLOR_ATTRS.includes(prop)) checkColor(rest.join(":"));
          if (prop === "filter" || prop === "mask" || prop === "mix-blend-mode" || prop.startsWith("--")) errors.push(`Gaya ${prop} tidak diizinkan.`);
        }
      }
    }
  };
  visit(root);
  walk(root);
  if (badEls.size) errors.push(`Elemen tidak diizinkan: ${[...badEls].map((x) => `<${x}>`).join(", ")} (tanpa teks, gambar, filter, mask, pattern, style, use).`);
  if (count > MAX_ELEMENTS) errors.push(`Terlalu banyak elemen (${count}, maks. ${MAX_ELEMENTS}).`);
  if (bad.size) errors.push(`Warna di luar palet: ${[...bad].slice(0, 8).join(", ")}. Pakai HEX dari daftar palet persis (ubah kepekatan dengan opacity).`);
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };

  let clean: string;
  try {
    const s = sanitizeSvg(input);
    if (s.removed.length || s.hasText || s.hasRaster || s.hasFilter) return { ok: false, errors: [`Sanitasi membuang: ${s.removed.join(", ") || "teks/gambar/filter"}.`] };
    clean = s.svg;
  } catch (e) {
    return { ok: false, errors: [e instanceof SvgRejected ? e.message : "SVG tidak bisa diproses."] };
  }
  // Aset tidak boleh nyaris kosong.
  const img = new Resvg(clean, { fitTo: { mode: "width", value: 200 }, background: "rgba(0,0,0,0)" }).render();
  const px = img.pixels;
  let ink = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > 24) ink++;
  const share = ink / (img.width * img.height);
  if (share < MIN_INK) return { ok: false, errors: [`Aset terlalu kosong (${Math.round(share * 100)}% kanvas terisi, minimal ${MIN_INK * 100}%).`] };
  return { ok: true, svg: clean, colors: [...used], ink: share };
}

/** PNG pratinjau aset (persegi). */
export function visualPreview(svg: string, px = 600, background = "#FFFFFF"): Buffer {
  return new Resvg(svg, { fitTo: { mode: "width", value: px }, background }).render().asPng();
}
