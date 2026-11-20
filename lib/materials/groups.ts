import type { Lang, MaterialKey } from "./types";

/**
 * Tahap 6d: kelompok unduhan (SPEC bagian 9). Satu kelompok = satu folder di ZIP; ID card
 * portrait dan landscape satu folder. Aman dipakai klien.
 */
export const GROUPS = ["guideline", "businessCard", "letterhead", "envelope", "idCard", "presentation", "emailSignature", "stamp"] as const;
export type GroupKey = (typeof GROUPS)[number];

export const GROUP_KEYS: Record<GroupKey, MaterialKey[]> = {
  guideline: ["guideline"],
  businessCard: ["businessCard"],
  letterhead: ["letterhead"],
  envelope: ["envelope"],
  idCard: ["idPortrait", "idLandscape"],
  presentation: ["presentation"],
  emailSignature: ["emailSignature"],
  stamp: ["stamp"],
};

const FOLDER: Record<Lang, Record<GroupKey, string>> = {
  id: {
    guideline: "01_Guideline",
    businessCard: "02_Kartu-Nama",
    letterhead: "03_Kop-Surat",
    envelope: "04_Amplop",
    idCard: "05_ID-Card",
    presentation: "06_Template-PPT",
    emailSignature: "07_Email-Signature",
    stamp: "08_Cap",
  },
  en: {
    guideline: "01_Guidelines",
    businessCard: "02_Business-Card",
    letterhead: "03_Letterhead",
    envelope: "04_Envelope",
    idCard: "05_ID-Card",
    presentation: "06_PPT-Template",
    emailSignature: "07_Email-Signature",
    stamp: "08_Stamp",
  },
};

export const groupFolder = (lang: Lang, g: GroupKey) => FOLDER[lang][g];

/** Nama perusahaan untuk nama file: karakter bermasalah dibuang (SPEC bagian 9). */
export function safeName(name: string): string {
  return name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 40) || "Perusahaan";
}

/** Nama ZIP: semua, checklist (Pilihan/Selection), atau satu materi. */
export function zipName(company: string, pkg: string, lang: Lang, groups: GroupKey[]): string {
  const base = `${safeName(company)}_BrandPackage_${pkg}`;
  if (groups.length === GROUPS.length) return `${base}.zip`;
  if (groups.length === 1) return `${base}_${groupFolder(lang, groups[0]).replace(/^\d+_/, "")}.zip`;
  return `${base}_${lang === "en" ? "Selection" : "Pilihan"}.zip`;
}
