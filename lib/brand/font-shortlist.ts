import { EXPRESSIVE_LABEL, FONTS, type CatalogFont, type FontCategory } from "./fonts";

/**
 * Seleksi font tahap (a), SPEC bagian 6.3: saring katalog dengan metadata
 * (kategori, tag karakter, klasifikasi gaya, Regular/Bold) lalu ambil shortlist 20-40.
 * Deterministik; masukannya karakter logo hasil analisis visual Claude (font-select.ts).
 */

export const EXPRESSIVE_TAGS = Object.keys(EXPRESSIVE_LABEL) as [string, ...string[]];

/** Klasifikasi gaya yang dipakai di katalog, plus "Serif/Slab" dari kolom stroke. */
export const STYLE_TAGS = [
  "Sans/Geometric",
  "Sans/Humanist",
  "Sans/Grotesque",
  "Sans/Neo Grotesque",
  "Sans/Rounded",
  "Sans/Superellipse",
  "Sans/Glyphic",
  "Serif/Transitional",
  "Serif/Old Style Garalde",
  "Serif/Humanist Venetian",
  "Serif/Modern",
  "Serif/Didone",
  "Serif/Slab",
  "Script/Formal",
  "Script/Handwritten",
  "Script/Informal",
  "Theme/Techno",
  "Monospace/Monospace",
] as const;

export interface ShortlistInput {
  /** Karakter yang dicari, bobot 0-1. */
  wantTags: { tag: string; weight: number }[];
  /** Karakter yang dihindari. */
  avoidTags: string[];
  /** Klasifikasi gaya yang cocok dengan logo. */
  styles: string[];
  headingCategories: FontCategory[];
  bodyCategories: FontCategory[];
}

export interface ScoredFont {
  font: CatalogFont;
  score: number;
  /** Boleh dipakai untuk heading / teks isi menurut kriteria logo. */
  heading: boolean;
  body: boolean;
  /** Alternatif berkarakter lain, disediakan supaya Paket B bisa berbeda jelas dari Paket A. */
  contrast?: boolean;
}

export const SHORTLIST = { max: 30, perHeadingCategory: 3, heading: 22, body: 14, contrastHeading: 4, contrastBody: 2 };

export function stylesOf(f: CatalogFont): string[] {
  return f.stroke === "Slab Serif" ? [...f.styles, "Serif/Slab"] : f.styles;
}

/** Skor kecocokan 0..~1,35. Tag karakter Google Fonts bernilai 0-100. */
export function scoreFont(f: CatalogFont, q: ShortlistInput): number {
  const totalW = q.wantTags.reduce((s, t) => s + t.weight, 0) || 1;
  let s = q.wantTags.reduce((acc, t) => acc + t.weight * ((f.expressive[t.tag] ?? 0) / 100), 0) / totalW;
  for (const t of q.avoidTags) s -= 0.5 * ((f.expressive[t] ?? 0) / 100);
  if (stylesOf(f).some((x) => q.styles.includes(x))) s += 0.25;
  // Sedikit bonus popularitas: font yang lebih matang dan dikenal (peringkat 1 -> 0,1; 2000 -> 0).
  s += 0.1 * Math.max(0, 1 - Math.log(f.popularity) / Math.log(2000));
  return Math.round(s * 1000) / 1000;
}

/**
 * Satu kumpulan kandidat (maks. 30), tiap font muncul sekali:
 * 1. tiap kategori heading yang diizinkan mendapat jatah minimal 3 font teratas;
 * 2. diisi sampai 22 kandidat heading dengan skor tertinggi;
 * 3. ditambah font teks isi (Regular + Bold, sans/serif) sampai minimal 14 kandidat teks isi;
 * 4. ditambah maks. 6 kandidat **kontras** (keputusan pemilik 2026-11-19: Paket B wajib beda karakter):
 *    kategori sans/serif yang tidak dipilih untuk logo ini, atau, bila keduanya sudah dipilih, gaya
 *    huruf yang berbeda dari gaya logo. Total kandidat maks. 36 (SPEC: 20-40).
 */
export function buildShortlist(q: ShortlistInput, fonts: CatalogFont[] = FONTS): ScoredFont[] {
  const headingCats = q.headingCategories.length ? q.headingCategories : (["Sans Serif", "Serif"] as FontCategory[]);
  const bodyCats: FontCategory[] = (q.bodyCategories.length ? q.bodyCategories : (["Sans Serif", "Serif"] as FontCategory[])).filter(
    (c) => c === "Sans Serif" || c === "Serif",
  );
  const scored = fonts
    .map((font) => ({
      font,
      score: scoreFont(font, q),
      heading: headingCats.includes(font.category),
      body: !font.headingOnly && Boolean(font.files.bold) && bodyCats.includes(font.category),
    }))
    .sort((a, b) => b.score - a.score || a.font.popularity - b.font.popularity);

  const pool: ScoredFont[] = [];
  const add = (x: ScoredFont) => pool.length < SHORTLIST.max && !pool.includes(x) && pool.push(x);
  for (const c of headingCats) scored.filter((x) => x.font.category === c).slice(0, SHORTLIST.perHeadingCategory).forEach(add);
  // Sisakan tempat untuk jatah teks isi: font khusus heading hanya ditambah bila jatah itu masih muat.
  const bodyCount = () => pool.filter((p) => p.body).length;
  for (const x of scored) {
    if (!x.heading || pool.filter((p) => p.heading).length >= SHORTLIST.heading) continue;
    if (!x.body && pool.length + 1 + Math.max(0, SHORTLIST.body - bodyCount()) > SHORTLIST.max) continue;
    add(x);
  }
  for (const x of scored) if (x.body && bodyCount() < SHORTLIST.body) add(x);
  pool.sort((a, b) => b.score - a.score);

  // Kandidat kontras untuk Paket B.
  const otherCats = (["Sans Serif", "Serif"] as FontCategory[]).filter((c) => !headingCats.includes(c));
  const isContrast = (f: CatalogFont) =>
    otherCats.length ? otherCats.includes(f.category) : (f.category === "Sans Serif" || f.category === "Serif") && stylesOf(f).length > 0 && !stylesOf(f).some((x) => q.styles.includes(x));
  const canBody = (f: CatalogFont) => !f.headingOnly && Boolean(f.files.bold) && (f.category === "Sans Serif" || f.category === "Serif");
  const fresh = scored.filter((x) => !pool.some((p) => p.font === x.font) && isContrast(x.font));
  const contrast: ScoredFont[] = [];
  for (const x of fresh.slice(0, SHORTLIST.contrastHeading)) contrast.push({ ...x, heading: true, body: canBody(x.font), contrast: true });
  // Pastikan ada kandidat kontras untuk teks isi juga (maks. 6 kandidat kontras).
  for (const x of fresh) {
    if (contrast.filter((c) => c.body).length >= SHORTLIST.contrastBody || contrast.length >= SHORTLIST.contrastHeading + SHORTLIST.contrastBody) break;
    if (canBody(x.font) && !contrast.some((c) => c.font === x.font)) contrast.push({ ...x, heading: true, body: true, contrast: true });
  }
  return [...pool, ...contrast];
}

/**
 * Apakah dua font berbeda karakter: kategori berbeda (mis. sans vs serif), atau kategori sama
 * dengan klasifikasi gaya yang tidak beririsan (mis. Geometric vs Humanist).
 */
export function differentCharacter(a: CatalogFont, b: CatalogFont): boolean {
  if (a.category !== b.category) return true;
  const sa = stylesOf(a), sb = stylesOf(b);
  return sa.length > 0 && sb.length > 0 && !sa.some((x) => sb.includes(x));
}
