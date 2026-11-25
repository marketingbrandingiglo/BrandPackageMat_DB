import type { NextRequest } from "next/server";
import { recordCleanupRun, shortError, type CleanupRun } from "@/lib/cron";
import { envFolder, foldersOlderThan, remove } from "@/lib/drive/drive";
import { pruneSessions } from "@/lib/usage";

/**
 * Pembersihan harian (Vercel Cron, SPEC bagian 10): folder job di Drive yang berumur lebih
 * dari 90 hari dihapus permanen, per job. Metadata job di Redis habis sendiri tepat 90 hari sejak
 * dibuat (TTL absolut, saveJob); indeks sesi pemakaian yang lebih tua dari 90 hari dirapikan.
 * Vercel mengirim header Authorization: Bearer <CRON_SECRET>.
 * Setiap run yang terautentikasi dicatat (berhasil atau gagal) untuk halaman Admin (lib/cron.ts).
 */
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  const started = Date.now();
  const before = new Date(started - 90 * 24 * 60 * 60 * 1000);
  const run: CleanupRun = { at: new Date(started).toISOString(), ok: true, deleted: { dev: 0, prod: 0 }, sessions: { dev: 0, prod: 0 }, durationMs: 0 };
  try {
    for (const env of ["dev", "prod"] as const) {
      const old = await foldersOlderThan(await envFolder(env), before);
      for (const f of old) {
        await remove(f.id);
        run.deleted[env]++;
      }
      run.sessions[env] = await pruneSessions(env);
    }
  } catch (e) {
    run.ok = false;
    run.error = shortError(e);
  }
  run.durationMs = Date.now() - started;
  await recordCleanupRun(run).catch((e) => console.error("cron: gagal mencatat run", shortError(e)));
  const body = { deleted: run.deleted, sessions: run.sessions, before: before.toISOString(), ...(run.error ? { error: run.error } : {}) };
  return Response.json(body, { status: run.ok ? 200 : 500 });
}
