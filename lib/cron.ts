import { APP_KEY_PREFIX, redis } from "./redis";

/**
 * Status cron pembersihan harian (versi 1.1). Cron hanya berjalan di production, tetapi membersihkan
 * folder Drive dev dan prod sekaligus, jadi riwayatnya disimpan di kunci bersama (seperti token Drive)
 * agar tampil di halaman Admin lokal maupun production.
 */
export const CRON_KEY = [APP_KEY_PREFIX, "shared", "cron", "cleanup"].join(":");
/** Jumlah run yang disimpan dan ditampilkan. */
export const CRON_HISTORY = 7;
/** Run terakhir lebih tua dari ini = terlambat (jadwal harian + kelonggaran Hobby ±59 menit). */
export const CRON_LATE_HOURS = 26;

type PerEnv = { dev: number; prod: number };

export interface CleanupRun {
  /** Waktu mulai (ISO). */
  at: string;
  ok: boolean;
  /** Folder Drive yang dihapus per environment (sampai galat, bila gagal). */
  deleted: PerEnv;
  /** Entri indeks sesi yang dirapikan per environment. */
  sessions: PerEnv;
  durationMs: number;
  error?: string;
}

export type CronState = "none" | "ok" | "failed" | "late";

/** Status utama dari run terbaru: gagal diutamakan, lalu terlambat. */
export function cronState(runs: CleanupRun[], now = Date.now()): CronState {
  const last = runs[0];
  if (!last) return "none";
  if (!last.ok) return "failed";
  if (now - Date.parse(last.at) > CRON_LATE_HOURS * 3600 * 1000) return "late";
  return "ok";
}

/** Pesan galat dipendekkan dan tanpa baris baru (tampil di Admin). */
export function shortError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/\s+/g, " ").trim().slice(0, 300) || "Galat tidak diketahui";
}

export async function recordCleanupRun(run: CleanupRun): Promise<void> {
  const p = redis().pipeline();
  p.lpush(CRON_KEY, JSON.stringify(run));
  p.ltrim(CRON_KEY, 0, CRON_HISTORY - 1);
  await p.exec();
}

function parse(x: unknown): CleanupRun | null {
  try {
    const v = (typeof x === "string" ? JSON.parse(x) : x) as CleanupRun;
    return v && typeof v.at === "string" && typeof v.ok === "boolean" ? v : null;
  } catch {
    return null;
  }
}

/** Run terbaru lebih dulu. */
export async function cleanupRuns(): Promise<CleanupRun[]> {
  const raw = await redis().lrange(CRON_KEY, 0, CRON_HISTORY - 1);
  return raw.map(parse).filter((r): r is CleanupRun => r !== null);
}
