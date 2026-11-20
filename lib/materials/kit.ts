import path from "node:path";
import type { FontRef } from "@/lib/brand/font-select";
import type { Palette, Swatch } from "@/lib/brand/palette";
import type { FontFamily } from "@/lib/render/fonts";

/**
 * Semua bahan untuk membuat materi satu paket (Tahap 4): data perusahaan, logo, palet,
 * pasangan font, bahasa. Dibuat dari hasil job 3d-3e + data perusahaan.
 */
import type { CompanyData, Lang, PackageKey, Social } from "./types";

export type { CompanyData, Lang, PackageKey, Social } from "./types";

export interface KitLogo {
  kind: "svg" | "png";
  /** SVG yang sudah disanitasi (kind svg). */
  svg?: string;
  /** PNG resolusi terbaik yang tersedia (selalu ada; dipakai untuk kind png). */
  png: Buffer;
  /** Rasio lebar/tinggi. */
  aspect: number;
  /** Logo memuat huruf (wordmark); bila tidak, nama perusahaan ditulis di samping/bawah logo. */
  hasText: boolean;
}

export interface BrandKit {
  pkg: PackageKey;
  lang: Lang;
  company: CompanyData;
  logo: KitLogo;
  palette: Palette;
  fonts: { heading: FontRef; body: FontRef };
  /** Tahap 5: aset dekoratif SVG paket ini (opsional). */
  visual?: string;
}

const LIB = path.join(process.cwd(), "fonts/lib");

/** Registri font untuk render (nama family katalog -> file absolut). */
export function kitFonts(kit: BrandKit): Record<string, FontFamily> {
  const out: Record<string, FontFamily> = {};
  for (const f of [kit.fonts.heading, kit.fonts.body]) {
    out[f.family] = { regular: path.join(LIB, f.regular), ...(f.bold ? { bold: path.join(LIB, f.bold) } : {}) };
  }
  return out;
}

/** Warna-warna yang dipakai template, sudah dipilih aman kontrasnya. */
export interface KitColors {
  primary: string;
  /** Warna utama untuk teks di atas putih (>= 4,5:1). */
  primaryText: string;
  /** Aksen paket (warna pendukung pertama). */
  accent: string;
  /** Aksen paket yang aman untuk teks kecil di atas putih. */
  accentText: string;
  /** Latar lembut paket. */
  tint: string;
  dark: string;
  mid: string;
  light: string;
  /** Teks di atas warna utama ("#FFFFFF" atau gelap). */
  onPrimary: string;
}

export function kitColors(kit: BrandKit): KitColors {
  const p = kit.palette;
  const pack = p.packages[kit.pkg].supporting;
  // Logo berwarna: [aksen 1, aksen 2, latar lembut]; logo tanpa warna: [netral, netral].
  const strong = pack.slice(0, 2);
  const tint = pack.length >= 3 ? pack[2] : p.neutrals[3];
  const accent: Swatch = strong[0] ?? p.primary;
  const primaryText = (p.primaryText ?? p.primary).hex;
  return {
    primary: p.primary.hex,
    primaryText,
    accent: accent.hex,
    accentText: accent.onWhite >= 4.5 ? accent.hex : primaryText,
    tint: tint.hex,
    dark: p.neutrals[0].hex,
    mid: p.neutrals[1].hex,
    light: p.neutrals[2].hex,
    onPrimary: p.primary.textOn === "white" ? "#FFFFFF" : p.neutrals[0].hex,
  };
}

export const PLACEHOLDER: Record<Lang, { name: string; title: string; phone: string; photo: string; idNumber: string; found: string; to: string }> = {
  id: {
    name: "Nama Lengkap",
    title: "Jabatan",
    phone: "Telp",
    photo: "Foto",
    idNumber: "No. ID 0000 0000",
    found: "Bila menemukan kartu ini, mohon kembalikan ke alamat di atas.",
    to: "Kepada Yth.",
  },
  en: {
    name: "Full Name",
    title: "Job Title",
    phone: "Tel",
    photo: "Photo",
    idNumber: "ID No. 0000 0000",
    found: "If found, please return this card to the address above.",
    to: "To",
  },
};

const SOCIAL_LABEL: Record<Social["platform"], string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
};

export function socialLine(s: Social): string {
  const h = s.handle.trim();
  return `${SOCIAL_LABEL[s.platform]} ${s.platform === "whatsapp" || h.startsWith("@") ? h : `@${h}`}`;
}

/** Normalisasi sederhana nomor Indonesia: 0812... -> +62 812-... (SPEC bagian 3). */
export function formatPhone(raw: string): string {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("0")) d = `+62${d.slice(1)}`;
  else if (d.startsWith("62")) d = `+${d}`;
  const m = /^\+62(\d+)$/.exec(d);
  if (!m) return raw.trim();
  const n = m[1];
  // Seluler (8xx): +62 812-3456-7890; telepon rumah/kantor: +62 21 1234 5678.
  if (n.startsWith("8")) return `+62 ${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7)}`.replace(/-$/, "");
  const area = n.startsWith("21") || n.startsWith("22") || n.startsWith("24") || n.startsWith("31") ? n.slice(0, 2) : n.slice(0, 3);
  const rest = n.slice(area.length);
  return `+62 ${area} ${rest.slice(0, 4)} ${rest.slice(4)}`.trim();
}
