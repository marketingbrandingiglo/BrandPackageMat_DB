"use server";

import industries from "@/data/industries.json";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createFolder, DriveError, DriveNotConnected, envFolder, upload } from "@/lib/drive/drive";
import { ring } from "@/lib/jobs/bell";
import { currentEnv, enqueue, newJobId, saveJob, type Job } from "@/lib/jobs/jobs";
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

/* ---------- Tahap 3d: permintaan pasangan font ke sesi pekerja Claude ---------- */

export interface LabFontRequest {
  error?: string;
  jobId?: string;
  belled?: boolean;
}

/**
 * Lab Tahap 3d: simpan logo ke Drive, buat job, bunyikan bel. Hasil dikerjakan sesi pekerja
 * (beberapa menit) dan dipantau UI lewat /api/jobs/<id>.
 */
export async function requestFonts(_prev: LabFontRequest, form: FormData): Promise<LabFontRequest> {
  const { user } = await requireSuperAdmin();
  const file = form.get("logo");
  const companyName = String(form.get("companyName") ?? "").trim().slice(0, 80);
  const industryId = String(form.get("industry") ?? "");
  const industry = INDUSTRIES.find((x) => x.id === industryId)?.id_label;
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih file logo terlebih dulu." };
  if (!companyName) return { error: "Isi nama perusahaan untuk contoh spesimen." };
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const r = await analyzeLogo(buf);
    const env = currentEnv();
    const id = newJobId();
    const folderId = await createFolder(id, await envFolder(env));
    const ext = r.kind === "svg" ? "svg" : "png";
    const logo = await upload(folderId, `logo-asli.${ext}`, r.kind === "svg" ? "image/svg+xml" : "image/png", r.kind === "svg" && r.sanitized ? Buffer.from(r.sanitized.svg) : buf);
    const preview = await upload(folderId, "logo-pratinjau.png", "image/png", r.previews.original);
    const now = new Date().toISOString();
    const job: Job = {
      id,
      env,
      type: "font-select",
      userId: user.id,
      userEmail: user.email,
      status: "queued",
      step: "Menunggu pekerja Claude",
      createdAt: now,
      updatedAt: now,
      input: { companyName, industry, darkBackground: r.transparentBackground && r.onLight.strategy !== "original" },
      folderId,
      files: {
        logo: { id: logo.id, name: logo.name, mimeType: logo.mimeType, size: logo.size },
        preview: { id: preview.id, name: preview.name, mimeType: preview.mimeType, size: preview.size },
      },
      belled: false,
    };
    await enqueue(job);
    job.belled = await ring(env, id).catch(() => false);
    if (job.belled) await saveJob(job);
    return { jobId: id, belled: job.belled };
  } catch (e) {
    if (e instanceof LogoRejected || e instanceof DriveNotConnected) return { error: e.message };
    if (e instanceof DriveError) return { error: `Gagal menyimpan ke Google Drive: ${e.message}` };
    throw e;
  }
}
