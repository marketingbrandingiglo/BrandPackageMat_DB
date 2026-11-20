import type { FontSelectResult } from "@/lib/brand/font-select";
import { analyzeLogo } from "@/lib/brand/logo";
import { buildPalette, type Palette } from "@/lib/brand/palette";
import { visualKey, visualPreview, type VisualAsset, type VisualPkg, type VisualTask } from "@/lib/brand/visual";
import { download, remove, upload } from "@/lib/drive/drive";
import { getCachedVisual, putCachedVisual, saveJob, type Job } from "./jobs";

/**
 * Tahap 5: alur visual dekoratif, dipakai server aplikasi (permintaan, cache) dan skrip pekerja
 * (penyimpanan hasil Claude). Aset disimpan di folder job (Drive) dan di cache Upstash.
 */
export type FontJob = Job<FontSelectResult>;
export const PKGS: VisualPkg[] = ["A", "B"];

/** Palet dari logo job (sama dengan yang dipakai materi). */
export async function jobPalette(job: Job): Promise<{ palette: Palette; logo: Buffer }> {
  const logo = await download(job.files.logo.id);
  const rep = await analyzeLogo(logo);
  return { palette: buildPalette(rep.colors), logo };
}

async function put(job: Job, name: string, mime: string, data: Buffer) {
  const old = job.files[name];
  if (old) await remove(old.id).catch(() => {});
  const f = await upload(job.folderId, name, mime, data);
  job.files[name] = { id: f.id, name, mimeType: mime, size: f.size };
}

export async function storeVisual(job: Job, pkg: VisualPkg, svg: string, concept: VisualAsset["concept"], cached = false): Promise<VisualAsset> {
  const file = `visual-${pkg}.svg`;
  const preview = `pratinjau-visual-${pkg}.png`;
  await put(job, file, "image/svg+xml", Buffer.from(svg));
  await put(job, preview, "image/png", visualPreview(svg));
  return { file, preview, concept, cached };
}

/** Tandai selesai bila semua paket sudah punya hasil (aset atau null). */
export function completeIfReady(task: VisualTask): boolean {
  if (!PKGS.every((p) => task.result && p in task.result)) return false;
  task.status = "done";
  task.step = "Selesai";
  task.finishedAt = new Date().toISOString();
  return true;
}

/**
 * Buat tugas visual baru untuk job. Bila `fresh` false dan cache punya aset untuk kedua paket,
 * tugas langsung selesai tanpa pekerja. Mengembalikan true bila pekerja perlu dibangunkan.
 */
export async function newVisualTask(job: Job, fresh: boolean): Promise<boolean> {
  const { palette, logo } = await jobPalette(job);
  const keys = { A: visualKey(logo, palette, "A"), B: visualKey(logo, palette, "B") };
  const task: VisualTask = { status: "queued", step: "Menunggu pekerja Claude", requestedAt: new Date().toISOString(), keys, attempts: { A: 0, B: 0 } };
  job.visual = task;
  if (!fresh) {
    const hits = await Promise.all(PKGS.map((p) => getCachedVisual(job.env, keys[p])));
    if (hits.every(Boolean)) {
      task.result = {};
      for (const [i, p] of PKGS.entries()) task.result[p] = await storeVisual(job, p, hits[i]!.svg, hits[i]!.concept, true);
      completeIfReady(task);
      await saveJob(job);
      return false;
    }
  }
  return true;
}

export async function cacheVisual(job: Job, pkg: VisualPkg, svg: string, concept: VisualAsset["concept"]) {
  if (job.visual) await putCachedVisual(job.env, job.visual.keys[pkg], { svg, concept });
}
