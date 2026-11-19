import { describe, expect, it } from "vitest";
import { buildShortlist } from "@/lib/brand/font-shortlist";
import { EXPRESSIVE_LABEL } from "@/lib/brand/fonts";
import { INDUSTRIES, industryById, withIndustry } from "@/lib/brand/industries";
import { checkTone, ToneSchema, type PackageTone } from "@/lib/brand/tone";

const loc = (s: string) => ({ id: s, en: s });
const pkg = (tag: string): PackageTone => ({
  summary: loc(`Nuansa ${tag}`),
  personality: [1, 2, 3].map((i) => ({ trait: loc(`Sifat ${i}`), desc: loc("Penjelasan") })),
  voice: { address: loc("Anda; kami"), formality: "semi-formal", sentences: loc("Pendek dan aktif") },
  do: [loc("a"), loc("b"), loc("c")],
  dont: [loc("x"), loc("y"), loc("z")],
  examples: { taglines: [loc(`Tagline ${tag} 1`), loc(`Tagline ${tag} 2`)], emailOpening: loc("Halo"), cta: loc("Hubungi kami"), about: loc("Kami ...") },
});

describe("pemetaan bidang usaha", () => {
  it("semua bidang usaha (kecuali Lainnya) punya tag font yang dikenal dan nada dasar", () => {
    for (const ind of INDUSTRIES) {
      if (ind.freeText) {
        expect(ind.fontWant).toBeUndefined();
        continue;
      }
      expect(ind.fontWant?.length, ind.id).toBeGreaterThanOrEqual(3);
      for (const t of [...(ind.fontWant ?? []), ...(ind.fontAvoid ?? [])]) expect(EXPRESSIVE_LABEL[t], `${ind.id} ${t}`).toBeTruthy();
      expect(ind.tone?.id && ind.tone.en && ind.tone.formality, ind.id).toBeTruthy();
    }
  });

  it("menambah tag bidang usaha dengan bobot kecil tanpa menimpa logo", () => {
    const q = { wantTags: [{ tag: "Playful", weight: 1 }, { tag: "Business", weight: 0.9 }], avoidTags: ["Loud"], styles: [], headingCategories: [], bodyCategories: [] };
    const m = withIndustry(q, "finance");
    expect(m.wantTags.find((x) => x.tag === "Business")?.weight).toBe(0.9);
    expect(m.wantTags.find((x) => x.tag === "Calm")?.weight).toBe(0.4);
    // "Playful" dihindari bidang keuangan, tetapi diinginkan logo: tidak ikut dihindari.
    expect(m.avoidTags).toContain("Loud");
    expect(m.avoidTags).toContain("Childlike");
    expect(m.avoidTags).not.toContain("Playful");
    expect(withIndustry(q, "other")).toBe(q);
    expect(withIndustry(q, undefined)).toBe(q);
    expect(industryById("fnb")?.tone?.formality).toBe("casual");
    // Bidang usaha mengubah urutan shortlist.
    const base = buildShortlist(q).map((x) => x.font.family).join();
    expect(buildShortlist(withIndustry(q, "finance")).map((x) => x.font.family).join()).not.toBe(base);
  });
});

describe("tone of voice", () => {
  it("menerima bentuk lengkap, menolak yang kurang", () => {
    const tone = { A: pkg("A"), B: pkg("B"), basis: loc("Dari logo dan bidang usaha") };
    expect(ToneSchema.safeParse(tone).success).toBe(true);
    expect(checkTone(ToneSchema.parse(tone))).toEqual([]);
    expect(ToneSchema.safeParse({ ...tone, A: { ...pkg("A"), personality: pkg("A").personality.slice(0, 2) } }).success).toBe(false);
    expect(ToneSchema.safeParse({ ...tone, B: { ...pkg("B"), voice: { ...pkg("B").voice, formality: "santai" } } }).success).toBe(false);
    expect(ToneSchema.safeParse({ ...tone, A: { ...pkg("A"), summary: { id: "x" } } }).success).toBe(false);
  });

  it("Paket B harus beda dari A", () => {
    const tone = ToneSchema.parse({ A: pkg("A"), B: { ...pkg("B"), summary: loc("Nuansa A"), examples: { ...pkg("B").examples, taglines: [loc("Tagline A 1"), loc("Lain")] } }, basis: loc("x") });
    expect(checkTone(tone)).toHaveLength(2);
  });
});
