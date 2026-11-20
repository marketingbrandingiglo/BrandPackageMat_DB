import { DOMParser, XMLSerializer, type Element as XElement } from "@xmldom/xmldom";
import sharp from "sharp";
import { hexToRgb, luminance } from "@/lib/brand/color";
import { SPECS } from "@/lib/brand/specs";
import { escapeXml } from "@/lib/render/escape";
import { kitColors, type BrandKit, type KitLogo } from "./kit";
import { placeLogo } from "./logo";
import { r } from "./text";
import type { CheckIssue } from "./checks";

/**
 * Cap perusahaan (SPEC bagian 5; keputusan pemilik 2026-11-20): satu warna (warna utama versi
 * gelap), latar transparan, tanpa ornamen dan tanpa teks (nama perusahaan sering sudah ada di logo).
 * - Model 1 (Paket A): logo saja, sisi terpanjang 40 mm.
 * - Model 2 (Paket B): logo di dalam satu lingkaran Ø 40 mm (garis 1 mm), jarak aman 4 mm.
 * Logo SVG tetap vektor (bagian terang menjadi putih kertas); logo PNG menjadi gambar satu warna.
 * Ini desain, bukan stempel yang sah secara hukum.
 */
const D = SPECS.materials.stamp.diameterMm;
const RING = 1;
const GAP = 4;

export interface Stamp {
  svg: string;
  /** Ukuran dokumen (model 1 mengikuti rasio logo). */
  size: { widthMm: number; heightMm: number };
  issues: CheckIssue[];
}

/* ---------------- Logo satu warna ---------------- */

const NAMED: Record<string, string> = { white: "#ffffff", black: "#000000", red: "#ff0000", blue: "#0000ff", green: "#008000", yellow: "#ffff00", gray: "#808080", grey: "#808080" };

function parseColor(v: string): [number, number, number] | null {
  const s = v.trim().toLowerCase();
  if (NAMED[s]) return hexToRgb(NAMED[s]);
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return hexToRgb(`#${m[1].split("").map((c) => c + c).join("")}`);
  m = /^#([0-9a-f]{6})/.exec(s);
  if (m) return hexToRgb(`#${m[1]}`);
  m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

/** Warna terang (mis. huruf putih di dalam bentuk berwarna) menjadi putih kertas, sisanya tinta. */
function inkOrPaper(v: string, ink: string): string {
  const rgb = parseColor(v);
  return rgb && luminance(rgb) > 0.6 ? "#FFFFFF" : ink;
}

export function svgInk(svg: string, ink: string): string {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const skip = /^(none|transparent|currentcolor|inherit)$/i;
  const recolorCss = (css: string) =>
    css.replace(/\b(fill|stroke|stop-color|color)\s*:\s*([^;}"]+)/gi, (m, prop, val) => {
      const v = String(val).trim();
      return skip.test(v) || /^url\(/i.test(v) ? m : `${prop}:${inkOrPaper(v, ink)}`;
    });
  const walk = (el: XElement) => {
    for (const attr of ["fill", "stroke", "stop-color", "color"]) {
      const v = el.getAttribute(attr);
      if (v && !skip.test(v.trim()) && !/^url\(/i.test(v.trim())) el.setAttribute(attr, inkOrPaper(v, ink));
    }
    const style = el.getAttribute("style");
    if (style) el.setAttribute("style", recolorCss(style));
    if (el.localName === "style") {
      const css = el.textContent ?? "";
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(doc.createTextNode(recolorCss(css)));
    }
    for (const c of Array.from(el.childNodes as unknown as ArrayLike<XElement>)) if (c.nodeType === 1) walk(c);
  };
  const root = doc.documentElement!;
  if (!root.getAttribute("fill")) root.setAttribute("fill", ink);
  walk(root);
  return new XMLSerializer().serializeToString(doc);
}

/** PNG satu warna: bagian gelap/berwarna menjadi tinta, bagian terang transparan. */
export async function pngInk(png: Buffer, ink: string): Promise<Buffer> {
  const [ir, ig, ib] = hexToRgb(ink);
  const { data, info } = await sharp(png).resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const lum = luminance([data[i], data[i + 1], data[i + 2]]);
    const k = Math.max(0, Math.min(1, (0.7 - lum) / 0.3));
    out[i] = ir;
    out[i + 1] = ig;
    out[i + 2] = ib;
    out[i + 3] = Math.round(data[i + 3] * k);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/* ---------------- Cap ---------------- */

export async function stamp(kit: BrandKit): Promise<Stamp> {
  const ink = kitColors(kit).primaryText;
  const issues: CheckIssue[] = [];
  let logo: KitLogo;
  if (kit.logo.kind === "svg" && kit.logo.svg) logo = { ...kit.logo, svg: svgInk(kit.logo.svg, ink) };
  else logo = { ...kit.logo, kind: "png", png: await pngInk(kit.logo.png, ink) };
  if (logo.kind === "png") issues.push({ code: "note", message: "Logo PNG dipakai sebagai gambar satu warna; cap tidak sepenuhnya vektor. Gunakan logo SVG untuk hasil cetak terbaik." });

  const aspect = Math.max(0.05, logo.aspect);
  let size: Stamp["size"];
  const parts: string[] = [];
  if (kit.pkg === "A") {
    // Model 1: logo saja, sisi terpanjang 40 mm.
    size = aspect >= 1 ? { widthMm: D, heightMm: D / aspect } : { widthMm: D * aspect, heightMm: D };
    const placed = placeLogo(logo, { x: 0, y: 0, w: size.widthMm, h: size.heightMm });
    parts.push(`  <g id="logo">${placed.svg}</g>`);
  } else {
    // Model 2: lingkaran luar + logo di dalamnya.
    size = { widthMm: D, heightMm: D };
    const C = D / 2;
    const ringR = C - RING / 2;
    const lr = C - RING - GAP; // radius ruang logo
    const th = Math.atan(1 / aspect);
    const box = { w: 2 * lr * Math.cos(th), h: 2 * lr * Math.sin(th) };
    const placed = placeLogo(logo, { x: C - box.w / 2, y: C - box.h / 2, w: box.w, h: box.h });
    parts.push(`  <g id="lingkaran"><circle cx="${C}" cy="${C}" r="${r(ringR)}" fill="none" stroke="${ink}" stroke-width="${RING}"/></g>`);
    parts.push(`  <g id="logo">${placed.svg}</g>`);
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${r(size.widthMm)}mm" height="${r(size.heightMm)}mm" viewBox="0 0 ${r(size.widthMm)} ${r(size.heightMm)}">
  <title>${escapeXml(`${kit.company.name} - cap (Paket ${kit.pkg})`)}</title>
${parts.join("\n")}
</svg>`;
  return { svg, size, issues };
}
