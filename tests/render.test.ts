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
