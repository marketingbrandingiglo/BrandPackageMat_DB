import path from "node:path";

/**
 * Registri font untuk render. Tahap 1 hanya memuat font uji di fonts/test.
 * Daftar terkurasi (~300 family) dibuat di Tahap 3 (SPEC bagian 6).
 */
export interface FontFamily {
  regular: string;
  bold?: string;
}

const FONT_ROOT = path.join(process.cwd(), "fonts");

export const TEST_FONTS: Record<string, FontFamily> = {
  Lato: {
    regular: path.join(FONT_ROOT, "test/lato/Lato-Regular.ttf"),
    bold: path.join(FONT_ROOT, "test/lato/Lato-Bold.ttf"),
  },
  // Variable font: PDFKit dan resvg memakai instance default (wght 400).
  "Playfair Display": {
    regular: path.join(FONT_ROOT, "test/playfairdisplay/PlayfairDisplay[wght].ttf"),
  },
};

/** Ambil nama family pertama dari nilai CSS font-family, mis. "'Lato', sans-serif" -> "Lato". */
export function firstFamily(value: string | undefined): string {
  return (value ?? "").split(",")[0].trim().replace(/^['"]|['"]$/g, "");
}

export function allFontFiles(fonts: Record<string, FontFamily>): string[] {
  return Object.values(fonts).flatMap((f) => (f.bold ? [f.regular, f.bold] : [f.regular]));
}
