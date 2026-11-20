"use server";

import { requireUser } from "@/lib/auth/server";
import { DriveError, DriveNotConnected } from "@/lib/drive/drive";
import { getLang } from "@/lib/i18n/server";
import { currentEnv, getJob } from "@/lib/jobs/jobs";
import { beginMaterials } from "@/lib/materials/generate";

/** Tahap 6b: mulai putaran materi dari data form (sekali; dipanggil saat pekerja selesai). */
export async function startMaterials(jobId: string): Promise<{ error?: string; started?: boolean }> {
  const { user } = await requireUser();
  const job = await getJob(currentEnv(), jobId);
  if (!job || (job.userId !== user.id && user.role !== "superadmin")) return { error: "not found" };
  const lang = (await getLang()) === "en" ? "en" : "id";
  if (job.status !== "done" || !job.result) return { error: lang === "en" ? "Not ready yet." : "Belum siap." };
  if (job.materials?.run) return { started: false };
  if (!job.input.company) return { error: lang === "en" ? "This job has no company data (created from Lab)." : "Job ini tidak punya data kontak (dibuat dari Lab)." };
  const visualPending = job.input.wantVisual && (!job.visual || job.visual.status === "queued" || job.visual.status === "working");
  if (visualPending) return { error: lang === "en" ? "The decorative visual is not finished yet." : "Visual dekoratif belum selesai." };
  try {
    await beginMaterials(job as Parameters<typeof beginMaterials>[0], job.input.company, job.input.lang ?? lang, Boolean(job.input.wantVisual));
    return { started: true };
  } catch (e) {
    if (e instanceof DriveNotConnected || e instanceof DriveError) return { error: e.message };
    throw e;
  }
}
