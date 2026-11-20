/**
 * Tipe dan label materi yang aman dipakai di komponen klien (tanpa kode server).
 */
export type Lang = "id" | "en";
export type PackageKey = "A" | "B";

export interface Social {
  platform: "instagram" | "linkedin" | "facebook" | "x" | "tiktok" | "youtube" | "whatsapp";
  handle: string;
}

export interface CompanyData {
  name: string;
  email: string;
  phone: string;
  address: string;
  socials: Social[];
}

export interface MaterialPackage {
  /** File untuk diunduh (SVG/PDF), nama di folder job. */
  files: string[];
  /** PNG pratinjau, nama di folder job. */
  previews: string[];
  /** Hasil pengecekan otomatis (teks keluar area aman, tabrakan, kontras, font). */
  issues: string[];
}

export const MATERIAL_KEYS = ["businessCard", "idLandscape", "idPortrait", "envelope", "stamp", "letterhead", "presentation"] as const;
export type MaterialKey = (typeof MATERIAL_KEYS)[number];
export const MATERIAL_LABEL: Record<MaterialKey, string> = {
  businessCard: "Kartu nama",
  idLandscape: "ID card landscape",
  idPortrait: "ID card portrait",
  envelope: "Amplop",
  stamp: "Cap",
  letterhead: "Kop surat",
  presentation: "Template PPT",
};

export interface Materials {
  lang: Lang;
  company: CompanyData;
  generatedAt: string;
  items: Partial<Record<MaterialKey, Record<PackageKey, MaterialPackage>>>;
}
