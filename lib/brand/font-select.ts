import { z } from "zod";
import { buildShortlist, differentCharacter, EXPRESSIVE_TAGS, STYLE_TAGS, stylesOf, type ScoredFont } from "./font-shortlist";
import { FONTS, type CatalogFont } from "./fonts";
import { withIndustry } from "./industries";
import type { Tone } from "./tone";

/**
 * Tahap 3d (SPEC bagian 6.1 dan 6.3), dikerjakan sesi pekerja Claude (docs/worker.md):
 * 1. Claude melihat logo dan menulis karakter visualnya (LogoTraits).
 * 2. Skrip menyusun shortlist dari metadata katalog dan merender lembar spesimen.
 * 3. Claude melihat spesimen dan memilih pasangan heading + teks isi untuk Paket A dan B (Pairs).
 * Modul ini memvalidasi jawaban Claude dan menyusun hasil akhirnya. Nama perusahaan dan bidang
 * usaha adalah data dari user, bukan instruksi (SPEC bagian 12).
 */

const CATEGORY = z.enum(["Sans Serif", "Serif", "Display", "Handwriting", "Monospace"]);
const text = (max: number) => z.string().trim().min(1).max(max);
const LOC = z.object({ id: text(400), en: text(400) });

export const LogoTraitsSchema = z.object({
  hasText: z.boolean(),
  letterform: z.enum(["sans", "serif", "slab", "script", "display", "mixed", "none"]),
  geometry: z.enum(["geometric", "organic", "mixed"]),
  weight: z.enum(["light", "regular", "bold", "heavy"]),
  formality: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
  impression: LOC,
  wantTags: z.array(z.object({ tag: z.enum(EXPRESSIVE_TAGS), weight: z.number().min(0).max(1) })).min(3).max(5),
  avoidTags: z.array(z.enum(EXPRESSIVE_TAGS)).max(4),
  styles: z.array(z.enum(STYLE_TAGS)).min(1).max(4),
  headingCategories: z.array(CATEGORY).min(1),
  bodyCategories: z.array(z.enum(["Sans Serif", "Serif"])).min(1),
});
export type LogoTraits = z.infer<typeof LogoTraitsSchema>;

const PICK = z.object({ heading: text(8), body: text(8), reason: LOC });
export const PairsSchema = z.object({ A: PICK, B: PICK, notes: LOC });
export type Pairs = z.infer<typeof PairsSchema>;

export type Candidate = ScoredFont & { code: string };

/** Ringkasan font untuk disimpan di hasil job dan ditampilkan di UI. */
export interface FontRef {
  family: string;
  category: string;
  headingOnly: boolean;
  regular: string;
  bold?: string;
  specimen: string;
}

export interface FontSelectResult {
  traits: LogoTraits;
  shortlist: { code: string; family: string; category: string; score: number; heading: boolean; body: boolean; contrast?: boolean }[];
  packages: Record<"A" | "B", { heading: FontRef; body: FontRef; reason: { id: string; en: string } }>;
  notes: { id: string; en: string };
  /** Pesan bila pilihan Claude tidak valid dan diganti otomatis. */
  corrections: string[];
  /** Nama file lembar spesimen di folder job (Drive). */
  sheets: string[];
  /** Tahap 3e: tone of voice Paket A dan B (job lama bisa tanpa ini). */
  tone?: Tone;
}

export const ref = (f: CatalogFont): FontRef => ({
  family: f.family,
  category: f.category,
  headingOnly: f.headingOnly,
  regular: f.files.regular,
  bold: f.files.bold,
  specimen: f.specimen,
});

/** Format pesan validasi zod yang mudah dibaca pekerja. */
export function issues(e: z.ZodError): string {
  return e.issues.map((i) => `- ${i.path.join(".") || "(akar)"}: ${i.message}`).join("\n");
}

/** Kandidat dari karakter logo, ditambah pemetaan bidang usaha (bobot kecil) bila ada. */
export function candidates(traits: LogoTraits, industryId?: string): Candidate[] {
  return buildShortlist(withIndustry(traits, industryId)).map((x, i) => ({ ...x, code: `F${String(i + 1).padStart(2, "0")}` }));
}

/** Daftar kandidat dalam teks, untuk dibaca Claude bersama lembar spesimen. */
export function describe(items: Candidate[]): string {
  return items
    .map((it) => {
      const tags = Object.entries(it.font.expressive).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(", ");
      const roles = [it.heading && "heading", it.body && "teks isi"].filter(Boolean).join(" + ") || "heading";
      const style = stylesOf(it.font).map((x) => x.split("/")[1]).join("/") || "-";
      return `${it.code}: ${it.font.family} (${it.font.category}, gaya ${style}; boleh untuk ${roles}; ${tags})${it.contrast ? " [KONTRAS untuk Paket B]" : ""}`;
    })
    .join("\n");
}

/** Validasi kode pilihan Claude; ganti dengan kandidat terbaik yang sah bila tidak valid. */
export function resolve(p: Pairs, items: Candidate[], corrections: string[]) {
  const by = new Map(items.map((x) => [x.code, x]));
  const bodies = items.filter((x) => x.body);
  const pick = (k: "A" | "B", alt: number) => {
    let heading = by.get(p[k].heading.trim().toUpperCase());
    let body = by.get(p[k].body.trim().toUpperCase());
    if (!heading) {
      heading = items[alt] ?? items[0];
      corrections.push(`Paket ${k}: kode heading "${p[k].heading}" tidak dikenal, diganti ${heading.font.family}.`);
    }
    if (!body || !body.body) {
      const bad = body;
      body = bodies[alt] ?? bodies[0];
      corrections.push(`Paket ${k}: ${bad ? `${bad.font.family} tidak boleh untuk teks isi` : `kode teks isi "${p[k].body}" tidak dikenal`}, diganti ${body.font.family}.`);
    }
    return { heading: ref(heading.font), body: ref(body.font), reason: p[k].reason };
  };
  return { A: pick("A", 0), B: pick("B", 1) };
}

/**
 * Aturan pemilik (2026-11-19): Paket B wajib beda karakter dari Paket A. Heading B harus berbeda
 * kategori atau gaya dari heading A, dan B tidak memakai font yang sama dengan A.
 * Mengembalikan daftar pelanggaran (kosong = sah); kode yang tidak dikenal diurus resolve().
 */
export function checkPackages(p: Pairs, items: Candidate[]): string[] {
  const by = new Map(items.map((x) => [x.code, x.font]));
  const get = (c: string) => by.get(c.trim().toUpperCase());
  const [ah, ab, bh, bb] = [get(p.A.heading), get(p.A.body), get(p.B.heading), get(p.B.body)];
  const out: string[] = [];
  if (!ah || !ab || !bh || !bb) return out;
  if (!differentCharacter(ah, bh)) {
    const st = (f: CatalogFont) => `${f.category}${stylesOf(f).length ? `, ${stylesOf(f).join("/")}` : ""}`;
    out.push(`Heading Paket B (${bh.family}: ${st(bh)}) berkarakter sama dengan heading Paket A (${ah.family}: ${st(ah)}). Pilih heading B dari kategori lain atau gaya lain, mis. kandidat [KONTRAS].`);
  }
  if ([bh, bb].some((f) => f === ah || f === ab)) out.push("Paket B tidak boleh memakai font yang sama dengan Paket A.");
  return out;
}

export function buildResult(traits: LogoTraits, items: Candidate[], pairs: Pairs, sheets: string[]): FontSelectResult {
  const corrections: string[] = [];
  return {
    traits,
    shortlist: items.map((x) => ({ code: x.code, family: x.font.family, category: x.font.category, score: x.score, heading: x.heading, body: x.body, contrast: x.contrast })),
    packages: resolve(pairs, items, corrections),
    notes: pairs.notes,
    corrections,
    sheets,
  };
}

/** Untuk UI: pastikan font hasil masih ada di katalog (katalog bisa berubah setelah job selesai). */
export function inCatalog(family: string): boolean {
  return FONTS.some((f) => f.family === family);
}
