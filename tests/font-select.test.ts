import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildShortlist, SHORTLIST } from "@/lib/brand/font-shortlist";
import { buildResult, candidates, checkPackages, describe as describeCandidates, LogoTraitsSchema, PairsSchema, type LogoTraits } from "@/lib/brand/font-select";
import { specimenSheets } from "@/lib/brand/font-specimen";
import { open, seal } from "@/lib/drive/crypto";
import { newJobId } from "@/lib/jobs/jobs";

const traits: LogoTraits = {
  hasText: true,
  letterform: "sans",
  geometry: "geometric",
  weight: "bold",
  formality: 4,
  energy: 3,
  impression: { id: "Tegas dan modern.", en: "Bold and modern." },
  wantTags: [{ tag: "Business", weight: 1 }, { tag: "Competent", weight: 0.8 }, { tag: "Innovative", weight: 0.4 }],
  avoidTags: ["Childlike"],
  styles: ["Sans/Geometric"],
  headingCategories: ["Sans Serif", "Serif"],
  bodyCategories: ["Sans Serif"],
};

describe("shortlist font (tahap a)", () => {
  const q = {
    wantTags: [{ tag: "Playful", weight: 1 }, { tag: "Happy", weight: 0.6 }],
    avoidTags: ["Stiff"],
    styles: ["Sans/Rounded"],
    headingCategories: ["Sans Serif", "Display", "Handwriting"] as ("Sans Serif" | "Display" | "Handwriting")[],
    bodyCategories: ["Sans Serif"] as "Sans Serif"[],
  };
  const pool = buildShortlist(q);

  it("berukuran 20-36 (utama maks. 30 + kontras maks. 6), tanpa duplikat, cukup kandidat teks isi", () => {
    expect(pool.length).toBeGreaterThanOrEqual(20);
    expect(pool.filter((x) => !x.contrast).length).toBeLessThanOrEqual(SHORTLIST.max);
    expect(pool.length).toBeLessThanOrEqual(36);
    expect(new Set(pool.map((x) => x.font.family)).size).toBe(pool.length);
    expect(pool.filter((x) => x.body).length).toBeGreaterThanOrEqual(SHORTLIST.body);
  });

  it("teks isi hanya font Regular + Bold yang bukan display/tulisan tangan", () => {
    for (const x of pool.filter((p) => p.body)) {
      expect(x.font.headingOnly).toBe(false);
      expect(x.font.files.bold).toBeTruthy();
    }
  });

  it("tiap kategori heading mendapat jatah dan skor terurut", () => {
    for (const c of q.headingCategories) expect(pool.filter((x) => x.font.category === c).length).toBeGreaterThanOrEqual(3);
    const scores = pool.filter((x) => !x.contrast).map((x) => x.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("deterministik", () => {
    expect(buildShortlist(q).map((x) => x.font.family)).toEqual(pool.map((x) => x.font.family));
  });
});

describe("validasi jawaban pekerja", () => {
  it("traits: menerima yang sah, menolak nilai di luar batas atau tag asing", () => {
    expect(LogoTraitsSchema.safeParse(traits).success).toBe(true);
    expect(LogoTraitsSchema.safeParse({ ...traits, formality: 7 }).success).toBe(false);
    expect(LogoTraitsSchema.safeParse({ ...traits, wantTags: [{ tag: "Hebat", weight: 1 }] }).success).toBe(false);
    expect(LogoTraitsSchema.safeParse({ ...traits, bodyCategories: ["Display"] }).success).toBe(false);
  });

  it("pilihan dipetakan ke font; kode asing atau font heading saja untuk teks isi diganti", () => {
    const items = candidates({ ...traits, headingCategories: ["Sans Serif", "Display"] });
    const headOnly = items.find((x) => !x.body)!;
    const body = items.filter((x) => x.body);
    const pairs = PairsSchema.parse({
      A: { heading: items[0].code.toLowerCase(), body: body[0].code, reason: { id: "a", en: "a" } },
      B: { heading: "Z99", body: headOnly.code, reason: { id: "b", en: "b" } },
      notes: { id: "n", en: "n" },
    });
    const r = buildResult(traits, items, pairs, ["spesimen-1.png"]);
    expect(r.packages.A.heading.family).toBe(items[0].font.family);
    expect(r.packages.A.body.family).toBe(body[0].font.family);
    expect(r.corrections).toHaveLength(2);
    expect(r.packages.B.body.headingOnly).toBe(false);
    expect(describeCandidates(items)).toContain(`${items[0].code}: ${items[0].font.family}`);
  });
});

describe("lembar spesimen", () => {
  it("10 kandidat per lembar, lebar 1500 px", async () => {
    const items = candidates(traits);
    const sheets = await specimenSheets(items.map((x) => ({ code: x.code, font: x.font, body: x.body })), "PT <Uji> & Co");
    expect(sheets.length).toBe(Math.ceil(items.length / 10));
    for (const s of sheets) expect((await sharp(s).metadata()).width).toBe(1500);
  });
});

describe("token Drive dan job", () => {
  const secret = "x".repeat(40);
  it("enkripsi token bolak-balik, gagal dengan kunci lain", () => {
    const s = seal("refresh-token-rahasia", secret);
    expect(s).not.toContain("rahasia");
    expect(open(s, secret)).toBe("refresh-token-rahasia");
    expect(() => open(s, "y".repeat(40))).toThrow();
  });
  it("ID job berformat tanggal-acak", () => {
    expect(newJobId()).toMatch(/^\d{8}-[0-9a-f]{8}$/);
  });
});

describe("Paket B wajib beda karakter", () => {
  const sansOnly = { ...traits, headingCategories: ["Sans Serif"] as LogoTraits["headingCategories"], bodyCategories: ["Sans Serif"] as LogoTraits["bodyCategories"] };
  const items = candidates(sansOnly);

  it("shortlist menyertakan kandidat kontras (serif) walau logo hanya cocok sans", () => {
    const c = items.filter((x) => x.contrast);
    expect(c.length).toBeGreaterThanOrEqual(4);
    expect(c.length).toBeLessThanOrEqual(6);
    expect(c.every((x) => x.font.category === "Serif")).toBe(true);
    expect(c.some((x) => x.body)).toBe(true);
    expect(items.length).toBeLessThanOrEqual(36);
    expect(new Set(items.map((x) => x.font.family)).size).toBe(items.length);
  });

  it("menolak B yang sekarakter atau memakai font A, menerima B kontras", () => {
    const sans = items.filter((x) => !x.contrast && x.body);
    const serif = items.find((x) => x.contrast && x.body)!;
    const loc = { id: "x", en: "x" };
    const same = PairsSchema.parse({ A: { heading: sans[0].code, body: sans[1].code, reason: loc }, B: { heading: sans[0].code, body: sans[2].code, reason: loc }, notes: loc });
    expect(checkPackages(same, items).length).toBeGreaterThanOrEqual(1);
    const ok = PairsSchema.parse({ A: { heading: sans[0].code, body: sans[1].code, reason: loc }, B: { heading: serif.code, body: sans[2].code, reason: loc }, notes: loc });
    expect(checkPackages(ok, items)).toEqual([]);
    expect(describeCandidates(items)).toContain("[KONTRAS untuk Paket B]");
  });
});
