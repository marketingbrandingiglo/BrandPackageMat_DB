import { z } from "zod";

/**
 * Tone of voice per paket (SPEC bagian 6.4, Tahap 3e). Ditulis sesi pekerja Claude dari kesan
 * logo dan nada dasar bidang usaha, dalam bahasa Indonesia dan Inggris sekaligus. Ini hipotesis.
 */
const t = (max: number) => z.string().trim().min(1).max(max);
const loc = (max: number) => z.object({ id: t(max), en: t(max) });

export const FORMALITY = z.enum(["formal", "semi-formal", "semi-casual", "casual"]);

export const PackageToneSchema = z.object({
  /** Nuansa paket dalam satu kalimat. */
  summary: loc(220),
  personality: z.array(z.object({ trait: loc(40), desc: loc(220) })).length(3),
  voice: z.object({
    /** Sapaan, mis. "Anda; perusahaan menyebut diri 'kami'". */
    address: loc(160),
    formality: FORMALITY,
    /** Panjang dan gaya kalimat. */
    sentences: loc(200),
  }),
  do: z.array(loc(160)).min(3).max(4),
  dont: z.array(loc(160)).min(3).max(4),
  examples: z.object({
    taglines: z.array(loc(80)).length(2),
    emailOpening: loc(240),
    cta: loc(120),
    about: loc(600),
  }),
});

export const ToneSchema = z.object({
  A: PackageToneSchema,
  B: PackageToneSchema,
  /** Dasar hipotesis: dari kesan logo dan bidang usaha apa. */
  basis: loc(400),
});

export type PackageTone = z.infer<typeof PackageToneSchema>;
export type Tone = z.infer<typeof ToneSchema>;

/** A dan B harus terasa berbeda: tagline dan ringkasan tidak boleh sama. */
export function checkTone(tone: Tone): string[] {
  const out: string[] = [];
  const norm = (s: string) => s.toLowerCase().replace(/\W+/g, " ").trim();
  if (norm(tone.A.summary.id) === norm(tone.B.summary.id)) out.push("Ringkasan nuansa Paket A dan B sama; buat B terasa berbeda.");
  const ta = tone.A.examples.taglines.map((x) => norm(x.id));
  if (tone.B.examples.taglines.some((x) => ta.includes(norm(x.id)))) out.push("Tagline Paket B tidak boleh sama dengan Paket A.");
  return out;
}
