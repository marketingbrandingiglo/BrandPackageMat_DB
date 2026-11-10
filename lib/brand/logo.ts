import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import { DOMParser, XMLSerializer, type Element as XElement } from "@xmldom/xmldom";
import { SPECS } from "./specs";
import { contrastRatio, hexToRgb, type RGB } from "./color";
import { sanitizeSvg, SvgRejected } from "./svg-sanitize";

export type WarningLevel = "info" | "warn" | "hard";
export interface LogoWarning {
  level: WarningLevel;
  code: string;
  message: string;
}

/** Cara menampilkan logo di latar tertentu. */
export type BackgroundStrategy =
  | "original" // logo asli sudah cukup kontras
  | "mono" // dibuat versi satu warna (putih di latar gelap, hitam di latar terang)
  | "plate" // logo diletakkan di atas bidang terang/gelap karena warnanya beragam
  | "unavailable"; // logo tidak transparan, varian tidak bisa dibuat otomatis

export interface BackgroundCheck {
  background: string;
  /** Porsi piksel logo yang kontrasnya kurang dari ambang. */
  lowContrastShare: number;
  strategy: BackgroundStrategy;
}

export interface LogoReport {
  kind: "png" | "svg";
  bytes: number;
  width: number;
  height: number;
  warnings: LogoWarning[];
  /** Hanya untuk SVG: hasil sanitasi dan yang dibuang. */
  sanitized?: { svg: string; removed: string[] };
  transparentBackground: boolean;
  monochrome: boolean;
  onDark: BackgroundCheck;
  onLight: BackgroundCheck;
  /** PNG pratinjau (maks 600 px), varian putih dan gelap bila relevan. */
  previews: { original: Buffer; monoWhite?: Buffer; monoDark?: Buffer };
  /** SVG satu warna, bila logo SVG dan monokrom. */
  monoSvg?: { white: string; dark: string };
}

export class LogoRejected extends Error {}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function detectKind(buf: Buffer): "png" | "svg" | null {
  if (buf.subarray(0, 8).equals(PNG_SIG)) return "png";
  const head = buf.subarray(0, 2048).toString("utf8").replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) return "svg";
  return null;
}

interface Raster {
  data: Buffer; // RGBA
  width: number;
  height: number;
}

async function toRaster(input: Buffer, maxSide: number): Promise<Raster> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function svgToPng(svg: string, width: number): Buffer {
  return new Resvg(svg, { fitTo: { mode: "width", value: width }, background: "rgba(0,0,0,0)" }).render().asPng();
}

/** Statistik piksel: transparansi, keragaman warna, dan kontras terhadap latar. */
export function pixelStats(r: Raster, minContrast: number) {
  const { data, width, height } = r;
  const dark = hexToRgb(SPECS.logo.darkBackground);
  const light = hexToRgb(SPECS.logo.lightBackground);
  let opaque = 0;
  let lowDark = 0;
  let lowLight = 0;
  let border = 0;
  let borderOpaque = 0;
  const buckets = new Map<number, number>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (isBorder) {
        border++;
        if (a > 240) borderOpaque++;
      }
      if (a < 128) continue;
      opaque++;
      const rgb: RGB = [data[i], data[i + 1], data[i + 2]];
      if (contrastRatio(rgb, dark) < minContrast) lowDark++;
      if (contrastRatio(rgb, light) < minContrast) lowLight++;
      // Kuantisasi 3 bit per kanal untuk menghitung keragaman warna.
      const key = ((rgb[0] >> 5) << 6) | ((rgb[1] >> 5) << 3) | (rgb[2] >> 5);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  const top = Math.max(0, ...buckets.values());
  return {
    opaqueShare: opaque / (width * height),
    borderOpaqueShare: border ? borderOpaque / border : 0,
    dominantShare: opaque ? top / opaque : 1,
    lowDarkShare: opaque ? lowDark / opaque : 0,
    lowLightShare: opaque ? lowLight / opaque : 0,
  };
}

async function monoPng(r: Raster, hex: string): Promise<Buffer> {
  const [cr, cg, cb] = hexToRgb(hex);
  const out = Buffer.from(r.data);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = cr;
    out[i + 1] = cg;
    out[i + 2] = cb;
  }
  return sharp(out, { raw: { width: r.width, height: r.height, channels: 4 } }).png().toBuffer();
}

/** Ubah semua warna SVG menjadi satu warna (untuk varian putih/gelap dan cap). */
export function svgMonochrome(svg: string, hex: string): string {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const paint = /^(none|transparent|currentcolor|inherit)$/i;
  const recolorCss = (css: string) =>
    css.replace(/\b(fill|stroke|stop-color|color)\s*:\s*([^;}"]+)/gi, (m, prop, val) =>
      paint.test(String(val).trim()) || /^url\(/i.test(String(val).trim()) ? m : `${prop}:${hex}`,
    );
  const walk = (el: XElement) => {
    for (const attr of ["fill", "stroke", "stop-color", "color"]) {
      const v = el.getAttribute(attr);
      if (v && !paint.test(v.trim()) && !/^url\(/i.test(v.trim())) el.setAttribute(attr, hex);
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
  // Elemen tanpa fill memakai hitam bawaan; isi lewat root agar ikut berubah.
  if (!root.getAttribute("fill")) root.setAttribute("fill", hex);
  walk(root);
  return new XMLSerializer().serializeToString(doc);
}

function decide(lowShare: number, transparent: boolean, monochrome: boolean): BackgroundStrategy {
  // Logo berlatar tampil sebagai kotak di latar gelap; varian tidak bisa dibuat otomatis.
  if (!transparent) return "unavailable";
  // Logo dianggap terbaca bila sebagian besar pikselnya cukup kontras.
  if (lowShare <= 0.35) return "original";
  return monochrome ? "mono" : "plate";
}

/** Periksa logo unggahan (SPEC bagian 3). Melempar LogoRejected untuk tipe/ukuran yang tidak diterima. */
export async function analyzeLogo(buf: Buffer): Promise<LogoReport> {
  const cfg = SPECS.logo;
  if (buf.length > cfg.maxFileBytes) {
    throw new LogoRejected(`Ukuran file melebihi ${Math.round(cfg.maxFileBytes / 1024 / 1024)} MB.`);
  }
  const kind = detectKind(buf);
  if (!kind) throw new LogoRejected("Format tidak didukung. Gunakan SVG atau PNG.");

  const warnings: LogoWarning[] = [];
  let width: number;
  let height: number;
  let rasterSource: Buffer;
  let sanitized: LogoReport["sanitized"];

  if (kind === "png") {
    const meta = await sharp(buf).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
    const longest = Math.max(width, height);
    if (longest < cfg.pngHardWarnBelowPx) {
      warnings.push({ level: "hard", code: "png_resolution_very_low", message: `Resolusi sangat rendah (${width} × ${height} px). Hasil cetak akan pecah; disarankan minimal ${cfg.pngWarnBelowPx} px atau gunakan SVG.` });
    } else if (longest < cfg.pngWarnBelowPx) {
      warnings.push({ level: "warn", code: "png_resolution_low", message: `Resolusi rendah (${width} × ${height} px). Disarankan minimal ${cfg.pngWarnBelowPx} px pada sisi terpanjang, atau gunakan SVG.` });
    }
    rasterSource = buf;
  } else {
    let s;
    try {
      s = sanitizeSvg(buf.toString("utf8"));
    } catch (e) {
      if (e instanceof SvgRejected) throw new LogoRejected(e.message);
      throw e;
    }
    sanitized = { svg: s.svg, removed: s.removed };
    width = s.width ?? s.viewBox?.[2] ?? 0;
    height = s.height ?? s.viewBox?.[3] ?? 0;
    if (s.removed.length) {
      warnings.push({ level: "info", code: "svg_sanitized", message: `Bagian berikut dibuang demi keamanan: ${s.removed.join(", ")}.` });
    }
    if (s.hasRaster) {
      warnings.push({ level: "warn", code: "svg_embedded_raster", message: "SVG berisi gambar raster tertanam; bagian itu tidak benar-benar vektor dan bisa pecah saat dicetak besar." });
    }
    if (s.hasText) {
      warnings.push({ level: "warn", code: "svg_live_text", message: "SVG berisi teks yang belum di-outline. Tampilan bisa berubah bila fontnya tidak terpasang; sebaiknya outline teks di Illustrator." });
    }
    if (!s.viewBox) {
      warnings.push({ level: "info", code: "svg_no_viewbox", message: "SVG tidak punya viewBox; skala logo mungkin kurang tepat." });
    }
    try {
      rasterSource = svgToPng(s.svg, 800);
    } catch {
      throw new LogoRejected("SVG tidak bisa dirender.");
    }
  }

  const raster = await toRaster(rasterSource, 400);
  const st = pixelStats(raster, cfg.minContrastOnBackground);
  const transparent = st.borderOpaqueShare < 0.5 && st.opaqueShare < 0.98;
  const monochrome = st.dominantShare >= 0.85;

  if (st.opaqueShare < 0.002) {
    throw new LogoRejected("Logo tampak kosong (seluruhnya transparan).");
  }
  if (!transparent) {
    warnings.push({ level: "warn", code: "background_not_transparent", message: "Latar logo tidak transparan. Logo akan tampil dengan kotak latarnya di kartu berwarna dan slide gelap; sebaiknya gunakan PNG transparan atau SVG." });
  }

  const onDark: BackgroundCheck = { background: cfg.darkBackground, lowContrastShare: st.lowDarkShare, strategy: decide(st.lowDarkShare, transparent, monochrome) };
  // Logo berlatar (tidak transparan) tampil sebagai kotaknya sendiri; di latar terang dianggap aman.
  const onLight: BackgroundCheck = { background: cfg.lightBackground, lowContrastShare: st.lowLightShare, strategy: transparent ? decide(st.lowLightShare, true, monochrome) : "original" };

  if (onDark.strategy === "mono") warnings.push({ level: "info", code: "dark_variant_mono", message: "Di latar gelap, logo dibuat versi putih agar tetap terbaca." });
  if (onDark.strategy === "plate") warnings.push({ level: "info", code: "dark_variant_plate", message: "Logo berwarna kurang terbaca di latar gelap; akan diletakkan di atas bidang terang. Bila ada versi logo putih resmi, sebaiknya diunggah." });
  if (onDark.strategy === "unavailable") warnings.push({ level: "warn", code: "dark_variant_unavailable", message: "Varian latar gelap tidak bisa dibuat karena latar logo tidak transparan." });
  if (onLight.strategy === "mono") warnings.push({ level: "info", code: "light_variant_mono", message: "Logo terlalu terang untuk latar putih; dibuat versi gelap." });
  if (onLight.strategy === "plate") warnings.push({ level: "info", code: "light_variant_plate", message: "Logo kurang terbaca di latar putih; akan diletakkan di atas bidang gelap." });

  const preview = await toRaster(rasterSource, 600);
  const previews: LogoReport["previews"] = {
    original: await sharp(preview.data, { raw: { width: preview.width, height: preview.height, channels: 4 } }).png().toBuffer(),
  };
  if (onDark.strategy === "mono") previews.monoWhite = await monoPng(preview, "#FFFFFF");
  if (onLight.strategy === "mono") previews.monoDark = await monoPng(preview, SPECS.logo.darkBackground);

  const report: LogoReport = { kind, bytes: buf.length, width, height, warnings, sanitized, transparentBackground: transparent, monochrome, onDark, onLight, previews };
  if (kind === "svg" && monochrome && sanitized && !/<image[\s>]/i.test(sanitized.svg)) {
    report.monoSvg = { white: svgMonochrome(sanitized.svg, "#FFFFFF"), dark: svgMonochrome(sanitized.svg, SPECS.logo.darkBackground) };
  }
  return report;
}
