import catalog from "@/data/fonts/catalog.json";

/**
 * Katalog font terkurasi (SPEC bagian 6.3). Dibuat oleh `npm run fonts:build`
 * dari data/fonts/families.txt; file font ada di fonts/lib/.
 */
export type FontCategory = "Sans Serif" | "Serif" | "Display" | "Handwriting" | "Monospace";

export interface CatalogFont {
  family: string;
  dir: string;
  category: FontCategory;
  stroke: string | null;
  /** Klasifikasi gaya dari tag Google Fonts, mis. "Sans/Humanist". */
  styles: string[];
  /** Tag karakter Google Fonts (skor 0-100), mis. { Business: 75, Calm: 81 }. */
  expressive: Record<string, number>;
  /** Display dan tulisan tangan: hanya untuk heading, bukan teks isi. */
  headingOnly: boolean;
  /** Peringkat popularitas di Google Fonts (1 = paling populer). */
  popularity: number;
  designers: string[];
  license: "OFL" | "Apache-2.0";
  licenseFile: string;
  /** Path relatif terhadap fonts/lib. */
  files: { regular: string; bold?: string };
  bytes: number;
  /** Tanda baca tipografis yang tidak tersedia (bukan huruf wajib). */
  missingNice: string;
  source: string;
  specimen: string;
}

export const FONT_CATALOG = catalog as unknown as { generatedAt: string; count: number; totalBytes: number; fonts: CatalogFont[] };
export const FONTS: CatalogFont[] = FONT_CATALOG.fonts;

export const CATEGORY_LABEL: Record<FontCategory, { id: string; en: string }> = {
  "Sans Serif": { id: "Sans serif", en: "Sans serif" },
  Serif: { id: "Serif", en: "Serif" },
  Display: { id: "Display", en: "Display" },
  Handwriting: { id: "Tulisan tangan", en: "Handwriting" },
  Monospace: { id: "Monospace", en: "Monospace" },
};

/** Tag karakter Google Fonts ("Expressive") beserta label Indonesia. */
export const EXPRESSIVE_LABEL: Record<string, { id: string; en: string }> = {
  Business: { id: "Bisnis", en: "Business" },
  Competent: { id: "Kompeten", en: "Competent" },
  Calm: { id: "Tenang", en: "Calm" },
  Sincere: { id: "Tulus", en: "Sincere" },
  Sophisticated: { id: "Elegan", en: "Sophisticated" },
  Innovative: { id: "Inovatif", en: "Innovative" },
  Futuristic: { id: "Futuristik", en: "Futuristic" },
  Active: { id: "Aktif", en: "Active" },
  Excited: { id: "Bersemangat", en: "Excited" },
  Happy: { id: "Ceria", en: "Happy" },
  Playful: { id: "Jenaka", en: "Playful" },
  Cute: { id: "Imut", en: "Cute" },
  Childlike: { id: "Kekanakan", en: "Childlike" },
  Fancy: { id: "Mewah", en: "Fancy" },
  Artistic: { id: "Artistik", en: "Artistic" },
  Vintage: { id: "Vintage", en: "Vintage" },
  Loud: { id: "Lantang", en: "Loud" },
  Rugged: { id: "Kasar", en: "Rugged" },
  Stiff: { id: "Kaku", en: "Stiff" },
  Awkward: { id: "Canggung", en: "Awkward" },
};

const byFile = new Set(FONTS.flatMap((f) => [f.files.regular, f.files.bold].filter(Boolean) as string[]));

/** True bila path (relatif fonts/lib) adalah file font di katalog. Dipakai untuk validasi input. */
export function isCatalogFile(rel: string): boolean {
  return byFile.has(rel);
}
