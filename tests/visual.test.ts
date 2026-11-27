import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { ref } from "@/lib/brand/font-select";
import { FONTS } from "@/lib/brand/fonts";
import { buildPalette } from "@/lib/brand/palette";
import { allowedColors, validateVisual, visualKey } from "@/lib/brand/visual";
import { businessCard, CARD_SIZE } from "@/lib/materials/business-card";
import { guideline } from "@/lib/materials/guideline";
import { idCard } from "@/lib/materials/id-card";
import { kitFonts, type BrandKit } from "@/lib/materials/kit";
import { presentationPptx, presentationPreviews } from "@/lib/materials/presentation";
import { svgToPdf } from "@/lib/render/svg";
import { TONE_SAMPLE } from "./fixtures/tone-sample";

vi.mock("server-only", () => ({}));

const palette = buildPalette([{ hex: "#0B6E4F", share: 0.6, chromatic: true }, { hex: "#F2A541", share: 0.4, chromatic: true }]);
const fixture = (p: "A" | "B") => readFileSync(`tests/fixtures/visual-${p}.svg`, "utf8");
const wrapSvg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200"><rect width="1200" height="1200" fill="#0B6E4F"/>${body}</svg>`;

describe("validator visual", () => {
  it("contoh Paket A dan B lolos", () => {
    for (const p of ["A", "B"] as const) expect(validateVisual(fixture(p), allowedColors(palette, p)).ok).toBe(true);
  });
  it("menolak teks, gambar, filter, warna di luar palet, viewBox salah, dan aset kosong", () => {
    const a = allowedColors(palette, "A");
    const bad = (svg: string) => {
      const r = validateVisual(svg, a);
      expect(r.ok).toBe(false);
      return r.ok ? "" : r.errors.join(" ");
    };
    expect(bad(wrapSvg(`<text x="10" y="10">Hai</text>`))).toMatch(/<text>/);
    expect(bad(wrapSvg(`<image href="data:image/png;base64,AAAA" width="10" height="10"/>`))).toMatch(/<image>/);
    expect(bad(wrapSvg(`<script>alert(1)</script>`))).toMatch(/<script>/);
    expect(bad(wrapSvg(`<circle cx="5" cy="5" r="5" fill="#FF0000"/>`))).toMatch(/#FF0000/);
    expect(bad(wrapSvg(`<circle cx="5" cy="5" r="5" style="fill:red"/>`))).toMatch(/red/);
    expect(bad(wrapSvg(`<circle cx="5" cy="5" r="5" onclick="x()" fill="#0B6E4F"/>`))).toMatch(/onclick/);
    expect(bad(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#0B6E4F"/></svg>`)).toMatch(/viewBox/);
    expect(bad(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200"><circle cx="5" cy="5" r="5" fill="#0B6E4F"/></svg>`)).toMatch(/kosong/);
    expect(bad(wrapSvg(`<!-- ${"x".repeat(160 * 1024)} -->`))).toMatch(/KB/);
  });
  it("warna B berbeda dari A, kunci cache bergantung pada paket dan logo", () => {
    const a = allowedColors(palette, "A").map((c) => c.hex);
    const b = allowedColors(palette, "B").map((c) => c.hex);
    expect(a).toContain("#FFFFFF");
    expect(b).not.toEqual(a);
    const logo = Buffer.from("logo");
    expect(visualKey(logo, palette, "A")).toBe(visualKey(Buffer.from("logo"), palette, "A"));
    expect(visualKey(logo, palette, "A")).not.toBe(visualKey(logo, palette, "B"));
    expect(visualKey(logo, palette, "A")).not.toBe(visualKey(Buffer.from("lain"), palette, "A"));
  });
});

const f = (n: string) => ref(FONTS.find((x) => x.family === n)!);
async function kit(pkg: "A" | "B"): Promise<BrandKit> {
  const v = validateVisual(fixture(pkg), allowedColors(palette, pkg));
  if (!v.ok) throw new Error("fixture");
  return {
    pkg,
    lang: "id",
    palette,
    visual: v.svg,
    company: { name: "PT Uji <Sejahtera> & Co", email: "halo@uji.co.id", phone: "081234567890", address: "Jl. Jend. Sudirman Kav. 52-53, Senayan, Jakarta Selatan 12190", socials: [{ platform: "instagram", handle: "uji.id" }] },
    fonts: pkg === "A" ? { heading: f("Montserrat"), body: f("Open Sans") } : { heading: f("Playfair Display"), body: f("Lato") },
    logo: { kind: "svg", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><circle id="c" cx="50" cy="50" r="45" fill="#0B6E4F"/></svg>`, png: await sharp({ create: { width: 3, height: 1, channels: 4, background: "#000" } }).png().toBuffer(), aspect: 3, hasText: true },
  };
}

describe("visual di materi", () => {
  for (const pkg of ["A", "B"] as const) {
    it(`Paket ${pkg}: kartu nama, ID card, guideline, PPT memakai visual dan tetap lolos`, async () => {
      const k = await kit(pkg);
      const card = businessCard(k);
      expect(card.back.issues).toEqual([]);
      expect(card.back.svg).toContain('clip-path="url(#klip-');
      expect(card.back.svg).toContain('preserveAspectRatio="xMidYMid slice"');
      expect(card.front.svg).not.toContain("visual-");
      for (const o of ["landscape", "portrait"] as const) {
        const id = idCard(k, o);
        expect(id.back.issues).toEqual([]);
        expect(id.back.svg).toContain("visual-pita");
      }
      const g = guideline(k, { tone: TONE_SAMPLE });
      expect(g.issues).toEqual([]);
      expect(g.pages[0]).toContain("visual-sampul");
      const prev = presentationPreviews(k);
      expect(prev[0]).toContain("visual-slide");
      expect(prev[4]).toContain("visual-slide");
      expect(prev[2]).not.toContain("visual-slide");
      const pptx = await presentationPptx(k);
      expect(pptx.length).toBeGreaterThan(20000);
      const { warnings } = await svgToPdf(card.back.svg, { ...CARD_SIZE, fonts: kitFonts(k) });
      expect(warnings.filter((w) => w.source === "font")).toEqual([]);
    });
  }
});
