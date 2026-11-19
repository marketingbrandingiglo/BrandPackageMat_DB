import type { NextRequest } from "next/server";
import { envFolder, foldersOlderThan, remove } from "@/lib/drive/drive";

/**
 * Pembersihan harian (Vercel Cron, SPEC bagian 10): folder job di Drive yang berumur lebih
 * dari 90 hari dihapus permanen, per job. Metadata di Redis habis sendiri lewat TTL.
 * Vercel mengirim header Authorization: Bearer <CRON_SECRET>.
 */
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  const before = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const report: Record<string, number> = {};
  for (const env of ["dev", "prod"] as const) {
    const old = await foldersOlderThan(await envFolder(env), before);
    for (const f of old) await remove(f.id);
    report[env] = old.length;
  }
  return Response.json({ deleted: report, before: before.toISOString() });
}
