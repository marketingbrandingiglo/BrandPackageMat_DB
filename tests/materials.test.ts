import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { ref } from "@/lib/brand/font-select";
import { FONTS } from "@/lib/brand/fonts";
import { buildPalette } from "@/lib/brand/palette";
import { businessCard, CARD_SIZE } from "@/lib/materials/business-card";
import { envelope, ENVELOPE_SIZE } from "@/lib/materials/envelope";
import { idCard, ID_SIZE } from "@/lib/materials/id-card";
import { pngInk, stamp, svgInk } from "@/lib/materials/stamp";
import { checkLayout } from "@/lib/materials/checks";
import { formatPhone, kitFonts, socialLine, type BrandKit } from "@/lib/materials/kit";
import { placeLogo } from "@/lib/materials/logo";
import { fit, measure, wrap } from "@/lib/materials/text";
import { svgToPdf, svgToPng } from "@/lib/render/svg";

vi.mock("server-only", () => ({}));

const f = (n: string) => ref(FONTS.find((x) => x.family === n)!);
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><defs><linearGradient id="g"><stop offset="0" stop-color="#0B6E4F"/><stop offset="1" stop-color="#F2A541"/></linearGradient></defs><circle id="c" cx="50" cy="50" r="45" fill="url(#g)"/><rect x="110" y="20" width="180" height="60" fill="#1B1B1E"/></svg>`;

async function kit(pkg: "A" | "B", over: Partial<BrandKit["company"]> = {}, hasText = true): Promise<BrandKit> {
  return {
    pkg,
    lang: "id",
    palette: buildPalette([{ hex: "#0B6E4F", share: 0.6, chromatic: true }, { hex: "#F2A541", share: 0.4, chromatic: true }]),
    company: { name: "PT Uji <Sejahtera> & Co", email: "halo@uji.co.id", phone: "081234567890", address: "Jl. Jend. Sudirman Kav. 52-53, Senayan, Kebayoran Baru, Jakarta Selatan 12190", socials: [{ platform: "instagram", handle: "uji.id" }], ...over },
    fonts: pkg === "A" ? { heading: f("Montserrat"), body: f("Open Sans") } : { heading: f("Playfair Display"), body: f("Lato") },
    logo: { kind: "svg", svg: LOGO_SVG, png: await sharp({ create: { width: 30, height: 10, channels: 4, background: "#000" } }).png().toBuffer(), aspect: 3, hasText },
  };
}

describe("teks", () => {
  const st = { font: f("Lato"), size: 3, color: "#000" };
  it("mengukur, memperkecil, dan membungkus", () => {
    expect(measure("Halo", st)).toBeGreaterThan(5);
    expect(measure("Halo", { ...st, size: 6 })).toBeCloseTo(measure("Halo", st) * 2, 5);
    const long = "Nama perusahaan yang sangat panjang sekali";
    expect(measure(long, fit(long, st, 30, 1.5))).toBeLessThanOrEqual(30.01);
    const lines = wrap(long, st, 30, 2);
    expect(lines).toHaveLength(2);
    expect(lines.join(" ")).toBe(long);
  });
});

describe("kit", () => {
  it("format telepon Indonesia dan sosial media", () => {
    expect(formatPhone("081234567890")).toBe("+62 812-3456-7890");
    expect(formatPhone("+62 21 5551 2345")).toBe("+62 21 5551 2345");
    expect(formatPhone("(021) 555-1234")).toBe("+62 21 5551 234");
    expect(socialLine({ platform: "instagram", handle: "uji" })).toBe("Instagram @uji");
  });
  it("logo SVG bersarang dengan id berawalan dan rasio terjaga", () => {
    const p = placeLogo({ kind: "svg", svg: LOGO_SVG, png: Buffer.alloc(0), aspect: 3, hasText: true }, { x: 0, y: 0, w: 30, h: 30 }, "start", "top");
    expect(p.w).toBe(30);
    expect(p.h).toBe(10);
    expect(p.svg).toContain('id="lg-g"');
    expect(p.svg).toContain("url(#lg-g)");
    expect(p.svg).not.toMatch(/id="g"/);
  });
  it("cek tata letak menemukan keluar area, tabrakan, dan kontras rendah", () => {
    const issues = checkLayout(
      [
        { id: "a", x: 0, y: 0, w: 10, h: 3, fg: "#CCCCCC", bg: "#FFFFFF", size: 2 },
        { id: "b", x: 5, y: 1, w: 10, h: 3 },
      ],
      { x: 2, y: 0, w: 50, h: 50 },
    );
    expect(issues.map((i) => i.code).sort()).toEqual(["low-contrast", "outside-safe-area", "overlap"]);
  });
});

describe("kartu nama", () => {
  for (const pkg of ["A", "B"] as const) {
    it(`Paket ${pkg}: lolos pengecekan, teks di-escape, PDF 2 halaman dengan font benar`, async () => {
      const k = await kit(pkg);
      const c = businessCard(k);
      expect(c.front.issues).toEqual([]);
      expect(c.back.issues).toEqual([]);
      expect(c.front.svg).toContain('width="96mm"');
      expect(c.front.svg).toContain("Nama Lengkap");
      expect(c.front.svg).toContain("+62 812-3456-7890");
      expect(c.back.svg).not.toContain("<Sejahtera>");
      const { pdf, warnings } = await svgToPdf([c.front.svg, c.back.svg], { ...CARD_SIZE, fonts: kitFonts(k) });
      expect(warnings.filter((w) => w.source === "font")).toEqual([]);
      expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBe(2);
      expect((await sharp(svgToPng(c.front.svg, kitFonts(k), 600)).metadata()).width).toBe(600);
    });
  }

  it("logo tanpa tulisan: nama perusahaan tampil di belakang; tanpa sosmed dan alamat tetap rapi", async () => {
    for (const pkg of ["A", "B"] as const) {
      const c = businessCard(await kit(pkg, { socials: [], address: "", name: "PT Nama Perusahaan Yang Sangat Panjang Sekali Untuk Diuji Indonesia" }, false));
      expect(c.back.svg).toContain("nama-perusahaan");
      expect(c.back.issues).toEqual([]);
      expect(c.front.issues).toEqual([]);
      expect(c.front.svg).not.toContain("alamat-1");
    }
  });
});

describe("ID card dan amplop", () => {
  for (const pkg of ["A", "B"] as const) {
    it(`Paket ${pkg}: ID card portrait/landscape dan amplop lolos pengecekan, PDF benar`, async () => {
      const k = await kit(pkg);
      for (const o of ["landscape", "portrait"] as const) {
        const c = idCard(k, o);
        expect(c.front.issues, `${o} depan`).toEqual([]);
        expect(c.back.issues, `${o} belakang`).toEqual([]);
        expect(c.front.svg).toContain("lubang-tali");
        expect(c.front.svg).toContain("No. ID 0000 0000");
        expect(c.back.svg).toContain("Bila menemukan kartu ini");
        const { pdf, warnings } = await svgToPdf([c.front.svg, c.back.svg], { ...ID_SIZE[o], fonts: kitFonts(k) });
        expect(warnings.filter((w) => w.source === "font")).toEqual([]);
        expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBe(2);
      }
      const e = envelope(k);
      expect(e.issues).toEqual([]);
      expect(e.svg).toContain('width="226mm"');
      expect(e.svg).toContain("Kepada Yth.");
      const { warnings } = await svgToPdf(e.svg, { ...ENVELOPE_SIZE, fonts: kitFonts(k) });
      expect(warnings.filter((w) => w.source === "font")).toEqual([]);
    });
  }

  it("ukuran CR80 dan DL dengan bleed", () => {
    expect(ID_SIZE.landscape).toEqual({ widthMm: 91.6, heightMm: 60 });
    expect(ID_SIZE.portrait).toEqual({ widthMm: 60, heightMm: 91.6 });
    expect(ENVELOPE_SIZE).toEqual({ widthMm: 226, heightMm: 116 });
  });

  it("bahasa Inggris dan nama sangat panjang tetap lolos", async () => {
    const k = { ...(await kit("B", { name: "PT Nama Perusahaan Yang Sangat Panjang Sekali Untuk Diuji Indonesia Raya" }, false)), lang: "en" as const };
    for (const o of ["landscape", "portrait"] as const) {
      const c = idCard(k, o);
      expect([...c.front.issues, ...c.back.issues], o).toEqual([]);
      expect(c.back.svg).toContain("If found");
    }
    expect(envelope(k).issues).toEqual([]);
    expect(envelope(k).svg).toContain(">To<");
  });
});

describe("cap", () => {
  it("logo SVG satu warna: warna gelap jadi tinta, warna terang jadi putih kertas", () => {
    const out = svgInk(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect fill="#1D4ED8" width="10" height="10"/><text fill="white">A</text><circle style="fill:#F59E0B"/><path fill="url(#g)"/></svg>`, "#123456");
    expect(out).toContain('fill="#123456"');
    expect(out).toContain('fill="#FFFFFF"');
    expect(out).toContain("fill:#123456");
    expect(out).toContain('fill="url(#g)"');
    expect(out).not.toContain("#1D4ED8");
  });

  it("logo PNG satu warna: terang transparan, gelap tinta", async () => {
    const src = await sharp({ create: { width: 4, height: 2, channels: 4, background: "#FFFFFF" } })
      .composite([{ input: await sharp({ create: { width: 2, height: 2, channels: 4, background: "#D31F25" } }).png().toBuffer(), left: 0, top: 0 }])
      .png()
      .toBuffer();
    const { data } = await sharp(await pngInk(src, "#112233")).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2], data[3]]).toEqual([0x11, 0x22, 0x33, 255]);
    expect(data[3 * 4 + 3]).toBe(0);
  });

  it("model 1 (Paket A): logo saja, sisi terpanjang 40 mm, tanpa lingkaran/teks/ornamen", async () => {
    const k = await kit("A");
    const s1 = await stamp(k);
    expect(s1.issues).toEqual([]);
    expect(s1.size).toEqual({ widthMm: 40, heightMm: 40 / 3 });
    expect(s1.svg).not.toMatch(/<circle cx="20"|<text|<polygon|textPath/);
    const colors = new Set(s1.svg.match(/#[0-9A-Fa-f]{6}/g)!.map((c) => c.toUpperCase()));
    colors.delete("#FFFFFF");
    expect(colors.size).toBe(1);
    const { warnings } = await svgToPdf(s1.svg, { ...s1.size, fonts: kitFonts(k) });
    expect(warnings).toEqual([]);
    const tall = await stamp({ ...k, logo: { ...k.logo, aspect: 0.5 } });
    expect(tall.size).toEqual({ widthMm: 20, heightMm: 40 });
  });

  it("model 2 (Paket B): satu lingkaran Ø 40 mm + logo dengan jarak aman, tanpa teks/ornamen", async () => {
    const k = await kit("B");
    const s2 = await stamp(k);
    expect(s2.size).toEqual({ widthMm: 40, heightMm: 40 });
    expect(/<g id="lingkaran">(.*?)<\/g>/.exec(s2.svg)![1].match(/<circle /g)).toHaveLength(1);
    expect(s2.svg).toContain('stroke-width="1"');
    expect(s2.svg).not.toMatch(/<text|<polygon|textPath/);
    // Logo (rasio 3:1) muat di dalam lingkaran dengan jarak 4 mm: sudut kotak logo <= radius 15.
    const m = /<svg x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(s2.svg)!;
    const [x, y, w, h] = m.slice(1).map(Number);
    expect(Math.hypot(x + w - 20, y + h - 20)).toBeLessThanOrEqual(15.001);
  });

  it("logo PNG diberi catatan", async () => {
    const k = await kit("B");
    const png = { ...k, logo: { ...k.logo, kind: "png" as const, svg: undefined } };
    expect((await stamp(png)).issues.some((i) => i.code === "note")).toBe(true);
  });
});
