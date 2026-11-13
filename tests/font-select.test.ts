import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Claude disimulasikan: tidak ada panggilan jaringan di tes.
const calls: { effort?: string; images: number; text: string }[] = [];
let pairsAnswer: unknown;
vi.mock("@/lib/ai/claude", async (orig) => {
  const real = await orig<typeof import("@/lib/ai/claude")>();
  return {
    ...real,
    claude: () => ({
      beta: {
        messages: {
          parse: async (p: { output_config: { effort: string }; messages: { content: { type: string; text?: string }[] }[] }) => {
            const content = p.messages[0].content;
            calls.push({ effort: p.output_config.effort, images: content.filter((c) => c.type === "image").length, text: content.map((c) => c.text ?? "").join("\n") });
            const usage = { input_tokens: 5000, output_tokens: 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, iterations: null };
            const traits = {
              hasText: true, letterform: "sans", geometry: "geometric", weight: "bold", formality: 4, energy: 3,
              impression: { id: "Tegas dan modern.", en: "Bold and modern." },
              wantTags: [{ tag: "Business", weight: 1 }, { tag: "Competent", weight: 0.8 }],
              avoidTags: ["Childlike"], styles: ["Sans/Geometric"],
              headingCategories: ["Sans Serif", "Serif"], bodyCategories: ["Sans Serif"],
            };
            return { stop_reason: "end_turn", usage, parsed_output: calls.length === 1 ? traits : pairsAnswer };
          },
        },
      },
    }),
  };
});

const { buildShortlist, SHORTLIST } = await import("@/lib/brand/font-shortlist");
const { selectFonts } = await import("@/lib/brand/font-select");
const { costOf } = await import("@/lib/ai/claude");

const logo = await sharp({ create: { width: 300, height: 120, channels: 4, background: { r: 232, g: 40, b: 39, alpha: 1 } } }).png().toBuffer();

describe("shortlist font (tahap a)", () => {
  const q = {
    wantTags: [{ tag: "Playful", weight: 1 }, { tag: "Happy", weight: 0.6 }],
    avoidTags: ["Stiff"],
    styles: ["Sans/Rounded"],
    headingCategories: ["Sans Serif", "Display", "Handwriting"] as const,
    bodyCategories: ["Sans Serif"] as const,
  };
  const pool = buildShortlist({ ...q, headingCategories: [...q.headingCategories], bodyCategories: [...q.bodyCategories] });

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
    const again = buildShortlist({ ...q, headingCategories: [...q.headingCategories], bodyCategories: [...q.bodyCategories] });
    expect(again.map((x) => x.font.family)).toEqual(pool.map((x) => x.font.family));
  });
});

describe("pilih pasangan font (tahap b, Claude disimulasikan)", () => {
  it("mengirim logo dan lembar spesimen, memetakan kode ke font", async () => {
    calls.length = 0;
    pairsAnswer = {
      A: { heading: "F01", body: "f02", reason: { id: "a", en: "a" } },
      B: { heading: "F03", body: "F04", reason: { id: "b", en: "b" } },
      notes: { id: "n", en: "n" },
    };
    const s = await selectFonts({ logoPng: logo, darkBackground: false, companyName: "PT <Uji> Sejahtera", industry: "Keuangan" });
    expect(calls).toHaveLength(2);
    expect(calls[0].images).toBe(1);
    expect(calls[1].images).toBe(1 + s.sheets.length);
    expect(calls[1].effort).toBe("high");
    // Data user dibungkus dan dibersihkan dari tanda kurung sudut.
    expect(calls[0].text).toContain("<data_user>");
    expect(calls[0].text).toContain("PT Uji Sejahtera");
    const byCode = new Map(s.shortlist.map((x) => [x.code, x.font.family]));
    expect(s.packages.A.heading.family).toBe(byCode.get("F01"));
    expect(s.packages.A.body.family).toBe(byCode.get("F02"));
    expect(s.sheets.length).toBe(Math.ceil(s.shortlist.length / 10));
    for (const sh of s.sheets) expect((await sharp(sh).metadata()).width).toBe(1500);
    expect(s.calls.reduce((a, c) => a + c.usd, 0)).toBeGreaterThan(0);
  });

  it("kode tidak dikenal atau font heading saja untuk teks isi diganti otomatis", async () => {
    calls.length = 0;
    pairsAnswer = {
      A: { heading: "Z99", body: "F01", reason: { id: "a", en: "a" } },
      B: { heading: "F02", body: "nope", reason: { id: "b", en: "b" } },
      notes: { id: "n", en: "n" },
    };
    const s = await selectFonts({ logoPng: logo, darkBackground: true, companyName: "Uji" });
    expect(s.corrections.length).toBeGreaterThanOrEqual(2);
    expect(s.packages.B.body.headingOnly).toBe(false);
    expect(s.packages.A.body.headingOnly).toBe(false);
  });
});

describe("biaya Claude", () => {
  it("menghitung per model, termasuk iterasi fallback", () => {
    const c = costOf("x", "claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 100_000 }, 10);
    expect(c.usd).toBeCloseTo(4 + 2, 5);
    const f = costOf("x", "claude-opus-5-5", {
      input_tokens: 2000, output_tokens: 2000,
      iterations: [
        { type: "message", model: "claude-opus-5-5", input_tokens: 1000, output_tokens: 1000 },
        { type: "fallback_message", model: "claude-opus-4-8", input_tokens: 1000, output_tokens: 1000 },
      ],
    }, 10);
    expect(f.fellBack).toBe(true);
    expect(f.usd).toBeCloseTo((1000 * 4 + 1000 * 20 + 1000 * 5 + 1000 * 25) / 1e6, 8);
  });
});
