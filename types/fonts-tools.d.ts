// Deklarasi minimal untuk pustaka tanpa tipe bawaan yang dipakai skrip font.
declare module "subset-font" {
  export default function subsetFont(
    font: Buffer,
    text: string,
    options?: { targetFormat?: "sfnt" | "truetype" | "woff" | "woff2"; variationAxes?: Record<string, number | { min: number; max: number; default?: number }> },
  ): Promise<Buffer>;
}

declare module "fontkit" {
  export interface Font {
    familyName: string;
    subfamilyName: string;
    unitsPerEm: number;
    hasGlyphForCodePoint(cp: number): boolean;
    variationAxes: Record<string, { name: string; min: number; default: number; max: number }>;
  }
  export function create(buf: Buffer): Font;
}
