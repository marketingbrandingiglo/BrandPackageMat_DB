import type { FontRef } from "@/lib/brand/font-select";
import { FONTS } from "@/lib/brand/fonts";
import type { Swatch } from "@/lib/brand/palette";
import type { PackageTone, Tone } from "@/lib/brand/tone";
import { escapeXml } from "@/lib/render/escape";
import { checkLayout, type CheckIssue } from "./checks";
import { kitColors, type BrandKit } from "./kit";
import { placeLogo } from "./logo";
import { placeVisual } from "./visual";
import { fit, r, text, wrap, type Box, type TextStyle } from "./text";
import type { Lang } from "./types";

/**
 * Tahap 4g: brand guideline PDF per paket (SPEC bagian 5 dan 6), A4 portrait, satu SVG per halaman
 * (PDF dirender dari SVG yang sama, font brand ditanam). Halaman: sampul, logo, warna, tipografi,
 * tone of voice, contoh kalimat + catatan pemakaian. Teks memakai font paket itu sendiri.
 */
export const GUIDELINE_SIZE = { widthMm: 210, heightMm: 297 };
const W = GUIDELINE_SIZE.widthMm;
const H = GUIDELINE_SIZE.heightMm;
const M = 20;
const CW = W - 2 * M;
const BOTTOM = H - 22;
const SAFE = { x: M - 0.5, y: 8, w: CW + 1, h: H - 16 };

type L = { id: string; en: string };
const T = {
  guideline: { id: "Panduan Brand", en: "Brand Guidelines" },
  pkg: { id: "Paket", en: "Package" },
  made: { id: "Dibuat", en: "Created" },
  coverNote: {
    id: "Panduan ini adalah usulan awal identitas visual dan gaya bahasa. Warna, font, dan tone of voice sebaiknya diuji dan disesuaikan sebelum dipakai luas.",
    en: "These guidelines are an initial proposal for the visual identity and voice. Test and adjust the colors, fonts, and tone of voice before wide use.",
  },
  logo: { id: "Logo", en: "Logo" },
  logoIntro: {
    id: "Logo adalah tanda pengenal utama. Pakai file asli dari paket ini dan jangan menggambar ulang.",
    en: "The logo is the main identifier. Use the original files in this package and do not redraw it.",
  },
  clear: { id: "Area bebas", en: "Clear space" },
  clearDesc: {
    id: "Sisakan ruang kosong minimal x di setiap sisi logo (x = seperempat tinggi logo). Teks, gambar, dan tepi halaman tidak boleh masuk area ini.",
    en: "Keep at least x of empty space on every side of the logo (x = a quarter of the logo height). Text, images, and page edges must stay outside this area.",
  },
  minSize: { id: "Ukuran minimum", en: "Minimum size" },
  minDesc: (print: number, px: number): L => ({
    id: `Cetak: lebar minimal ${print} mm. Layar: lebar minimal ${px} px. Di bawah ukuran ini logo sulit terbaca.`,
    en: `Print: at least ${print} mm wide. Screen: at least ${px} px wide. Below this size the logo is hard to read.`,
  }),
  onLight: { id: "Di latar putih", en: "On white" },
  onTint: { id: "Di latar terang", en: "On a light background" },
  avoid: { id: "Hindari", en: "Avoid" },
  logoDont: [
    { id: "Mengubah warna logo di luar palet atau versi satu warna.", en: "Changing the logo colors outside the palette or the one-color version." },
    { id: "Merentangkan, memampatkan, atau memutar logo.", en: "Stretching, squashing, or rotating the logo." },
    { id: "Menambah bayangan, garis tepi, gradasi, atau efek lain.", en: "Adding shadows, outlines, gradients, or other effects." },
    { id: "Menaruh logo di atas foto atau latar yang ramai dan kurang kontras.", en: "Placing the logo on busy photos or low-contrast backgrounds." },
  ],
  colors: { id: "Warna", en: "Colors" },
  colorsIntro: {
    id: "Warna utama diambil dari logo. Aksen dan netral melengkapi warna utama; pakai warna utama paling banyak, aksen secukupnya.",
    en: "The primary color comes from the logo. Accents and neutrals support it; use the primary color most, accents sparingly.",
  },
  gMain: { id: "Warna utama dan warna logo", en: "Primary and logo colors" },
  gAccent: { id: "Aksen paket", en: "Package accents" },
  gNeutral: { id: "Netral", en: "Neutrals" },
  pairs: { id: "Pasangan teks dan latar (kontras WCAG)", en: "Text and background pairs (WCAG contrast)" },
  cmykNote: {
    id: "Kode CMYK hasil konversi hitungan dan hanya acuan. Minta proof cetak di percetakan sebelum mencetak banyak.",
    en: "CMYK values are calculated conversions for reference only. Ask the printer for a proof before a large print run.",
  },
  type: { id: "Tipografi", en: "Typography" },
  typeIntro: {
    id: "Dua font Google: satu untuk judul, satu untuk teks isi. Pasang keduanya di komputer sebelum membuka file SVG, DOCX, atau PPTX.",
    en: "Two Google fonts: one for headings, one for body text. Install both before opening the SVG, DOCX, or PPTX files.",
  },
  heading: { id: "Judul", en: "Headings" },
  body: { id: "Teks isi", en: "Body text" },
  download: { id: "Unduh", en: "Download" },
  license: { id: "Lisensi", en: "License" },
  hierarchy: { id: "Hierarki teks (dokumen)", en: "Text hierarchy (documents)" },
  h1: { id: "Judul utama", en: "Main heading" },
  h2: { id: "Subjudul", en: "Subheading" },
  p: {
    id: "Teks isi untuk paragraf surat, presentasi, dan dokumen. Kalimat pendek lebih mudah dibaca.",
    en: "Body text for letters, presentations, and documents. Short sentences are easier to read.",
  },
  caption: { id: "Keterangan dan catatan kecil", en: "Captions and small notes" },
  emailFont: (f: string): L => ({
    id: `Di email signature, klien email menampilkan font cadangan (${f}).`,
    en: `In the email signature, email apps show the fallback font (${f}).`,
  }),
  tone: { id: "Tone of voice", en: "Tone of voice" },
  toneNote: {
    id: "Hipotesis dari kesan logo dan bidang usaha. Uji ke pelanggan dan sesuaikan.",
    en: "A hypothesis based on the logo and industry. Test it with customers and adjust.",
  },
  personality: { id: "Kepribadian", en: "Personality" },
  voice: { id: "Cara bicara", en: "Voice" },
  address: { id: "Sapaan", en: "Address" },
  formality: { id: "Formalitas", en: "Formality" },
  sentences: { id: "Kalimat", en: "Sentences" },
  do: { id: "Lakukan", en: "Do" },
  dont: { id: "Hindari", en: "Don't" },
  examples: { id: "Contoh kalimat", en: "Example copy" },
  taglines: { id: "Tagline", en: "Taglines" },
  emailOpening: { id: "Pembuka email", en: "Email opening" },
  cta: { id: "Ajakan (CTA)", en: "Call to action" },
  about: { id: "Tentang kami", en: "About us" },
  noTone: {
    id: "Tone of voice belum tersedia untuk job ini (dibuat sebelum Tahap 3e). Jalankan ulang pemilihan font dan tone.",
    en: "No tone of voice for this job (created before stage 3e). Run the font and tone selection again.",
  },
  usage: { id: "Isi paket dan catatan", en: "Package contents and notes" },
  contents: [
    { id: "Kartu nama, ID card (landscape dan portrait), amplop, cap: SVG (bisa diedit di Illustrator) + PDF.", en: "Business card, ID card (landscape and portrait), envelope, stamp: SVG (editable in Illustrator) + PDF." },
    { id: "Kop surat: DOCX (Word, header dan footer asli) + PDF kertas kop.", en: "Letterhead: DOCX (Word, real header and footer) + letterhead paper PDF." },
    { id: "Template presentasi: PPTX dengan warna dan font tema.", en: "Presentation template: PPTX with theme colors and fonts." },
    { id: "Email signature: HTML + logo-email.png.", en: "Email signature: HTML + logo-email.png." },
  ],
  notes: [
    { id: "File SVG, DOCX, dan PPTX memakai teks hidup: pasang font di halaman Tipografi agar tampil benar.", en: "SVG, DOCX, and PPTX files use live text: install the fonts on the Typography page so they display correctly." },
    { id: "File cetak seukuran jadi (tanpa bleed) dengan area aman 4 mm dari tepi. Ukuran adalah ukuran umum; cek ke percetakan.", en: "Print files are at finished size (no bleed) with a 4 mm safe area from the edge. Sizes are common sizes; check with your printer." },
    { id: "SVG hanya RGB. Kode CMYK di halaman Warna adalah acuan untuk percetakan.", en: "SVGs are RGB only. The CMYK values on the Colors page are a reference for the printer." },
    { id: "Cap adalah desain, bukan stempel yang sah secara hukum.", en: "The stamp is a design, not a legally valid seal." },
  ],
  pngStamp: {
    id: "Logo diunggah sebagai PNG: cap dan materi lain memakai gambar raster. Untuk hasil cetak paling tajam, ganti logo di file SVG dengan versi vektor (SVG/AI) dari desainer.",
    en: "The logo was uploaded as a PNG: the stamp and other materials use a raster image. For the sharpest print, replace the logo in the SVG files with a vector version (SVG/AI) from your designer.",
  },
} as const;

const FORMALITY_LABEL: Record<PackageTone["voice"]["formality"], L> = {
  formal: { id: "Formal", en: "Formal" },
  "semi-formal": { id: "Semi formal", en: "Semi-formal" },
  "semi-casual": { id: "Semi santai", en: "Semi-casual" },
  casual: { id: "Santai", en: "Casual" },
};

export interface GuidelineInput {
  tone?: Tone;
  generatedAt?: Date;
}

/** Satu halaman: elemen SVG + kotak teks untuk pengecekan; `y` = kursor alur teks. */
class Page {
  parts: string[] = [];
  boxes: Box[] = [];
  y = 30;
  constructor(public bg = "#FFFFFF") {
    this.parts.push(`<rect id="latar" width="${W}" height="${H}" fill="${bg}"/>`);
  }
  add(svg: string) {
    this.parts.push(svg);
  }
  t(id: string, value: string, x: number, y: number, s: TextStyle, bg = this.bg) {
    const e = text(id, value, x, y, s, bg);
    this.parts.push(e.svg);
    this.boxes.push(e.box);
    return e.box;
  }
  /** Paragraf dibungkus mulai kursor y; mengembalikan y setelahnya. */
  para(id: string, value: string, s: TextStyle, x = M, w = CW, lh = 1.5, y = this.y, bg = this.bg): number {
    const lines = wrap(value, s, w, 30);
    lines.forEach((ln, i) => this.t(`${id}-${i + 1}`, ln, x, y + s.size * 0.75 + i * s.size * lh, s, bg));
    return y + s.size * (0.75 + (lines.length - 1) * lh) + s.size * 0.6;
  }
  flow(id: string, value: string, s: TextStyle, gap = 2.5, x = M, w = CW) {
    this.y = this.para(id, value, s, x, w) + gap;
  }
  /** Tanda centang atau silang digambar sebagai garis (tidak bergantung glyph font). */
  mark(kind: "ok" | "no", x: number, y: number, color: string) {
    const d = kind === "ok" ? `M${r(x)} ${r(y + 1.4)} l1 1.1 l2 -2.5` : `M${r(x + 0.2)} ${r(y)} l2.4 2.4 M${r(x + 2.6)} ${r(y)} l-2.4 2.4`;
    this.parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="0.45" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  rect(x: number, y: number, w: number, h: number, fill: string, extra = "") {
    this.parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${fill}"${extra}/>`);
  }
}

const loc = (l: L, lang: Lang) => l[lang];

function fontInfo(f: FontRef) {
  const c = FONTS.find((x) => x.family === f.family);
  return { license: c?.license === "Apache-2.0" ? "Apache 2.0" : "SIL Open Font License", url: `fonts.google.com/specimen/${f.family.replace(/ /g, "+")}` };
}

export function emailFallback(f: FontRef): string {
  return f.category === "Serif" ? "Georgia" : f.category === "Monospace" ? "Courier New" : "Arial";
}

export function guideline(kit: BrandKit, input: GuidelineInput = {}): { pages: string[]; issues: CheckIssue[] } {
  const lang = kit.lang;
  const k = kitColors(kit);
  const tx = (l: L) => loc(l, lang);
  const isB = kit.pkg === "B";
  const hf = kit.fonts.heading;
  const bf = kit.fonts.body;
  const st = (size: number, color = k.dark, bold = false, font = bf): TextStyle => ({ font, size, color, bold });
  const H1 = (color = k.dark) => st(9, color, true, hf);
  const H2 = st(5, k.primaryText, true, hf);
  const H3 = st(3.8, k.dark, true, bf);
  const BODY = st(3.3);
  const SMALL = st(2.8, k.mid);
  const pkgTone = input.tone?.[kit.pkg];
  const date = (input.generatedAt ?? new Date()).toLocaleDateString(lang === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const pages: Page[] = [];
  const issues: CheckIssue[] = [];

  const header = (p: Page, title: L, intro?: L) => {
    if (isB) p.rect(0, 0, W, 4, k.primary);
    else p.rect(M, 16, 14, 1.4, k.primary);
    p.y = 30;
    p.t("judul", tx(title), M, p.y + 9 * 0.75, H1());
    p.y += 14;
    if (intro) p.flow("pengantar", tx(intro), st(3.5, k.mid), 6);
  };

  /* ---------- 1. Sampul ---------- */
  {
    const bg = isB ? k.primary : "#FFFFFF";
    const fg = isB ? k.onPrimary : k.dark;
    const p = new Page(bg);
    // Visual dekoratif (Tahap 5): pita atas, di luar area logo dan teks.
    if (kit.visual) p.add(placeVisual(kit.visual, isB ? { x: 0, y: 0, w: W, h: 32 } : { x: 10, y: 0, w: W - 10, h: 34 }, "sampul"));
    if (isB) {
      // Logo di pelat putih (warna logo asli tetap terbaca di atas warna utama).
      p.rect(M, 40, CW, 90, "#FFFFFF", ` rx="4"`);
      p.add(`<g id="logo">${placeLogo(kit.logo, { x: M + 25, y: 55, w: CW - 50, h: 60 }).svg}</g>`);
      p.rect(M, 150, 30, 2, k.accent);
    } else {
      p.rect(0, 0, 10, H, k.primary);
      p.add(`<g id="logo">${placeLogo(kit.logo, { x: M + 6, y: 50, w: CW - 30, h: 70 }, "start").svg}</g>`);
      p.rect(M + 6, 150, 30, 2, k.accent);
    }
    const x = isB ? M : M + 6;
    const nameS = fit(kit.company.name, st(10, fg, true, hf), CW - 6, 6);
    const lines = wrap(kit.company.name, nameS, CW - 6, 2);
    lines.forEach((ln, i) => p.t(`nama-${i + 1}`, ln, x, 168 + i * nameS.size * 1.25, nameS));
    let y = 168 + (lines.length - 1) * nameS.size * 1.25 + 12;
    p.t("dokumen", `${tx(T.guideline)} · ${tx(T.pkg)} ${kit.pkg}`, x, y, st(5.5, fg, false, bf));
    y += 8;
    if (pkgTone) y = p.para("nuansa", pkgTone.summary[lang], st(3.4, fg), x, CW - 6, 1.5, y) + 2;
    p.t("tanggal", `${tx(T.made)} ${date}`, x, BOTTOM - 14, st(2.9, fg));
    p.para("catatan-sampul", tx(T.coverNote), st(2.7, fg), x, CW - 6, 1.45, BOTTOM - 9);
    pages.push(p);
  }

  /* ---------- 2. Logo ---------- */
  {
    const p = new Page();
    header(p, T.logo, T.logoIntro);
    const boxH = 70;
    const top = p.y;
    // Kiri: area bebas (garis putus-putus) di latar putih. Kanan: latar terang.
    const colW = (CW - 8) / 2;
    p.rect(M, top, colW, boxH, "#FFFFFF", ` stroke="${k.light}" stroke-width="0.3"`);
    const lg = placeLogo(kit.logo, { x: M + 16, y: top + 18, w: colW - 32, h: boxH - 36 });
    const xpad = lg.h / 4;
    p.add(`<g id="logo-area-bebas">${lg.svg}</g>`);
    p.add(
      `<rect x="${r(lg.x - xpad)}" y="${r(lg.y - xpad)}" width="${r(lg.w + 2 * xpad)}" height="${r(lg.h + 2 * xpad)}" fill="none" stroke="${k.primaryText}" stroke-width="0.25" stroke-dasharray="1.2 0.8"/>`,
    );
    p.t("label-x", "x", lg.x - xpad / 2, lg.y + lg.h / 2 + 1, { ...st(2.6, k.primaryText, true), anchor: "middle" });
    p.rect(M + colW + 8, top, colW, boxH, k.tint);
    p.add(`<g id="logo-latar-terang">${placeLogo(kit.logo, { x: M + colW + 24, y: top + 18, w: colW - 32, h: boxH - 36 }).svg}</g>`);
    p.t("cap-putih", tx(T.onLight), M, top + boxH + 5, SMALL);
    p.t("cap-terang", tx(T.onTint), M + colW + 8, top + boxH + 5, SMALL);
    p.y = top + boxH + 14;
    p.t("area-bebas", tx(T.clear), M, p.y, H3);
    p.y += 3;
    p.flow("area-bebas-isi", tx(T.clearDesc), BODY, 5);
    const wide = kit.logo.aspect >= 1.6;
    const print = kit.logo.hasText ? (wide ? 25 : 18) : 12;
    const px = kit.logo.hasText ? (wide ? 100 : 72) : 48;
    p.t("ukuran-min", tx(T.minSize), M, p.y, H3);
    p.y += 3;
    p.flow("ukuran-min-isi", tx(T.minDesc(print, px)), BODY, 5);
    p.t("hindari", tx(T.avoid), M, p.y, H3);
    p.y += 3;
    T.logoDont.forEach((d, i) => {
      p.mark("no", M, p.y + 0.4, k.primaryText);
      p.y = p.para(`hindari-${i + 1}`, tx(d), BODY, M + 5, CW - 5) + 1.2;
    });
    pages.push(p);
  }

  /* ---------- 3. Warna ---------- */
  {
    const p = new Page();
    header(p, T.colors, T.colorsIntro);
    const pal = kit.palette;
    const main = [pal.primary, ...(pal.primaryText ? [pal.primaryText] : []), ...pal.logoSecondary].slice(0, 4);
    const groups: [L, Swatch[]][] = [
      [T.gMain, main],
      [{ id: `${T.gAccent.id} ${kit.pkg}: ${pal.packages[kit.pkg].label.id}`, en: `${T.gAccent.en} ${kit.pkg}: ${pal.packages[kit.pkg].label.en}` }, pal.packages[kit.pkg].supporting],
      [T.gNeutral, pal.neutrals],
    ];
    const cols = 4;
    const gap = 5;
    const cw = (CW - (cols - 1) * gap) / cols;
    groups.forEach(([label, sw], gi) => {
      if (!sw.length) return;
      p.t(`grup-${gi + 1}`, tx(label), M, p.y + 2.8, st(3.6, k.dark, true));
      p.y += 6;
      sw.forEach((s, i) => {
        const col = i % cols;
        if (col === 0 && i > 0) p.y += 33;
        const x = M + col * (cw + gap);
        const y = p.y;
        p.rect(x, y, cw, 14, s.hex, s.onWhite < 1.3 ? ` stroke="${k.light}" stroke-width="0.3"` : "");
        const nm = fit(s.name[lang], st(2.9, k.dark, true), cw, 2.3);
        p.t(`warna-${gi + 1}-${i + 1}`, s.name[lang], x, y + 18.5, nm);
        p.t(`warna-${gi + 1}-${i + 1}-hex`, `HEX ${s.hex.toUpperCase()}`, x, y + 22.5, st(2.5, k.dark));
        p.t(`warna-${gi + 1}-${i + 1}-rgb`, `RGB ${s.rgb.join(" ")}`, x, y + 26, st(2.5, k.mid));
        p.t(`warna-${gi + 1}-${i + 1}-cmyk`, `CMYK ${s.cmyk.join(" ")}`, x, y + 29.5, st(2.5, k.mid));
      });
      p.y += 38;
    });
    p.t("pasangan", tx(T.pairs), M, p.y + 2.8, st(3.6, k.dark, true));
    p.y += 6;
    for (const [i, pr] of pal.pairs.entries()) {
      p.rect(M, p.y, 12, 6, pr.bg, pr.bg.toUpperCase() === "#FFFFFF" ? ` stroke="${k.light}" stroke-width="0.3"` : "");
      p.t(`pasangan-${i + 1}-contoh`, "Aa", M + 6, p.y + 4.2, { ...st(3.4, pr.fg, true), anchor: "middle" }, pr.bg);
      p.t(`pasangan-${i + 1}`, `${pr.label[lang]} · ${pr.ratio.toFixed(1)}:1 · ${pr.level === "fail" ? (lang === "id" ? "kurang" : "fail") : pr.level}`, M + 16, p.y + 4.2, st(2.9, k.dark));
      p.y += 8;
    }
    p.y += 2;
    p.flow("catatan-cmyk", tx(T.cmykNote), SMALL);
    pages.push(p);
  }

  /* ---------- 4. Tipografi ---------- */
  {
    const p = new Page();
    header(p, T.type, T.typeIntro);
    const block = (id: string, role: L, f: FontRef) => {
      const info = fontInfo(f);
      p.t(`${id}-peran`, `${tx(role)} · ${f.category}`, M, p.y + 2.8, st(3, k.primaryText, true));
      p.y += 5;
      const nameS = fit(f.family, st(11, k.dark, true, f), CW, 6);
      p.t(`${id}-nama`, f.family, M, p.y + nameS.size * 0.8, nameS);
      p.y += nameS.size + 3;
      p.t(`${id}-regular`, "AaBbCcDdEeFfGgHh 0123456789", M, p.y + 4.5, fit("AaBbCcDdEeFfGgHh 0123456789", st(6, k.dark, false, f), CW, 3.5));
      p.y += 8.5;
      if (f.bold) {
        p.t(`${id}-bold`, "AaBbCcDdEeFfGgHh 0123456789", M, p.y + 4.5, fit("AaBbCcDdEeFfGgHh 0123456789", st(6, k.dark, true, f), CW, 3.5));
        p.y += 8.5;
      }
      p.t(`${id}-unduh`, `${tx(T.download)}: ${info.url}  ·  ${tx(T.license)}: ${info.license}`, M, p.y + 2.5, st(2.8, k.mid));
      p.y += 9;
    };
    block("font-judul", T.heading, hf);
    p.rect(M, p.y - 3, CW, 0.3, k.light);
    p.y += 3;
    block("font-isi", T.body, bf);
    p.rect(M, p.y - 3, CW, 0.3, k.light);
    p.y += 3;
    p.t("hierarki", tx(T.hierarchy), M, p.y + 2.8, st(3.6, k.dark, true));
    p.y += 9;
    const rows: [string, string, TextStyle][] = [
      ["24-28 pt", tx(T.h1), st(8.5, k.dark, true, hf)],
      ["16-18 pt", tx(T.h2), st(5.6, k.primaryText, true, hf)],
      ["10-11 pt", tx(T.p), st(3.6, k.dark, false, bf)],
      ["8-9 pt", tx(T.caption), st(2.9, k.mid, false, bf)],
    ];
    rows.forEach(([size, sample, s], i) => {
      p.t(`hierarki-${i + 1}-ukuran`, size, M, p.y + s.size * 0.75, st(2.6, k.mid));
      p.y = p.para(`hierarki-${i + 1}`, sample, s, M + 22, CW - 22, 1.35) + 4;
    });
    p.flow("font-email", tx(T.emailFont(`${emailFallback(hf)}, ${emailFallback(bf)}`.replace(/^(\w[\w ]*), \1$/, "$1"))), SMALL);
    pages.push(p);
  }

  /* ---------- 5. Tone of voice ---------- */
  {
    const p = new Page();
    header(p, T.tone, pkgTone ? T.toneNote : undefined);
    if (!pkgTone) {
      p.flow("tanpa-tone", tx(T.noTone), BODY);
    } else {
      p.flow("ringkasan", pkgTone.summary[lang], st(4.2, k.dark, false, hf), 6);
      p.t("kepribadian", tx(T.personality), M, p.y, H3);
      p.y += 4;
      const cw = (CW - 10) / 3;
      const start = p.y;
      let end = start;
      pkgTone.personality.forEach((t, i) => {
        const x = M + i * (cw + 5);
        p.rect(x, start, cw, 1.2, i === 0 ? k.primary : k.accent);
        p.t(`sifat-${i + 1}`, t.trait[lang], x, start + 7, fit(t.trait[lang], st(3.8, k.dark, true, hf), cw, 2.8));
        end = Math.max(end, p.para(`sifat-${i + 1}-isi`, t.desc[lang], st(3, k.dark), x, cw, 1.45, start + 9.5));
      });
      p.y = end + 5;
      p.t("cara-bicara", tx(T.voice), M, p.y, H3);
      p.y += 4;
      const kv = (id: string, label: L, value: string) => {
        p.t(`${id}-label`, tx(label), M, p.y + 3.2 * 0.75, st(3.2, k.mid, true));
        p.y = p.para(id, value, st(3.2), M + 28, CW - 28) + 1.5;
      };
      kv("sapaan", T.address, pkgTone.voice.address[lang]);
      kv("formalitas", T.formality, FORMALITY_LABEL[pkgTone.voice.formality][lang]);
      kv("kalimat", T.sentences, pkgTone.voice.sentences[lang]);
      p.y += 4;
      const half = (CW - 8) / 2;
      const top = p.y;
      let yl = top;
      let yr = top;
      p.t("lakukan", tx(T.do), M, top, st(3.8, k.primaryText, true));
      p.t("jangan", tx(T.dont), M + half + 8, top, st(3.8, k.dark, true));
      yl += 4;
      yr += 4;
      pkgTone.do.forEach((d, i) => {
        p.mark("ok", M, yl + 0.3, k.primaryText);
        yl = p.para(`lakukan-${i + 1}`, d[lang], st(3.1), M + 5, half - 5, 1.45, yl) + 1.5;
      });
      pkgTone.dont.forEach((d, i) => {
        p.mark("no", M + half + 8, yr + 0.3, k.dark);
        yr = p.para(`jangan-${i + 1}`, d[lang], st(3.1), M + half + 13, half - 5, 1.45, yr) + 1.5;
      });
      p.y = Math.max(yl, yr) + 3;
      if (input.tone) p.flow("dasar", input.tone.basis[lang], SMALL);
    }
    pages.push(p);
  }

  /* ---------- 6. Contoh kalimat + isi paket ---------- */
  {
    const p = new Page();
    if (pkgTone) {
      header(p, T.examples);
      const ex = pkgTone.examples;
      const item = (id: string, label: L | null, value: string, s: TextStyle = BODY) => {
        if (label) {
          p.t(`${id}-label`, tx(label), M, p.y, st(3, k.primaryText, true));
          p.y += 2.5;
        }
        p.flow(id, value, s, 4);
      };
      ex.taglines.forEach((t, i) => item(`tagline-${i + 1}`, i === 0 ? T.taglines : null, `“${t[lang]}”`, st(4.6, k.dark, true, hf)));
      item("pembuka-email", T.emailOpening, ex.emailOpening[lang]);
      item("cta", T.cta, ex.cta[lang], st(3.6, k.dark, true));
      item("tentang", T.about, ex.about[lang]);
      p.y += 2;
      p.rect(M, p.y, CW, 0.3, k.light);
      p.y += 8;
      p.t("isi-paket", tx(T.usage), M, p.y + 5 * 0.75, H2);
      p.y += 9;
    } else {
      header(p, T.usage);
    }
    const bullet = (id: string, value: string) => {
      p.rect(M, p.y + 1, 1.6, 1.6, k.accent);
      p.y = p.para(id, value, st(3.1), M + 5, CW - 5) + 1.5;
    };
    T.contents.forEach((c, i) => bullet(`isi-${i + 1}`, tx(c)));
    p.y += 3;
    const notes = [...T.notes.map(tx), ...(kit.logo.kind === "png" ? [tx(T.pngStamp)] : [])];
    notes.forEach((n, i) => bullet(`catatan-${i + 1}`, n));
    pages.push(p);
  }

  // Footer, pengecekan, dan susun SVG.
  const out = pages.map((p, i) => {
    if (i > 0) {
      const fs = st(2.5, k.mid);
      p.rect(M, H - 15, CW, 0.25, k.light);
      p.t("footer-kiri", kit.company.name, M, H - 10.5, fit(kit.company.name, fs, CW - 70, 1.8));
      p.t("footer-kanan", `${tx(T.guideline)} · ${tx(T.pkg)} ${kit.pkg} · ${i + 1}`, W - M, H - 10.5, { ...fs, anchor: "end" });
    }
    const flowBoxes = p.boxes.filter((b) => !b.id.startsWith("footer"));
    if (flowBoxes.some((b) => b.y + b.h > BOTTOM)) issues.push({ code: "outside-safe-area", message: `Halaman ${i + 1}: isi melewati batas bawah.` });
    for (const x of checkLayout(p.boxes, SAFE)) issues.push({ ...x, message: `Halaman ${i + 1}: ${x.message}` });
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
  <title>${escapeXml(`${kit.company.name} - ${tx(T.guideline)} ${kit.pkg} - ${i + 1}`)}</title>
  ${p.parts.join("\n  ")}
</svg>`;
  });
  return { pages: out, issues };
}

