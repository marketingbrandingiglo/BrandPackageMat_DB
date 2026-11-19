import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildShortlist, SHORTLIST } from "@/lib/brand/font-shortlist";
import { buildResult, candidates, describe as describeCandidates, LogoTraitsSchema, PairsSchema, type LogoTraits } from "@/lib/brand/font-select";
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

  it("berukuran 20-30, tanpa duplikat, cukup kandidat teks isi", () => {
    expect(pool.length).toBeGreaterThanOrEqual(20);
    expect(pool.length).toBeLessThanOrEqual(SHORTLIST.max);
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
    const scores = pool.map((x) => x.score);
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
