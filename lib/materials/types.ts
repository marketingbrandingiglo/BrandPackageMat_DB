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
  /** Alamat dan telepon tambahan (maks. 2 masing-masing), hanya di footer kop surat (keputusan 2026-11-20). */
  extraAddresses?: string[];
  extraPhones?: string[];
}

export interface MaterialPackage {
  /** File untuk diunduh (SVG/PDF), nama di folder job. */
  files: string[];
  /** PNG pratinjau, nama di folder job. */
  previews: string[];
  /** Hasil pengecekan otomatis (teks keluar area aman, tabrakan, kontras, font). */
  issues: string[];
}

export const MATERIAL_KEYS = ["businessCard", "idLandscape", "idPortrait", "envelope", "stamp", "letterhead", "presentation", "emailSignature", "guideline"] as const;
export type MaterialKey = (typeof MATERIAL_KEYS)[number];
export const MATERIAL_LABEL: Record<MaterialKey, string> = {
  businessCard: "Kartu nama",
  idLandscape: "ID card landscape",
  idPortrait: "ID card portrait",
  envelope: "Amplop",
  stamp: "Cap",
  letterhead: "Kop surat",
  presentation: "Template PPT",
  emailSignature: "Email signature",
  guideline: "Guideline",
};

export interface Materials {
  lang: Lang;
  company: CompanyData;
  generatedAt: string;
  items: Partial<Record<MaterialKey, Record<PackageKey, MaterialPackage>>>;
  /** Tahap 5: paket yang memakai visual dekoratif. */
  visual?: Record<PackageKey, boolean>;
  /** Tahap 6b: ID putaran pembuatan; hasil tugas tersimpan terpisah (generate.ts). */
  run?: string;
  /** Tahap 6c: ringkasan per paket untuk perbandingan (font, warna, tone). */
  overview?: Record<PackageKey, PackageOverview>;
}

export interface PackageOverview {
  heading: { family: string; category: string };
  body: { family: string; category: string };
  colors: { hex: string; name: { id: string; en: string } }[];
  tone?: { summary: { id: string; en: string }; traits: { id: string; en: string }[]; tagline: { id: string; en: string } };
}

/** Nama file logo yang dirujuk relatif oleh signature.html (Tahap 4f). */
export const SIGNATURE_LOGO_FILE = "logo-email.png";
