import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { analyzeLogo, detectKind, LogoRejected, svgMonochrome } from "@/lib/brand/logo";
import { sanitizeSvg, SvgRejected } from "@/lib/brand/svg-sanitize";

/** PNG uji: kotak berwarna di tengah, latar transparan atau putih. */
async function png(size: number, color: string, transparent = true): Promise<Buffer> {
  const bg = transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 255, g: 255, b: 255, alpha: 1 };
  const inner = Math.round(size * 0.6);
  const square = await sharp({ create: { width: inner, height: inner, channels: 4, background: color } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: square, gravity: "centre" }])
    .png()
    .toBuffer();
}

const codes = (r: { warnings: { code: string }[] }) => r.warnings.map((w) => w.code);

describe("sanitasi SVG", () => {
  it("membuang script, event handler, foreignObject, referensi eksternal", () => {
    const r = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" onload="alert(1)">
      <script>alert(1)</script>
      <foreignObject><div>x</div></foreignObject>
      <a href="https://jahat.example"><rect width="5" height="5" fill="red"/></a>
      <image href="https://jahat.example/x.png" width="5" height="5"/>
      <use xlink:href="https://jahat.example/s.svg#a"/>
      <rect width="5" height="5" style="fill:url(https://jahat.example/p)" onclick="x()"/>
      <style>@import url(https://jahat.example/a.css); .a{fill:url(#g)}</style>
      <animate attributeName="href" to="javascript:alert(1)"/>
    </svg>`);
    expect(r.svg).not.toMatch(/script|onload|onclick|foreignObject|jahat\.example|@import|animate|javascript/i);
    expect(r.svg).toContain("url(#g)");
    expect(r.removed.length).toBeGreaterThan(5);
    expect(r.viewBox).toEqual([0, 0, 10, 10]);
  });

  it("menolak DTD dengan entity (XXE / billion laughs)", () => {
    expect(() => sanitizeSvg(`<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>`)).toThrow(SvgRejected);
  });

  it("mendeteksi teks hidup dan raster tertanam", () => {
    const r = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text>Hai</text><image href="data:image/png;base64,iVBORw0KGgo=" width="1" height="1"/></svg>`);
    expect(r.hasText).toBe(true);
    expect(r.hasRaster).toBe(true);
  });
});

describe("pengecekan logo", () => {
  it("deteksi tipe dari isi file, bukan nama", async () => {
    expect(detectKind(await png(10, "#000"))).toBe("png");
    expect(detectKind(Buffer.from(`<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>`))).toBe("svg");
    expect(detectKind(Buffer.from("GIF89a"))).toBeNull();
  });

  it("menolak format lain dan file terlalu besar", async () => {
    await expect(analyzeLogo(Buffer.from("GIF89a...."))).rejects.toThrow(LogoRejected);
    await expect(analyzeLogo(Buffer.alloc(6 * 1024 * 1024))).rejects.toThrow(/melebihi/);
  });

  it("PNG resolusi: < 400 keras, < 800 peringatan, >= 800 aman", async () => {
    expect(codes(await analyzeLogo(await png(300, "#E82827")))).toContain("png_resolution_very_low");
    expect(codes(await analyzeLogo(await png(600, "#E82827")))).toContain("png_resolution_low");
    const ok = codes(await analyzeLogo(await png(900, "#E82827")));
    expect(ok).not.toContain("png_resolution_low");
    expect(ok).not.toContain("png_resolution_very_low");
  });

  it("PNG berlatar putih: peringatan latar tidak transparan", async () => {
    const r = await analyzeLogo(await png(900, "#0E5A8A", false));
    expect(r.transparentBackground).toBe(false);
    expect(codes(r)).toContain("background_not_transparent");
    expect(r.onDark.strategy).toBe("unavailable");
  });

  it("logo hitam satu warna: versi putih untuk latar gelap", async () => {
    const r = await analyzeLogo(await png(900, "#111111"));
    expect(r.monochrome).toBe(true);
    expect(r.onDark.strategy).toBe("mono");
    expect(r.onLight.strategy).toBe("original");
    expect(r.previews.monoWhite).toBeDefined();
  });

  it("logo merah terang: aman di latar gelap dan terang", async () => {
    const r = await analyzeLogo(await png(900, "#E82827"));
    expect(r.onDark.strategy).toBe("original");
    expect(r.onLight.strategy).toBe("original");
  });

  it("SVG putih: dibuat versi gelap untuk latar terang, SVG monokrom tersedia", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="40" fill="#FFFFFF"/></svg>`;
    const r = await analyzeLogo(Buffer.from(svg));
    expect(r.kind).toBe("svg");
    expect(r.onLight.strategy).toBe("mono");
    expect(r.monoSvg?.dark).toContain("#212122");
  });

  it("svgMonochrome mengganti warna atribut, style, dan default hitam", () => {
    const out = svgMonochrome(`<svg xmlns="http://www.w3.org/2000/svg"><style>.a{fill:#f00}</style><path d="M0 0"/><rect fill="#123456" stroke="none" style="stroke:#0f0"/></svg>`, "#FFFFFF");
    expect(out).not.toMatch(/#f00|#123456|#0f0/i);
    expect(out).toContain('stroke="none"');
    expect(out).toMatch(/<svg[^>]*fill="#FFFFFF"/);
  });
});
