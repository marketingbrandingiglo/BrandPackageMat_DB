"use server";

import { requireSuperAdmin } from "@/lib/auth/server";
import { INDUSTRIES } from "@/lib/brand/industries";
import { DriveError, DriveNotConnected } from "@/lib/drive/drive";
import { ring } from "@/lib/jobs/bell";
import { currentEnv, enqueueVisual, getJob, saveJob, type Job } from "@/lib/jobs/jobs";
import { newVisualTask } from "@/lib/jobs/visual";
import { createBrandJob } from "@/lib/jobs/create";
import type { FontSelectResult } from "@/lib/brand/font-select";
import { makeMaterials as buildMaterials, type Materials } from "@/lib/materials/generate";
import type { CompanyData, Lang } from "@/lib/materials/kit";
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
  const { user, session } = await requireSuperAdmin();
  const file = form.get("logo");
  const companyName = String(form.get("companyName") ?? "").trim().slice(0, 80);
  const industryId = String(form.get("industry") ?? "");
  const known = INDUSTRIES.find((x) => x.id === industryId);
  const other = String(form.get("industryOther") ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih file logo terlebih dulu." };
  if (!companyName) return { error: "Isi nama perusahaan untuk contoh spesimen." };
  if (known?.freeText && !other) return { error: "Bidang usaha \"Lainnya\": isi keterangan bidang usahanya." };
  try {
    const { id, belled } = await createBrandJob({ user, sessionId: session.id, logo: Buffer.from(await file.arrayBuffer()), companyName, industryId, industryOther: other });
    return { jobId: id, belled };
  } catch (e) {
    if (e instanceof LogoRejected || e instanceof DriveNotConnected) return { error: e.message };
    if (e instanceof DriveError) return { error: `Gagal menyimpan ke Google Drive: ${e.message}` };
    throw e;
  }
}

/* ---------- Tahap 4: materi dari job 3d-3e ---------- */

export interface LabMaterialsResult {
  error?: string;
  materials?: Materials;
}

const SOCIAL_FIELDS = ["instagram", "linkedin", "facebook", "x", "tiktok", "youtube", "whatsapp"] as const;

/** Lab Tahap 4: buat semua materi yang tersedia untuk Paket A dan B dari job yang selesai. */
export async function makeMaterials(_prev: LabMaterialsResult, form: FormData): Promise<LabMaterialsResult> {
  await requireSuperAdmin();
  const jobId = String(form.get("jobId") ?? "");
  const job = await getJob<FontSelectResult>(currentEnv(), jobId);
  if (!job || job.status !== "done" || !job.result) return { error: "Job tidak ditemukan atau belum selesai." };
  const field = (n: string, max: number) => String(form.get(n) ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  const email = field("email", 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Format email tidak valid." };
  const company: CompanyData = {
    name: job.input.companyName,
    email,
    phone: field("phone", 30),
    address: field("address", 160),
    socials: SOCIAL_FIELDS.map((p) => ({ platform: p, handle: field(p, 60).replace(/^https?:\/\/\S+\//, "") })).filter((s) => s.handle),
  };
  const lang: Lang = form.get("lang") === "en" ? "en" : "id";
  const useVisual = form.get("useVisual") === "on";
  try {
    return { materials: await buildMaterials(job, company, lang, useVisual) };
  } catch (e) {
    if (e instanceof DriveNotConnected) return { error: e.message };
    if (e instanceof DriveError) return { error: `Google Drive: ${e.message}` };
    throw e;
  }
}

/* ---------- Tahap 5: visual dekoratif ---------- */

export interface LabVisualRequest {
  error?: string;
  /** Tugas langsung selesai dari cache (tanpa pekerja). */
  cached?: boolean;
  belled?: boolean;
}

/** Lab Tahap 5: minta aset dekoratif Paket A dan B untuk job yang selesai. `fresh` = abaikan cache. */
export async function requestVisual(jobId: string, fresh: boolean): Promise<LabVisualRequest> {
  await requireSuperAdmin();
  const job = await getJob<FontSelectResult>(currentEnv(), jobId);
  if (!job || job.status !== "done" || !job.result) return { error: "Job tidak ditemukan atau belum selesai." };
  if (job.visual && (job.visual.status === "queued" || job.visual.status === "working")) return { error: "Visual untuk job ini sedang dikerjakan." };
  try {
    const needWorker = await newVisualTask(job as Job, fresh);
    if (!needWorker) return { cached: true };
    await enqueueVisual(job as Job);
    const belled = await ring(job.env, job.id, "visual").catch(() => false);
    job.visual!.belled = belled;
    await saveJob(job as Job);
    return { belled };
  } catch (e) {
    if (e instanceof DriveNotConnected) return { error: e.message };
    if (e instanceof DriveError) return { error: `Google Drive: ${e.message}` };
    throw e;
  }
}
