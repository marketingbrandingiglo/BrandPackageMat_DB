import { describe, expect, it } from "vitest";
import { escapeXml } from "@/lib/render/escape";
import { TEST_FONTS, firstFamily } from "@/lib/render/fonts";
import { SAMPLE_SIZE, sampleBusinessCardSvg } from "@/lib/render/sample";
import { svgToPdf, svgToPng } from "@/lib/render/svg";

describe("render SVG tanpa browser", () => {
  it("escape teks user", () => {
    expect(escapeXml(`A & B <x> "q" 'a'`)).toBe("A &amp; B &lt;x&gt; &quot;q&quot; &apos;a&apos;");
  });

  it("mengambil family pertama", () => {
    expect(firstFamily("'Lato', sans-serif")).toBe("Lato");
  });

  it("SVG -> PDF berukuran benar, font ter-embed, tanpa peringatan", async () => {
    const { pdf, warnings } = await svgToPdf(sampleBusinessCardSvg(), { ...SAMPLE_SIZE, fonts: TEST_FONTS });
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-")).toBe(true);
    // 96 x 61 mm = 272.13 x 172.91 pt
    expect(text).toMatch(/MediaBox \[0 0 272\.12\d+ 172\.91\d+\]/);
    expect(text).toContain("Lato-Bold");
    expect(text).toContain("PlayfairDisplay");
    expect(warnings).toEqual([]);
  });

  it("font tak terdaftar memberi peringatan, bukan crash", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="1" y="5" font-family="TidakAda">x</text></svg>`;
    const { warnings } = await svgToPdf(svg, { widthMm: 10, heightMm: 10, fonts: TEST_FONTS });
    expect(warnings.some((w) => w.source === "font")).toBe(true);
  });

  it("SVG -> PNG", () => {
    const png = svgToPng(sampleBusinessCardSvg(), TEST_FONTS, 300);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
  });
});

describe("penggabungan teks PDF", () => {
  it("huruf satu baris menjadi satu Tm + TJ dengan penyesuaian jarak", async () => {
    const { mergeTextBlock } = await import("@/lib/render/text-runs");
    // Lebar 500/1000 em, ukuran 2, skala 1 -> jarak alami 1. Huruf ke-3 bergeser 0,2 (letter-spacing).
    const out = mergeTextBlock(
      ["BT", "/F1 2 Tf", "0 Tr", "1 0 0 -1 10 5 Tm", "<0001> Tj", "1 0 0 -1 11 5 Tm", "<0002> Tj", "1 0 0 -1 12.2 5 Tm", "<0003> Tj", "ET"],
      () => [0, 500, 500, 500],
    );
    expect(out).toEqual(["BT", "/F1 2 Tf", "0 Tr", "1 0 0 -1 10 5 Tm", "[<0001> <0002> -100 <0003>] TJ", "ET"]);
  });

  it("baris berbeda dipisah, blok tak dikenal dibiarkan", async () => {
    const { mergeTextBlock } = await import("@/lib/render/text-runs");
    const w = () => [0, 500, 500];
    const two = mergeTextBlock(["BT", "/F1 2 Tf", "1 0 0 -1 10 5 Tm", "<0001> Tj", "1 0 0 -1 10 9 Tm", "<0002> Tj", "ET"], w);
    expect(two?.filter((l) => l.endsWith("TJ"))).toHaveLength(2);
    expect(mergeTextBlock(["BT", "/F1 2 Tf", "aneh", "ET"], w)).toBeNull();
  });
});
