import { DOMParser, XMLSerializer, type Element as XElement } from "@xmldom/xmldom";
import sharp from "sharp";
import { hexToRgb, luminance } from "@/lib/brand/color";
import { SPECS } from "@/lib/brand/specs";
import { escapeXml } from "@/lib/render/escape";
import { kitColors, type BrandKit, type KitLogo } from "./kit";
import { placeLogo } from "./logo";
import { advances, fit, measure, r, type TextStyle } from "./text";
import type { CheckIssue } from "./checks";

/**
 * Cap perusahaan (SPEC bagian 5; keputusan pemilik 2026-11-20): bulat Ø 40 mm, satu warna
 * (warna utama versi gelap), latar transparan. Nama perusahaan melingkar di busur atas
 * (teks di jalur, bisa diedit di Illustrator), busur bawah ornamen saja, logo di tengah.
 * Logo SVG tetap vektor (bagian terang menjadi putih kertas); logo PNG menjadi gambar satu warna.
 * Ini desain, bukan stempel yang sah secara hukum.
 */
const D = SPECS.materials.stamp.diameterMm;
export const STAMP_SIZE = { widthMm: D, heightMm: D };
const C = D / 2;

export interface Stamp {
  /** SVG kerja: nama perusahaan sebagai teks di jalur (bisa diedit di Illustrator); juga sumber PDF. */
  svg: string;
  /** SVG untuk pratinjau PNG: huruf ditempatkan satu per satu (resvg kurang rapi untuk teks di jalur). */
  previewSvg: string;
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

/* ---------------- Ornamen ---------------- */

function star(cx: number, cy: number, R: number, fill: string, id: string): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? R * 0.42 : R;
    pts.push(`${r(cx + rad * Math.cos(a))},${r(cy + rad * Math.sin(a))}`);
  }
  return `<polygon id="${id}" points="${pts.join(" ")}" fill="${fill}"/>`;
}

const polar = (rad: number, deg: number) => [C + rad * Math.cos((deg * Math.PI) / 180), C + rad * Math.sin((deg * Math.PI) / 180)] as const;

/* ---------------- Cap ---------------- */

export async function stamp(kit: BrandKit): Promise<Stamp> {
  const k = kitColors(kit);
  const ink = k.primaryText;
  const issues: CheckIssue[] = [];
  const isB = kit.pkg === "B";

  const rings = isB
    ? [
        { r: C - 0.7, w: 1.2 },
        { r: 12.8, w: 0.7 },
      ]
    : [
        { r: C - 0.35, w: 0.6 },
        { r: C - 1.3, w: 0.25 },
        { r: 12.6, w: 0.4 },
      ];
  const inner = rings[rings.length - 1].r;
  const textR = inner + 1.9; // baseline teks di busur atas (huruf menghadap keluar)

  // Nama perusahaan mengisi busur atas ~150° (maks. ~210° untuk nama panjang), berpusat di atas.
  const name = kit.company.name.toUpperCase();
  const deg = (d: number) => textR * ((d * Math.PI) / 180);
  const base: TextStyle = { font: kit.fonts.heading, bold: true, size: 3.4, color: ink };
  let st = fit(name, base, deg(150), 2.4);
  if (measure(name, st) > deg(150)) st = fit(name, st, deg(205), 2.1);
  // Perbesar sampai mengisi busur (maks. 3,6 mm) supaya nama pendek tidak terlihat kosong.
  while (st.size < 3.6 && measure(name, { ...st, size: st.size + 0.05 }) <= deg(150)) st = { ...st, size: Math.round((st.size + 0.05) * 100) / 100 };
  const span = (measure(name, st) / textR) * (180 / Math.PI);
  if (span > 228) issues.push({ code: "outside-safe-area", message: "Nama perusahaan terlalu panjang untuk busur atas cap; pertimbangkan nama singkat." });

  const parts: string[] = [];
  // Jalur 240°: dari 150° (kiri bawah) lewat atas ke 30° (kanan bawah); titik tengahnya di puncak.
  const [sx, sy] = polar(textR, 150);
  const [ex, ey] = polar(textR, 30);
  parts.push(`  <defs><path id="busur-atas" d="M ${r(sx)} ${r(sy)} A ${r(textR)} ${r(textR)} 0 1 1 ${r(ex)} ${r(ey)}"/></defs>`);
  parts.push(`  <g id="cincin">${rings.map((x, i) => `<circle id="cincin-${i + 1}" cx="${C}" cy="${C}" r="${r(x.r)}" fill="none" stroke="${ink}" stroke-width="${x.w}"/>`).join("")}</g>`);
  const textAttrs = `font-family="${escapeXml(st.font.family)}"${st.font.bold ? ' font-weight="bold"' : ""} font-size="${r(st.size)}" fill="${ink}"`;
  const onPath = `  <g id="nama-perusahaan"><text ${textAttrs}><textPath xlink:href="#busur-atas" href="#busur-atas" startOffset="50%" text-anchor="middle">${escapeXml(name)}</textPath></text></g>`;
  // Versi pratinjau: tiap huruf diputar di posisinya sepanjang busur.
  const adv = advances(name, st);
  const total = adv.reduce((a, b) => a + b, 0);
  let acc = 0;
  const glyphs = [...name].map((ch, i) => {
    const mid = acc + adv[i] / 2 - total / 2;
    acc += adv[i];
    const a = -90 + (mid / textR) * (180 / Math.PI);
    const [x, y] = polar(textR, a);
    return ch === " " ? "" : `<text ${textAttrs} text-anchor="middle" transform="translate(${r(x)} ${r(y)}) rotate(${r(a + 90)})">${escapeXml(ch)}</text>`;
  });
  const perGlyph = `  <g id="nama-perusahaan">${glyphs.join("")}</g>`;

  // Busur bawah: ornamen saja (keputusan pemilik).
  const midR = inner + 2.6;
  const orn: string[] = [];
  if (isB) {
    for (let a = 30; a <= 150; a += 12) {
      const [x, y] = polar(midR, a);
      orn.push(`<circle cx="${r(x)}" cy="${r(y)}" r="${a === 90 ? 0.75 : 0.45}" fill="${ink}"/>`);
    }
    // Bintang samping hanya bila tidak tertimpa nama perusahaan.
    if (span < 168)
      for (const [i, a] of [180, 0].entries()) {
        const [x, y] = polar(midR, a);
        orn.push(star(x, y, 1.3, ink, `bintang-${i + 1}`));
      }
  } else {
    for (const [i, a] of [65, 90, 115].entries()) {
      const [x, y] = polar(midR, a);
      orn.push(star(x, y, i === 1 ? 1.6 : 1.1, ink, `bintang-${i + 1}`));
    }
  }
  parts.push(`  <g id="ornamen">${orn.join("")}</g>`);

  // Logo di tengah, kotak terbesar di dalam lingkaran dalam.
  const lr = inner - 1.6;
  const th = Math.atan(1 / Math.max(0.2, kit.logo.aspect));
  const box = { w: 2 * lr * Math.cos(th), h: 2 * lr * Math.sin(th) };
  let logo: KitLogo;
  if (kit.logo.kind === "svg" && kit.logo.svg) logo = { ...kit.logo, svg: svgInk(kit.logo.svg, ink) };
  else logo = { ...kit.logo, kind: "png", png: await pngInk(kit.logo.png, ink) };
  const placed = placeLogo(logo, { x: C - box.w / 2, y: C - box.h / 2, w: box.w, h: box.h });
  parts.push(`  <g id="logo">${placed.svg}</g>`);
  if (logo.kind === "png") issues.push({ code: "note", message: "Logo PNG dipakai sebagai gambar satu warna; cap tidak sepenuhnya vektor. Gunakan logo SVG untuk hasil cetak terbaik." });

  const doc = (nameGroup: string) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${D}mm" height="${D}mm" viewBox="0 0 ${D} ${D}">
  <title>${escapeXml(`${kit.company.name} - cap (Paket ${kit.pkg})`)}</title>
${parts.slice(0, 2).join("\n")}
${nameGroup}
${parts.slice(2).join("\n")}
</svg>`;
  return { svg: doc(onPath), previewSvg: doc(perGlyph), issues };
}
