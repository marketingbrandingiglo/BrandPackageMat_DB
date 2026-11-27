import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { ref } from "@/lib/brand/font-select";
import { FONTS } from "@/lib/brand/fonts";
import { buildPalette } from "@/lib/brand/palette";
import { businessCard, CARD_SIZE } from "@/lib/materials/business-card";
import { emailSignature, socialUrl } from "@/lib/materials/email-signature";
import { guideline, GUIDELINE_SIZE } from "@/lib/materials/guideline";
import { TONE_SAMPLE } from "./fixtures/tone-sample";
import { envelope, ENVELOPE_SIZE } from "@/lib/materials/envelope";
import { idCard, ID_SIZE } from "@/lib/materials/id-card";
import { pngInk, stamp, svgInk } from "@/lib/materials/stamp";
import { letterheadDocx, letterheadSvg, LETTERHEAD_SIZE } from "@/lib/materials/letterhead";
import { presentationPptx, presentationPreviews } from "@/lib/materials/presentation";
import { inflateRawSync } from "node:zlib";
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
      expect(c.front.svg).toContain('width="90mm"');
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
      expect(e.svg).toContain('width="220mm"');
      expect(e.svg).toContain("Kepada Yth.");
      const { warnings } = await svgToPdf(e.svg, { ...ENVELOPE_SIZE, fonts: kitFonts(k) });
      expect(warnings.filter((w) => w.source === "font")).toEqual([]);
    });
  }

  it("ukuran file = ukuran jadi (tanpa bleed), area aman 4 mm", async () => {
    expect(CARD_SIZE).toEqual({ widthMm: 90, heightMm: 55 });
    expect(ID_SIZE.landscape).toEqual({ widthMm: 85.6, heightMm: 54 });
    expect(ID_SIZE.portrait).toEqual({ widthMm: 54, heightMm: 85.6 });
    expect(ENVELOPE_SIZE).toEqual({ widthMm: 220, heightMm: 110 });
    const svg = businessCard(await kit("A")).front.svg;
    expect(svg).not.toContain('id="potong"');
    expect(svg).toContain('<rect id="area-aman" x="4" y="4" width="82" height="47"');
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

/** Ambil isi file dari arsip ZIP (DOCX) tanpa pustaka tambahan. */
function zipEntry(zip: Buffer, name: string): string | null {
  let i = 0;
  while ((i = zip.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), i)) >= 0) {
    const method = zip.readUInt16LE(i + 8);
    const size = zip.readUInt32LE(i + 18);
    const nameLen = zip.readUInt16LE(i + 26);
    const extra = zip.readUInt16LE(i + 28);
    const n = zip.toString("utf8", i + 30, i + 30 + nameLen);
    const start = i + 30 + nameLen + extra;
    if (n === name) {
      const raw = zip.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(raw) : raw).toString("utf8");
    }
    i = start;
  }
  return null;
}

describe("kop surat", () => {
  for (const pkg of ["A", "B"] as const) {
    it(`Paket ${pkg}: kertas kop A4 lolos pengecekan; DOCX berisi header/footer, font dan warna brand`, async () => {
      const k = await kit(pkg);
      const l = letterheadSvg(k);
      expect(l.issues).toEqual([]);
      expect(LETTERHEAD_SIZE).toEqual({ widthMm: 210, heightMm: 297 });
      expect(l.svg).toContain("PT Uji &lt;Sejahtera&gt; &amp; Co");
      const { warnings } = await svgToPdf(l.svg, { ...LETTERHEAD_SIZE, fonts: kitFonts(k) });
      expect(warnings.filter((w) => w.source === "font")).toEqual([]);

      const docx = await letterheadDocx(k);
      expect(docx.subarray(0, 2).toString()).toBe("PK");
      const header = zipEntry(docx, "word/header1.xml")!;
      const footer = zipEntry(docx, "word/footer1.xml")!;
      const styles = zipEntry(docx, "word/styles.xml")!;
      const body = zipEntry(docx, "word/document.xml")!;
      expect(header).toContain("PT Uji &lt;Sejahtera&gt; &amp; Co");
      expect(header).toContain("Telp +62 812-3456-7890");
      expect(footer).toContain("halo@uji.co.id");
      expect(footer).toContain("Instagram @uji.id");
      expect(styles).toContain(k.fonts.body.family);
      expect(styles).toContain(k.fonts.heading.family);
      expect(body).toContain("Dengan hormat,");
      expect(body).toMatch(/<w:pgSz w:w="11906" w:h="16838"/); // A4 standar Word
      // Logo SVG ikut dengan PNG cadangan.
      expect(docx.includes(Buffer.from("word/media/"))).toBe(true);
    });
  }

  it("bahasa Inggris dan tanpa sosial media", async () => {
    const k = { ...(await kit("A", { socials: [], email: "" })), lang: "en" as const };
    const docx = await letterheadDocx(k);
    expect(zipEntry(docx, "word/document.xml")).toContain("Sincerely,");
    expect(zipEntry(docx, "word/header1.xml")).toContain("Tel +62");
    expect(letterheadSvg(k).svg).not.toContain('id="footer"');
  });
});

describe("template PPT", () => {
  for (const pkg of ["A", "B"] as const) {
    it(`Paket ${pkg}: theme brand (warna dan font tema), layout bernama, 5 slide contoh`, async () => {
      const k = await kit(pkg);
      const pptx = await presentationPptx(k);
      const theme = zipEntry(pptx, "ppt/theme/theme1.xml")!;
      expect(theme).toContain(`<a:majorFont><a:latin typeface="${k.fonts.heading.family}"/>`);
      expect(theme).toContain(`<a:minorFont><a:latin typeface="${k.fonts.body.family}"/>`);
      expect(theme).toContain(`<a:accent1><a:srgbClr val="${k.palette.primary.hex.slice(1).toUpperCase()}"/></a:accent1>`);
      expect(theme).not.toContain("Calibri");
      const names = [1, 2, 3, 4, 5, 6].map((i) => /<p:cSld name="([^"]+)"/.exec(zipEntry(pptx, `ppt/slideLayouts/slideLayout${i}.xml`) ?? "")?.[1]);
      expect(names).toEqual(["Kosong", "Judul", "Bagian", "Isi", "Dua kolom", "Penutup"]);
      for (let i = 1; i <= 5; i++) expect(zipEntry(pptx, `ppt/slides/slide${i}.xml`)).toBeTruthy();
      expect(zipEntry(pptx, "ppt/slides/slide1.xml")).toContain("PT Uji &lt;Sejahtera&gt; &amp; Co");
      // Logo ada di layout (master).
      expect(zipEntry(pptx, "ppt/slideLayouts/_rels/slideLayout2.xml.rels")).toMatch(/media\/image/);
      const prev = presentationPreviews(k);
      expect(prev).toHaveLength(5);
      expect(prev[0]).toContain("PT Uji &lt;Sejahtera&gt; &amp; Co");
    });
  }

  it("bahasa Inggris", async () => {
    const k = { ...(await kit("A")), lang: "en" as const };
    const pptx = await presentationPptx(k);
    expect(/<p:cSld name="([^"]+)"/.exec(zipEntry(pptx, "ppt/slideLayouts/slideLayout2.xml")!)?.[1]).toBe("Title");
    expect(zipEntry(pptx, "ppt/slides/slide5.xml")).toContain("Thank you");
  });
});

describe("email signature", () => {
  for (const pkg of ["A", "B"] as const) {
    it(`Paket ${pkg}: HTML tabel inline, lebar maks 600, logo relatif 2x, teks di-escape`, async () => {
      const k = await kit(pkg, { socials: [{ platform: "instagram", handle: "uji.id" }, { platform: "linkedin", handle: "uji-sejahtera" }] });
      const s = await emailSignature(k);
      expect(s.issues).toEqual([]);
      expect(s.html).toContain('src="logo-email.png"');
      expect(s.html).not.toMatch(/data:image|<script|<link|<style/i);
      expect(s.html).toContain("max-width:600px");
      expect(s.html).toContain("PT Uji &lt;Sejahtera&gt; &amp; Co");
      expect(s.html).toContain("mailto:halo@uji.co.id");
      expect(s.html).toContain('href="tel:+6281234567890"');
      expect(s.html).toContain("https://www.instagram.com/uji.id");
      expect(s.html).toContain("https://www.linkedin.com/company/uji-sejahtera");
      expect(s.html).toContain(pkg === "A" ? "'Montserrat', Arial" : "'Playfair Display', Georgia");
      const sig = /<!-- signature: mulai -->([\s\S]*)<!-- signature: selesai -->/.exec(s.html)![1];
      expect(sig).toContain("Nama Lengkap");
      const meta = await sharp(s.logo.png).metadata();
      expect(meta.width).toBe(s.logo.width * 2);
      expect(s.logo.width).toBeLessThanOrEqual(pkg === "A" ? 120 : 170);
      expect(s.html).toContain(`width="${s.logo.width}" height="${s.logo.height}"`);
    });
  }
  it("bahasa Inggris, logo PNG, tanpa telepon dan email diberi catatan", async () => {
    const k = await kit("A", { phone: "", email: "", socials: [] });
    k.lang = "en";
    k.logo = { ...k.logo, kind: "png", svg: undefined, png: await sharp({ create: { width: 400, height: 100, channels: 4, background: "#0B6E4F" } }).png().toBuffer(), aspect: 4 };
    const s = await emailSignature(k);
    expect(s.html).toContain("Full Name");
    expect(s.html).toContain('lang="en"');
    expect(s.issues).toHaveLength(1);
    expect(s.logo.height).toBeLessThanOrEqual(56);
  });
  it("tautan sosial media", () => {
    expect(socialUrl({ platform: "tiktok", handle: "@uji" })).toBe("https://www.tiktok.com/@uji");
    expect(socialUrl({ platform: "linkedin", handle: "in/budi" })).toBe("https://www.linkedin.com/in/budi");
    expect(socialUrl({ platform: "whatsapp", handle: "0812 3456 7890" })).toBe("https://wa.me/6281234567890");
    expect(socialUrl({ platform: "instagram", handle: "https://instagram.com/x" })).toBe("https://instagram.com/x");
  });
});

describe("guideline", () => {
  for (const pkg of ["A", "B"] as const) {
    it(`Paket ${pkg}: 6 halaman lolos pengecekan, PDF dengan font paket`, async () => {
      const k = await kit(pkg);
      const g = guideline(k, { tone: TONE_SAMPLE, generatedAt: new Date("2026-11-20T03:00:00Z") });
      expect(g.pages).toHaveLength(6);
      expect(g.issues).toEqual([]);
      const all = g.pages.join("");
      expect(all).toContain("PT Uji &lt;Sejahtera&gt; &amp; Co");
      expect(all).toContain(`HEX ${k.palette.primary.hex.toUpperCase()}`);
      expect(all).toContain("CMYK");
      expect(all).toContain(`fonts.google.com/specimen/${k.fonts.heading.family.replace(/ /g, "+")}`);
      expect(all).toContain(escape(TONE_SAMPLE[pkg].examples.taglines[0].id));
      expect(all).toContain("20 November 2026");
      const { pdf, warnings } = await svgToPdf(g.pages, { ...GUIDELINE_SIZE, fonts: kitFonts(k) });
      expect(warnings.filter((w) => w.source === "font")).toEqual([]);
      expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(6);
    });
  }
  it("bahasa Inggris, tanpa tone, logo PNG: catatan tone dan saran logo vektor", async () => {
    const k = await kit("A");
    k.lang = "en";
    k.logo = { ...k.logo, kind: "png", svg: undefined };
    const g = guideline(k);
    expect(g.issues).toEqual([]);
    const all = g.pages.join("");
    expect(all).toContain("Brand Guidelines");
    expect(all).toContain("No tone of voice for this job");
    expect(all).toContain("vector version");
  });
  it("nama perusahaan sangat panjang tetap di area aman", async () => {
    const k = await kit("B", { name: "PT Perusahaan Dengan Nama Yang Sangat Panjang Sekali Untuk Menguji Sampul Guideline Tbk" });
    expect(guideline(k, { tone: TONE_SAMPLE }).issues).toEqual([]);
  });
});

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

describe("kop surat: kontak tambahan", () => {
  it("alamat dan telepon tambahan di footer SVG dan DOCX, maks. 2 masing-masing", async () => {
    const k = await kit("A", { extraAddresses: ["Jl. Pemuda 10, Surabaya", "Jl. Dua", "Jl. Tiga"], extraPhones: ["0215551234"] });
    const svg = letterheadSvg(k);
    expect(svg.issues).toEqual([]);
    expect(svg.svg).toContain("Jl. Pemuda 10, Surabaya");
    expect(svg.svg).toContain("+62 21 5551 234");
    expect(svg.svg).not.toContain("Jl. Tiga");
    const doc = zipEntry(await letterheadDocx(k), "word/footer1.xml");
    expect(doc).toContain("Jl. Pemuda 10, Surabaya");
  });
});
