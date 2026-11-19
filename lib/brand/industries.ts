import data from "@/data/industries.json";
import type { ShortlistInput } from "./font-shortlist";

/**
 * Bidang usaha dan pemetaannya ke karakter font dan nada dasar tone of voice
 * (SPEC bagian 3 dan 17; disetujui pemilik 2026-11-19). Logo tetap penentu utama:
 * tag dari bidang usaha hanya menambah dengan bobot kecil.
 */
export type Formality = "formal" | "semi-formal" | "semi-casual" | "casual";

export interface Industry {
  id: string;
  id_label: string;
  en_label: string;
  freeText?: boolean;
  fontWant?: string[];
  fontAvoid?: string[];
  tone?: { id: string; en: string; formality: Formality };
}

export const INDUSTRIES = (data as { industries: Industry[] }).industries;

export const FORMALITY_LABEL: Record<Formality, { id: string; en: string }> = {
  formal: { id: "formal", en: "formal" },
  "semi-formal": { id: "semi formal", en: "semi-formal" },
  "semi-casual": { id: "semi santai", en: "semi-casual" },
  casual: { id: "santai", en: "casual" },
};

export function industryById(id?: string): Industry | undefined {
  return id ? INDUSTRIES.find((x) => x.id === id) : undefined;
}

/** Bobot tag dari bidang usaha (logo memakai bobot 0-1 dari Claude). */
export const INDUSTRY_TAG_WEIGHT = 0.4;

/** Gabungkan kriteria font dari logo dengan pemetaan bidang usaha. */
export function withIndustry<T extends ShortlistInput>(q: T, industryId?: string): T {
  const ind = industryById(industryId);
  if (!ind?.fontWant) return q;
  const want = [...q.wantTags];
  for (const tag of ind.fontWant) if (!want.some((w) => w.tag === tag)) want.push({ tag, weight: INDUSTRY_TAG_WEIGHT });
  // Tag yang diinginkan logo tidak ikut dihindari walau bidang usaha menghindarinya.
  const avoid = [...new Set([...q.avoidTags, ...(ind.fontAvoid ?? []).filter((t) => !q.wantTags.some((w) => w.tag === t))])];
  return { ...q, wantTags: want, avoidTags: avoid };
}
