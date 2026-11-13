/** Utilitas warna dan kontras WCAG 2.x. */
export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as RGB;
}

export function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, g, b]: RGB): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/* ---------- OKLab / OKLCH (ruang warna perseptual, Björn Ottosson 2020) ---------- */
export type Lab = [number, number, number];
export type Lch = [number, number, number]; // L 0..1, C ≥ 0, H derajat

const toLin = (c: number) => channel(c);
const fromLin = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function rgbToOklab([r8, g8, b8]: RGB): Lab {
  const r = toLin(r8), g = toLin(g8), b = toLin(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab -> sRGB tanpa clamp (nilai di luar 0..255 berarti di luar gamut). */
export function oklabToRgbRaw([L, A, B]: Lab): RGB {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    fromLin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export const labToLch = ([L, a, b]: Lab): Lch => [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
export const lchToLab = ([L, C, H]: Lch): Lab => [L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)];

const inGamut = (rgb: RGB) => rgb.every((v) => v >= -0.5 && v <= 255.5);

/** OKLCH -> sRGB; chroma dikurangi sampai masuk gamut sRGB (hue dan lightness dipertahankan). */
export function lchToRgb([L, C, H]: Lch): RGB {
  let c = C;
  let rgb = oklabToRgbRaw(lchToLab([L, c, H]));
  while (!inGamut(rgb) && c > 0) {
    c = Math.max(0, c - 0.002);
    rgb = oklabToRgbRaw(lchToLab([L, c, H]));
  }
  return rgb.map((v) => Math.min(255, Math.max(0, Math.round(v)))) as RGB;
}

export const rgbToLch = (rgb: RGB): Lch => labToLch(rgbToOklab(rgb));

/** Jarak warna perseptual (ΔE OKLab × 100; < ~2 nyaris tak terbedakan). */
export function deltaE(a: Lab, b: Lab): number {
  return 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** CMYK naif dari RGB (persen, dibulatkan). HANYA ACUAN: hasil cetak perlu proof. */
export function rgbToCmyk([r, g, b]: RGB): [number, number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const k = 1 - Math.max(R, G, B);
  if (k >= 1) return [0, 0, 0, 100];
  const f = (x: number) => Math.round(((1 - x - k) / (1 - k)) * 100);
  return [f(R), f(G), f(B), Math.round(k * 100)];
}
