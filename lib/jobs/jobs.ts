import { randomBytes } from "node:crypto";
import { appEnv } from "@/lib/env";
import { APP_KEY_PREFIX, redis } from "@/lib/redis";
import type { VisualTask } from "@/lib/brand/visual-types";
import type { CompanyData, Materials } from "@/lib/materials/types";

/**
 * Job untuk sesi pekerja Claude (SPEC bagian 8). Disimpan di Upstash per environment,
 * TTL 90 hari (SPEC bagian 10). Antrean diproses berurutan oleh satu sesi pekerja yang
 * melayani dev dan production; isi job yang sah hanya yang ada di sini, bukan komentar PR.
 */

export type JobEnv = "dev" | "prod";
export type JobStatus = "queued" | "working" | "done" | "failed";
export const JOB_TTL_SECONDS = 90 * 24 * 60 * 60;

export interface JobFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface FontSelectInput {
  companyName: string;
  /** Label bidang usaha (atau isi bebas bila "Lainnya"), data dari user. */
  industry?: string;
  /** ID di data/industries.json, untuk pemetaan font dan nada dasar. */
  industryId?: string;
  /** True bila logo perlu latar gelap agar terbaca. */
  darkBackground: boolean;
  /** Tahap 6 (form user): data kontak, bahasa materi, dan permintaan visual dekoratif. */
  company?: CompanyData;
  lang?: "id" | "en";
  wantVisual?: boolean;
  /** Label bidang usaha dalam bahasa Inggris (untuk tampilan EN). */
  industryEn?: string;
}

export interface Job<R = unknown> {
  id: string;
  env: JobEnv;
  type: "font-select";
  userId: string;
  userEmail: string;
  status: JobStatus;
  /** Langkah terakhir yang dikerjakan pekerja, untuk ditampilkan di UI. */
  step?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  input: FontSelectInput;
  /** Folder job di Drive dan file di dalamnya. */
  folderId: string;
  files: Record<string, JobFile>;
  belled: boolean;
  result?: R;
  error?: string;
  /** Tahap 5: visual dekoratif (opsional, diminta terpisah setelah job selesai). */
  visual?: VisualTask;
  /** Tahap 4/6b: putaran materi terakhir (hasil per tugas di hash terpisah). */
  materials?: Materials;
  /** Tahap 6c: paket yang dipilih user; file paket lain sudah dihapus. */
  chosen?: { pkg: "A" | "B"; at: string };
}

export const currentEnv = (): JobEnv => (appEnv() === "production" ? "prod" : "dev");
export const k = (env: JobEnv, ...parts: string[]) => [APP_KEY_PREFIX, env, ...parts].join(":");

export function newJobId(): string {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  return `${ymd}-${randomBytes(4).toString("hex")}`;
}

export async function saveJob(job: Job): Promise<void> {
  job.updatedAt = new Date().toISOString();
  await redis().set(k(job.env, "job", job.id), job, { ex: JOB_TTL_SECONDS });
}

export async function getJob<R = unknown>(env: JobEnv, id: string): Promise<Job<R> | null> {
  if (!/^[0-9]{8}-[0-9a-f]{8}$/.test(id)) return null;
  return redis().get<Job<R>>(k(env, "job", id));
}

/** Simpan job baru, masukkan ke antrean dan indeks riwayat. */
export async function enqueue(job: Job): Promise<void> {
  await saveJob(job);
  const score = Date.parse(job.createdAt);
  const p = redis().pipeline();
  p.rpush(k(job.env, "jobs", "queue"), job.id);
  p.zadd(k(job.env, "jobs", "user", job.userId), { score, member: job.id });
  p.zadd(k(job.env, "jobs", "all"), { score, member: job.id });
  await p.exec();
}

export async function queued(env: JobEnv): Promise<string[]> {
  return redis().lrange(k(env, "jobs", "queue"), 0, -1);
}

/** Pekerja mulai: keluarkan dari antrean, status working. */
export async function startJob(job: Job): Promise<void> {
  await redis().lrem(k(job.env, "jobs", "queue"), 0, job.id);
  job.status = "working";
  job.startedAt ??= new Date().toISOString();
  job.error = undefined;
  await saveJob(job);
}

export async function finishJob<R>(job: Job<R>, result: R): Promise<void> {
  job.status = "done";
  job.result = result;
  job.step = "Selesai";
  job.finishedAt = new Date().toISOString();
  await saveJob(job as Job);
}

export async function failJob(job: Job, reason: string): Promise<void> {
  await redis().lrem(k(job.env, "jobs", "queue"), 0, job.id);
  job.status = "failed";
  job.error = reason.slice(0, 300);
  job.finishedAt = new Date().toISOString();
  await saveJob(job);
}

/** Riwayat: job milik user (terbaru dulu), atau semua bila userId tidak diisi (super admin). */
export async function listJobs(env: JobEnv, userId?: string, limit = 50): Promise<Job[]> {
  const z = userId ? k(env, "jobs", "user", userId) : k(env, "jobs", "all");
  const ids = await redis().zrange<string[]>(z, 0, limit - 1, { rev: true });
  if (!ids.length) return [];
  const jobs = await redis().mget<(Job | null)[]>(...ids.map((id) => k(env, "job", id)));
  // Job yang TTL-nya habis dibersihkan dari indeks.
  const gone = ids.filter((_, i) => !jobs[i]);
  if (gone.length) await redis().zrem(z, ...gone);
  return jobs.filter((j): j is Job => !!j);
}

/* ---------- Tahap 5: antrean visual dekoratif ---------- */

export async function enqueueVisual(job: Job): Promise<void> {
  await saveJob(job);
  const q = k(job.env, "visual", "queue");
  await redis().lrem(q, 0, job.id);
  await redis().rpush(q, job.id);
}

export async function queuedVisual(env: JobEnv): Promise<string[]> {
  return redis().lrange(k(env, "visual", "queue"), 0, -1);
}

export async function dequeueVisual(job: Job): Promise<void> {
  await redis().lrem(k(job.env, "visual", "queue"), 0, job.id);
}

export interface CachedVisual {
  svg: string;
  concept: { id: string; en: string };
}

/** Cache aset per kunci (logo + palet paket + versi), TTL 90 hari. */
export async function getCachedVisual(env: JobEnv, key: string): Promise<CachedVisual | null> {
  return redis().get<CachedVisual>(k(env, "visual", "cache", key));
}

export async function putCachedVisual(env: JobEnv, key: string, v: CachedVisual): Promise<void> {
  await redis().set(k(env, "visual", "cache", key), v, { ex: JOB_TTL_SECONDS });
}
