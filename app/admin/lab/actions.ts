"use server";

import { requireSuperAdmin } from "@/lib/auth/server";
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
}

const dataUrl = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;

/** Lab Tahap 3a: periksa logo tanpa menyimpan apa pun. */
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
    };
  } catch (e) {
    if (e instanceof LogoRejected) return { error: e.message, fileName: file.name.slice(0, 120) };
    throw e;
  }
}
