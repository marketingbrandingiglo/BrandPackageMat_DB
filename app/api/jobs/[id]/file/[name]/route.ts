import { getCurrentUser } from "@/lib/auth/server";
import { download } from "@/lib/drive/drive";
import { currentEnv, getJob } from "@/lib/jobs/jobs";

/** File job dari Drive (lembar spesimen dll.), hanya untuk pemilik job atau super admin. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; name: string }> }) {
  const cu = await getCurrentUser();
  if (!cu) return new Response("unauthorized", { status: 401 });
  const { id, name } = await ctx.params;
  const job = await getJob(currentEnv(), id);
  if (!job || (job.userId !== cu.user.id && cu.user.role !== "superadmin")) return new Response("not found", { status: 404 });
  const f = job.files[name];
  if (!f) return new Response("not found", { status: 404 });
  const buf = await download(f.id);
  return new Response(new Uint8Array(buf), { headers: { "content-type": f.mimeType, "cache-control": "private, max-age=3600" } });
}
