/**
 * Palet warna (SPEC bagian 7 langkah 2, Tahap 3b).
 * - Warna logo: k-means di ruang OKLab atas piksel logo (deterministik).
 * - Warna utama: warna berkroma dengan porsi terbesar.
 * - Warna pendukung: aturan harmoni, berbeda untuk Paket A dan Paket B.
 * - Netral: turunan hue warna utama dengan kroma sangat rendah.
 * - Tiap warna: HEX, RGB, CMYK (acuan), dan kontras WCAG.
 */
import {
  contrastRatio,
  deltaE,
  hexToRgb,
  lchToRgb,
  rgbToCmyk,
  rgbToHex,
  rgbToLch,
  rgbToOklab,
  type Lab,
  type Lch,
  type RGB,
} from "./color";

/* ---------------- Ambang (bisa disetel) ---------------- */
/** Kroma OKLCH minimal agar warna dianggap "berwarna" (bukan hitam/abu/putih). */
export const CHROMA_MIN = 0.04;
/** Cluster di bawah porsi ini dibuang (sisa anti-aliasing). */
const MIN_SHARE = 0.02;
/** Cluster yang jaraknya di bawah ini digabung. */
const MERGE_DELTA_E = 8;
/** Warna logo tambahan minimal porsi ini agar ikut dicantumkan. */
const SECONDARY_MIN_SHARE = 0.05;

const WHITE: RGB = [255, 255, 255];

/* ---------------- Ekstraksi warna logo ---------------- */
export interface Raster {
  data: Buffer; // RGBA
  width: number;
  height: number;
}

export interface LogoColor {
  hex: string;
  share: number; // porsi piksel logo, 0..1
  chromatic: boolean;
}

/** PRNG kecil dan deterministik agar hasil k-means selalu sama untuk logo yang sama. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const d2 = (a: Lab, b: Lab) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

function kmeans(points: Lab[], k: number, iterations = 20): { center: Lab; count: number }[] {
  const rand = mulberry32(points.length * 7919 + k);
  // k-means++ seeding.
  const centers: Lab[] = [points[Math.floor(rand() * points.length)]];
  const dist = new Float64Array(points.length).fill(Infinity);
  while (centers.length < k) {
    const last = centers[centers.length - 1];
    let total = 0;
    for (let i = 0; i < points.length; i++) {
      dist[i] = Math.min(dist[i], d2(points[i], last));
      total += dist[i];
    }
    if (total === 0) break;
    let r = rand() * total;
    let idx = 0;
    for (; idx < points.length - 1; idx++) {
      r -= dist[idx];
      if (r <= 0) break;
    }
    centers.push(points[idx]);
  }
  const assign = new Int32Array(points.length);
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = d2(points[i], centers[c]);
        if (d < bd) [bd, best] = [d, c];
      }
      if (assign[i] !== best) [assign[i], moved] = [best, true];
    }
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < points.length; i++) {
      const s = sums[assign[i]];
      s[0] += points[i][0];
      s[1] += points[i][1];
      s[2] += points[i][2];
      s[3]++;
    }
    sums.forEach((s, c) => {
      if (s[3]) centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
    if (!moved && it > 0) break;
  }
  const counts = new Array(centers.length).fill(0);
  for (let i = 0; i < points.length; i++) counts[assign[i]]++;
  return centers.map((center, i) => ({ center, count: counts[i] }));
}

/**
 * Warna-warna logo, urut dari porsi terbesar.
 * `background`: warna latar logo yang tidak transparan (dibuang dari perhitungan).
 */
export function extractLogoColors(r: Raster, background?: RGB, k = 6): LogoColor[] {
  const bgLab = background && rgbToOklab(background);
  const all: Lab[] = [];
  for (let i = 0; i < r.data.length; i += 4) {
    if (r.data[i + 3] < 250) continue; // abaikan tepi semi-transparan (anti-aliasing)
    const lab = rgbToOklab([r.data[i], r.data[i + 1], r.data[i + 2]]);
    if (bgLab && deltaE(lab, bgLab) < 6) continue;
    all.push(lab);
  }
  if (!all.length) return [];
  // Sampel rata maksimal 20.000 piksel agar cepat.
  const step = Math.max(1, Math.floor(all.length / 20000));
  const points = step === 1 ? all : all.filter((_, i) => i % step === 0);

  let clusters = kmeans(points, Math.min(k, points.length)).filter((c) => c.count > 0);
  // Gabungkan cluster yang nyaris sama.
  clusters.sort((a, b) => b.count - a.count);
  const merged: { center: Lab; count: number }[] = [];
  for (const c of clusters) {
    const near = merged.find((m) => deltaE(m.center, c.center) < MERGE_DELTA_E);
    if (near) {
      const n = near.count + c.count;
      near.center = near.center.map((v, i) => (v * near.count + c.center[i] * c.count) / n) as Lab;
      near.count = n;
    } else merged.push({ ...c });
  }
  clusters = merged;
  const total = clusters.reduce((s, c) => s + c.count, 0);
  return clusters
    .map((c) => {
      const lch: Lch = [c.center[0], Math.hypot(c.center[1], c.center[2]), ((Math.atan2(c.center[2], c.center[1]) * 180) / Math.PI + 360) % 360];
      return { hex: rgbToHex(lchToRgb(lch)), share: c.count / total, chromatic: lch[1] >= CHROMA_MIN };
    })
    .filter((c) => c.share >= MIN_SHARE)
    .sort((a, b) => b.share - a.share);
}

/* ---------------- Swatch: HEX/RGB/CMYK + kontras ---------------- */
export type WcagLevel = "AAA" | "AA" | "AA-large" | "fail";

export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA-large";
  return "fail";
}

export interface Swatch {
  role: string;
  name: { id: string; en: string };
  hex: string;
  rgb: RGB;
  cmyk: [number, number, number, number];
  /** Kontras warna ini terhadap putih dan terhadap netral gelap. */
  onWhite: number;
  onDark: number;
  /** Warna teks terbaik bila swatch dipakai sebagai latar. */
  textOn: "white" | "dark";
  textOnRatio: number;
  textOnLevel: WcagLevel;
}

function swatch(role: string, name: Swatch["name"], rgb: RGB, dark: RGB): Swatch {
  const onWhite = contrastRatio(rgb, WHITE);
  const onDark = contrastRatio(rgb, dark);
  const textOn = onWhite >= onDark ? "white" : "dark";
  const textOnRatio = Math.max(onWhite, onDark);
  return { role, name, hex: rgbToHex(rgb), rgb, cmyk: rgbToCmyk(rgb), onWhite, onDark, textOn, textOnRatio, textOnLevel: wcagLevel(textOnRatio) };
}

/* ---------------- Palet ---------------- */
export interface PackagePalette {
  harmony: "analogous" | "split-complementary" | "neutral";
  label: { id: string; en: string };
  supporting: Swatch[];
}

export interface ContrastPair {
  label: { id: string; en: string };
  fg: string;
  bg: string;
  ratio: number;
  level: WcagLevel;
}

export interface Palette {
  /** Logo tanpa warna (hitam/abu/putih saja). */
  achromatic: boolean;
  logoColors: LogoColor[];
  primary: Swatch;
  /** Versi warna utama yang lebih gelap untuk teks di latar putih, bila aslinya < 4,5:1. */
  primaryText?: Swatch;
  /** Warna berkroma lain dari logo (maks 2). */
  logoSecondary: Swatch[];
  neutrals: Swatch[];
  packages: { A: PackagePalette; B: PackagePalette };
  pairs: ContrastPair[];
  notes: { id: string; en: string }[];
}

/**
 * Warna aksen dari hue warna utama + pergeseran harmoni.
 * Lightness dijaga di rentang yang hidup (tidak pucat, tidak keruh); hue kuning-hijau muda
 * (70-115°) dibuat lebih terang karena versi gelapnya tampak cokelat/zaitun.
 */
function accent([L, C, H]: Lch, hueShift: number): RGB {
  const h = (H + hueShift + 360) % 360;
  let l = Math.min(0.72, Math.max(0.58, L));
  if (h >= 70 && h <= 115) l = Math.max(l, 0.8);
  return lchToRgb([l, Math.min(0.18, Math.max(0.1, C)), h]);
}

function tint([, C, H]: Lch): RGB {
  return lchToRgb([0.955, Math.min(C * 0.25, 0.035), H]);
}

/** Gelapkan sampai kontras terhadap putih ≥ target (hue dipertahankan). */
function darkenFor(rgb: RGB, target: number): RGB {
  const [L0, C, H] = rgbToLch(rgb);
  let out = rgb;
  for (let L = L0; L > 0.05 && contrastRatio(out, WHITE) < target; L -= 0.01) out = lchToRgb([L, C, H]);
  return out;
}

export function buildPalette(colors: LogoColor[]): Palette {
  const chromatic = colors.filter((c) => c.chromatic);
  const achromatic = chromatic.length === 0;
  const notes: Palette["notes"] = [
    { id: "Kode CMYK hasil konversi hitungan dan hanya acuan. Hasil cetak perlu proof di percetakan.", en: "CMYK values are calculated conversions for reference only. Print results require a proof." },
  ];

  // Warna utama: berkroma terbesar; bila logo tanpa warna, warna logo terbesar (biasanya hitam).
  const primaryHex = (achromatic ? colors[0]?.hex : chromatic[0].hex) ?? "#212122";
  const primaryRgb = hexToRgb(primaryHex);
  const pLch = rgbToLch(primaryRgb);
  const hue = achromatic ? 0 : pLch[2];
  const nC = achromatic ? 0 : 0.012;

  const neutralDark = lchToRgb([0.24, nC, hue]);
  const sw = (role: string, name: Swatch["name"], rgb: RGB) => swatch(role, name, rgb, neutralDark);

  const primary = sw("primary", { id: "Warna utama", en: "Primary" }, primaryRgb);
  const primaryText =
    !achromatic && primary.onWhite < 4.5
      ? sw("primary-text", { id: "Warna utama untuk teks", en: "Primary for text" }, darkenFor(primaryRgb, 4.5))
      : undefined;

  const logoSecondary = chromatic
    .slice(1)
    .filter((c) => c.share >= SECONDARY_MIN_SHARE)
    .slice(0, 2)
    .map((c, i) => sw(`logo-${i + 2}`, { id: `Warna logo ${i + 2}`, en: `Logo color ${i + 2}` }, hexToRgb(c.hex)));

  const neutrals = [
    sw("neutral-900", { id: "Teks gelap", en: "Dark text" }, neutralDark),
    sw("neutral-500", { id: "Abu sedang", en: "Mid gray" }, lchToRgb([0.56, nC, hue])),
    sw("neutral-200", { id: "Abu terang", en: "Light gray" }, lchToRgb([0.92, nC * 0.6, hue])),
    sw("neutral-50", { id: "Latar terang", en: "Light background" }, lchToRgb([0.985, nC * 0.4, hue])),
  ];

  let A: PackagePalette;
  let B: PackagePalette;
  if (achromatic) {
    // Tanpa hue, aturan harmoni tidak berlaku. Aksen berwarna diusulkan di 3d/3e (berdasarkan bidang usaha).
    A = { harmony: "neutral", label: { id: "Monokrom", en: "Monochrome" }, supporting: [sw("a-1", { id: "Abu gelap", en: "Charcoal" }, lchToRgb([0.38, 0, 0])), sw("a-2", { id: "Abu muda", en: "Silver" }, lchToRgb([0.8, 0, 0]))] };
    B = { harmony: "neutral", label: { id: "Monokrom kontras", en: "High-contrast monochrome" }, supporting: [sw("b-1", { id: "Hitam pekat", en: "Deep black" }, lchToRgb([0.16, 0, 0])), sw("b-2", { id: "Putih hangat", en: "Warm white" }, lchToRgb([0.97, 0.01, 85]))] };
    notes.push({ id: "Logo tanpa warna: warna pendukung sementara berupa netral. Aksen berwarna akan diusulkan berdasarkan bidang usaha (Tahap 3d/3e).", en: "Achromatic logo: supporting colors are neutral for now. Colored accents will be proposed from the industry (Stage 3d/3e)." });
  } else {
    // Paket A setia pada logo: warna logo lain dipakai dulu sebagai aksen, sisanya analogus.
    const analogous = [accent(pLch, 30), accent(pLch, -30)];
    const aAccents = [...logoSecondary.map((x) => x.rgb), ...analogous].slice(0, 2);
    A = {
      harmony: "analogous",
      label: logoSecondary.length
        ? { id: "Warna logo + analogus (setia logo, harmonis)", en: "Logo colors + analogous (faithful, cohesive)" }
        : { id: "Analogus (harmonis, tenang)", en: "Analogous (calm, cohesive)" },
      supporting: [
        ...aAccents.map((rgb, i) => sw(`a-${i + 1}`, { id: `Aksen ${i + 1}`, en: `Accent ${i + 1}` }, rgb)),
        sw("a-3", { id: "Latar lembut", en: "Soft background" }, tint(pLch)),
      ],
    };
    B = {
      harmony: "split-complementary",
      label: { id: "Komplementer terbelah (kontras, berani)", en: "Split-complementary (bold, contrasting)" },
      supporting: [
        sw("b-1", { id: "Aksen 1", en: "Accent 1" }, accent(pLch, 150)),
        sw("b-2", { id: "Aksen 2", en: "Accent 2" }, accent(pLch, 210)),
        sw("b-3", { id: "Latar lembut", en: "Soft background" }, tint([pLch[0], pLch[1], (pLch[2] + 180) % 360])),
      ],
    };
  }

  const pair = (label: ContrastPair["label"], fg: Swatch | RGB, bg: Swatch | RGB): ContrastPair => {
    const f = Array.isArray(fg) ? fg : fg.rgb;
    const b = Array.isArray(bg) ? bg : bg.rgb;
    const ratio = contrastRatio(f, b);
    return { label, fg: rgbToHex(f), bg: rgbToHex(b), ratio, level: wcagLevel(ratio) };
  };
  const [nDark, nMid, , nLight] = neutrals;
  const textOnPrimary = primary.textOn === "white" ? WHITE : nDark.rgb;
  const pairs: ContrastPair[] = [
    pair({ id: "Teks gelap di latar terang", en: "Dark text on light background" }, nDark, nLight),
    pair({ id: "Teks abu sedang di putih (keterangan)", en: "Mid gray text on white (captions)" }, nMid, WHITE),
    pair({ id: "Warna utama di putih (judul/aksen)", en: "Primary on white (headings/accents)" }, primary, WHITE),
    ...(primaryText ? [pair({ id: "Warna utama versi teks di putih", en: "Primary text variant on white" }, primaryText, WHITE)] : []),
    pair({ id: `Teks ${primary.textOn === "white" ? "putih" : "gelap"} di warna utama (tombol/kartu)`, en: `${primary.textOn === "white" ? "White" : "Dark"} text on primary (buttons/cards)` }, textOnPrimary, primary),
    pair({ id: "Putih di netral gelap (latar gelap)", en: "White on dark neutral (dark backgrounds)" }, WHITE, nDark),
  ];

  return { achromatic, logoColors: colors, primary, primaryText, logoSecondary, neutrals, packages: { A, B }, pairs, notes };
}
