import { describe, expect, it } from "vitest";
import { contrastRatio, deltaE, hexToRgb, lchToRgb, rgbToCmyk, rgbToHex, rgbToLch, rgbToOklab } from "@/lib/brand/color";
import { buildPalette, extractLogoColors, wcagLevel, type Raster } from "@/lib/brand/palette";

/** Raster uji: blok-blok warna dengan porsi tertentu, plus piksel transparan. */
function raster(blocks: [string, number][], transparent = 0): Raster {
  const px: number[] = [];
  for (const [hex, n] of blocks) for (let i = 0; i < n; i++) px.push(...hexToRgb(hex), 255);
  for (let i = 0; i < transparent; i++) px.push(0, 0, 0, 0);
  return { data: Buffer.from(px), width: px.length / 4, height: 1 };
}

describe("konversi warna", () => {
  it("OKLab bolak-balik ke sRGB tanpa bergeser", () => {
    for (const hex of ["#E82827", "#0B6E4F", "#F2A541", "#000000", "#FFFFFF", "#2575FC"]) {
      expect(rgbToHex(lchToRgb(rgbToLch(hexToRgb(hex))))).toBe(hex);
    }
  });
  it("CMYK acuan", () => {
    expect(rgbToCmyk([255, 255, 255])).toEqual([0, 0, 0, 0]);
    expect(rgbToCmyk([0, 0, 0])).toEqual([0, 0, 0, 100]);
    expect(rgbToCmyk(hexToRgb("#E82827"))).toEqual([0, 83, 83, 9]);
  });
  it("level WCAG", () => {
    expect(wcagLevel(7)).toBe("AAA");
    expect(wcagLevel(4.5)).toBe("AA");
    expect(wcagLevel(3)).toBe("AA-large");
    expect(wcagLevel(2.9)).toBe("fail");
  });
});

describe("warna logo (k-means)", () => {
  it("menemukan warna dan porsinya, mengabaikan piksel transparan", () => {
    const c = extractLogoColors(raster([["#0B6E4F", 600], ["#F2A541", 300], ["#1B1B1E", 100]], 5000));
    expect(c.map((x) => x.hex)).toEqual(["#0B6E4F", "#F2A541", "#1B1B1E"]);
    expect(c[0].share).toBeCloseTo(0.6, 2);
    expect(c[2].chromatic).toBe(false);
  });
  it("deterministik: hasil sama tiap kali", () => {
    const r = raster([["#E82827", 700], ["#FFFFFF", 200], ["#2575FC", 100]]);
    expect(extractLogoColors(r)).toEqual(extractLogoColors(r));
  });
  it("membuang warna latar logo yang tidak transparan", () => {
    const c = extractLogoColors(raster([["#FFFFFF", 900], ["#0E5A8A", 100]]), [255, 255, 255]);
    expect(c.map((x) => x.hex)).toEqual(["#0E5A8A"]);
  });
  it("menggabungkan gradasi halus menjadi satu warna", () => {
    const c = extractLogoColors(raster([["#E82827", 500], ["#E52A28", 300], ["#EA2626", 200]]));
    expect(c).toHaveLength(1);
    expect(deltaE(rgbToOklab(hexToRgb(c[0].hex)), rgbToOklab(hexToRgb("#E82827")))).toBeLessThan(2);
  });
});

describe("palet", () => {
  it("warna utama = warna berkroma terbesar; paket A dan B berbeda", () => {
    const p = buildPalette([
      { hex: "#FFFFFF", share: 0.5, chromatic: false },
      { hex: "#E82827", share: 0.4, chromatic: true },
    ]);
    expect(p.primary.hex).toBe("#E82827");
    expect(p.achromatic).toBe(false);
    expect(p.packages.A.supporting).toHaveLength(3);
    expect(p.packages.B.supporting).toHaveLength(3);
    const a = p.packages.A.supporting.map((s) => s.hex);
    expect(p.packages.B.supporting.some((s) => a.includes(s.hex))).toBe(false);
    expect(p.neutrals).toHaveLength(4);
    // Teks gelap di latar terang harus lolos AA.
    expect(p.pairs[0].ratio).toBeGreaterThanOrEqual(4.5);
  });
  it("warna logo lain dipakai sebagai aksen Paket A", () => {
    const p = buildPalette([
      { hex: "#0B6E4F", share: 0.5, chromatic: true },
      { hex: "#F2A541", share: 0.3, chromatic: true },
    ]);
    expect(p.logoSecondary.map((s) => s.hex)).toEqual(["#F2A541"]);
    expect(p.packages.A.supporting[0].hex).toBe("#F2A541");
  });
  it("warna utama terang mendapat versi teks dengan kontras ≥ 4,5:1", () => {
    const p = buildPalette([{ hex: "#F2C14E", share: 1, chromatic: true }]);
    expect(p.primary.onWhite).toBeLessThan(4.5);
    expect(p.primaryText).toBeDefined();
    expect(contrastRatio(p.primaryText!.rgb, [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(rgbToLch(p.primaryText!.rgb)[2] - rgbToLch(p.primary.rgb)[2])).toBeLessThan(8);
  });
  it("logo tanpa warna: tanpa harmoni hue, ada catatan", () => {
    const p = buildPalette([{ hex: "#000000", share: 1, chromatic: false }]);
    expect(p.achromatic).toBe(true);
    expect(p.primary.hex).toBe("#000000");
    expect(p.packages.A.harmony).toBe("neutral");
    expect(p.notes.length).toBe(2);
  });
  it("setiap warna punya HEX, RGB, CMYK", () => {
    const p = buildPalette([{ hex: "#2575FC", share: 1, chromatic: true }]);
    for (const s of [p.primary, ...p.neutrals, ...p.packages.A.supporting, ...p.packages.B.supporting]) {
      expect(s.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(s.rgb).toHaveLength(3);
      expect(s.cmyk).toHaveLength(4);
    }
  });
});
