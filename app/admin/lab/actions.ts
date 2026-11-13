"use server";

import Anthropic from "@anthropic-ai/sdk";
import industries from "@/data/industries.json";
import { claudeConfigured, type CallCost } from "@/lib/ai/claude";
import { requireSuperAdmin } from "@/lib/auth/server";
import { selectFonts, type LogoTraits } from "@/lib/brand/font-select";
import type { CatalogFont } from "@/lib/brand/fonts";
import { buildPalette, type Palette } from "@/lib/brand/palette";
import { analyzeLogo, LogoRejected, type BackgroundStrategy, type LogoWarning } from "@/lib/brand/logo";

export interface LabLogoResult {
  error?: string;
  fileName?: string;
  report?: {
    kind: "png" | "svg";
    bytes: number;
    width: number;
    height: number;
    transparentBackground: boolean;
    monochrome: boolean;
    warnings: LogoWarning[];
    removed: string[];
    onDark: { strategy: BackgroundStrategy; lowContrastShare: number; background: string };
    onLight: { strategy: BackgroundStrategy; lowContrastShare: number; background: string };
    previews: { original: string; monoWhite?: string; monoDark?: string };
    hasMonoSvg: boolean;
  };
  /** Tahap 3b: palet dari warna logo. */
  palette?: Palette;
}

const INDUSTRIES: { id: string; id_label: string }[] = industries.industries;

const dataUrl = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;

/** Lab Tahap 3a-3b: periksa logo dan susun palet, tanpa menyimpan apa pun. */
export async function checkLogo(_prev: LabLogoResult, form: FormData): Promise<LabLogoResult> {
  await requireSuperAdmin();
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih file logo terlebih dulu." };
  try {
    const r = await analyzeLogo(Buffer.from(await file.arrayBuffer()));
    return {
      fileName: file.name.slice(0, 120),
      report: {
        kind: r.kind,
        bytes: r.bytes,
        width: Math.round(r.width),
        height: Math.round(r.height),
        transparentBackground: r.transparentBackground,
        monochrome: r.monochrome,
        warnings: r.warnings,
        removed: r.sanitized?.removed ?? [],
        onDark: r.onDark,
        onLight: r.onLight,
        previews: {
          original: dataUrl(r.previews.original),
          monoWhite: r.previews.monoWhite && dataUrl(r.previews.monoWhite),
          monoDark: r.previews.monoDark && dataUrl(r.previews.monoDark),
        },
        hasMonoSvg: Boolean(r.monoSvg),
      },
      palette: r.colors.length ? buildPalette(r.colors) : undefined,
    };
  } catch (e) {
    if (e instanceof LogoRejected) return { error: e.message, fileName: file.name.slice(0, 120) };
    throw e;
  }
}

/* ---------- Tahap 3d: analisis logo dan pasangan font oleh Claude ---------- */

export interface LabFontRef {
  family: string;
  category: string;
  headingOnly: boolean;
  regular: string;
  bold?: string;
  specimen: string;
}

export interface LabFontResult {
  error?: string;
  companyName?: string;
  industry?: string;
  traits?: LogoTraits;
  shortlist?: { code: string; family: string; category: string; score: number; heading: boolean; body: boolean }[];
  packages?: Record<"A" | "B", { heading: LabFontRef; body: LabFontRef; reason: { id: string; en: string } }>;
  notes?: { id: string; en: string };
  corrections?: string[];
  sheets?: string[];
  calls?: CallCost[];
  totalUsd?: number;
}

const ref = (f: CatalogFont): LabFontRef => ({
  family: f.family,
  category: f.category,
  headingOnly: f.headingOnly,
  regular: f.files.regular,
  bold: f.files.bold,
  specimen: f.specimen,
});

/** Lab Tahap 3d: memanggil Claude dua kali (analisis logo, pilih pasangan font). Tidak menyimpan apa pun. */
export async function chooseFonts(_prev: LabFontResult, form: FormData): Promise<LabFontResult> {
  await requireSuperAdmin();
  const file = form.get("logo");
  const companyName = String(form.get("companyName") ?? "").trim().slice(0, 80);
  const industryId = String(form.get("industry") ?? "");
  const industry = INDUSTRIES.find((x) => x.id === industryId)?.id_label;
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih file logo terlebih dulu." };
  if (!companyName) return { error: "Isi nama perusahaan untuk contoh spesimen." };
  if (!claudeConfigured()) return { error: "ANTHROPIC_API_KEY belum diisi di .env.local. Lihat docs/claude.md." };
  try {
    const r = await analyzeLogo(Buffer.from(await file.arrayBuffer()));
    const s = await selectFonts({
      logoPng: r.previews.original,
      darkBackground: r.transparentBackground && r.onLight.strategy !== "original",
      companyName,
      industry,
    });
    return {
      companyName,
      industry,
      traits: s.traits,
      shortlist: s.shortlist.map((x) => ({ code: x.code, family: x.font.family, category: x.font.category, score: x.score, heading: x.heading, body: x.body })),
      packages: {
        A: { heading: ref(s.packages.A.heading), body: ref(s.packages.A.body), reason: s.packages.A.reason },
        B: { heading: ref(s.packages.B.heading), body: ref(s.packages.B.body), reason: s.packages.B.reason },
      },
      notes: s.notes,
      corrections: s.corrections,
      sheets: s.sheets.map(dataUrl),
      calls: s.calls,
      totalUsd: s.calls.reduce((a, c) => a + c.usd, 0),
    };
  } catch (e) {
    if (e instanceof LogoRejected) return { error: e.message };
    if (e instanceof Anthropic.AuthenticationError) return { error: "API key Anthropic ditolak. Periksa ANTHROPIC_API_KEY." };
    if (e instanceof Anthropic.PermissionDeniedError) return { error: "API key tidak punya akses ke model ini." };
    if (e instanceof Anthropic.RateLimitError) return { error: "Batas pemakaian Claude tercapai. Coba lagi beberapa saat lagi." };
    if (e instanceof Anthropic.APIError) return { error: `Claude API error ${e.status ?? ""}. Coba lagi.` };
    if (e instanceof Error && /^(Claude|Jawaban Claude)/.test(e.message)) return { error: e.message };
    throw e;
  }
}
