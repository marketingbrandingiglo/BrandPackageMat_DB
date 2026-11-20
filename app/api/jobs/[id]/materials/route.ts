import { getCurrentUser } from "@/lib/auth/server";
import { currentEnv, getJob } from "@/lib/jobs/jobs";
import { runMaterialTask } from "@/lib/materials/generate";
import { MATERIAL_KEYS, type MaterialKey } from "@/lib/materials/types";

/** Tahap 6b: jalankan satu tugas materi (materi x paket). Dipanggil paralel oleh halaman hasil. */
export const maxDuration = 300;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const cu = await getCurrentUser();
  if (!cu) return Response.json({ error: "unauthorized" }, { status: 401 });
  const job = await getJob(currentEnv(), (await ctx.params).id);
  if (!job || (job.userId !== cu.user.id && cu.user.role !== "superadmin")) return Response.json({ error: "not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { key?: string; pkg?: string };
  if (!MATERIAL_KEYS.includes(body.key as MaterialKey) || (body.pkg !== "A" && body.pkg !== "B")) return Response.json({ error: "bad request" }, { status: 400 });
  const r = await runMaterialTask(job as Parameters<typeof runMaterialTask>[0], body.key as MaterialKey, body.pkg);
  return Response.json(r, { status: r.ok ? 200 : 500, headers: { "cache-control": "no-store" } });
}
