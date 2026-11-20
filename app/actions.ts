"use server";

import { requireUser } from "@/lib/auth/server";
import { analyzeLogo, LogoRejected, type LogoWarning } from "@/lib/brand/logo";
import { DriveError, DriveNotConnected } from "@/lib/drive/drive";
import { DICT, LOGO_WARNING_EN } from "@/lib/i18n/dict";
import { getLang } from "@/lib/i18n/server";
import { createBrandJob } from "@/lib/jobs/create";
import { parseBrandForm } from "@/lib/brand-form";

/** Tahap 6a: form brand package untuk user (SPEC bagian 3). */

export interface LogoCheck {
  error?: string;
  warnings?: Pick<LogoWarning, "level" | "message">[];
  preview?: string;
}

/** Pengecekan logo di langkah 1 (peringatan, bukan penolakan). */
export async function checkUserLogo(form: FormData): Promise<LogoCheck> {
  await requireUser();
  const lang = await getLang();
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: DICT[lang].err.logo };
  try {
    const r = await analyzeLogo(Buffer.from(await file.arrayBuffer()));
    return {
      warnings: r.warnings.map((w) => ({ level: w.level, message: lang === "en" ? (LOGO_WARNING_EN[w.code] ?? w.message) : w.message })),
      preview: `data:image/png;base64,${r.previews.original.toString("base64")}`,
    };
  } catch (e) {
    if (e instanceof LogoRejected) return { error: e.message };
    throw e;
  }
}

export interface SubmitResult {
  error?: string;
  /** Nama field yang bermasalah, untuk fokus di form. */
  field?: string;
  jobId?: string;
}

export async function submitBrand(form: FormData): Promise<SubmitResult> {
  const { user } = await requireUser();
  const lang = await getLang();
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: DICT[lang].err.logo, field: "logo" };
  const p = await parseBrandForm(form, lang);
  if ("error" in p) return p;
  try {
    const { id } = await createBrandJob({ user, logo: Buffer.from(await file.arrayBuffer()), companyName: p.companyName, industryId: p.industryId, industryOther: p.industryOther, company: p.company, lang, wantVisual: p.wantVisual });
    return { jobId: id };
  } catch (e) {
    if (e instanceof LogoRejected) return { error: e.message, field: "logo" };
    if (e instanceof DriveNotConnected) return { error: lang === "en" ? "Storage is not connected yet. Contact the admin." : "Penyimpanan belum terhubung. Hubungi admin." };
    if (e instanceof DriveError) return { error: DICT[lang].err.generic };
    throw e;
  }
}
