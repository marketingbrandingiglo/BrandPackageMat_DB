import { getCurrentUser } from "@/lib/auth/server";
import { download } from "@/lib/drive/drive";
import { currentEnv, getJob } from "@/lib/jobs/jobs";

/** File job dari Drive (lembar spesimen dll.), hanya untuk pemilik job atau super admin. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; name: string }> }) {
  const cu = await getCurrentUser();
  if (!cu) return new Response("unauthorized", { status: 401 });
  const { id, name } = await ctx.params;
  const job = await getJob(currentEnv(), id);
  if (!job || (job.userId !== cu.user.id && cu.user.role !== "superadmin")) return new Response("not found", { status: 404 });
  const f = job.files[name];
  if (!f) return new Response("not found", { status: 404 });
  const buf = await download(f.id);
  const headers: Record<string, string> = { "content-type": f.mimeType, "cache-control": "private, max-age=3600" };
  if (new URL(req.url).searchParams.get("download")) {
    // Nama file: <NamaPerusahaan>_<nama>, karakter bermasalah dibuang (SPEC bagian 9).
    const company = job.input.companyName.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 40) || "Perusahaan";
    headers["content-disposition"] = `attachment; filename="${encodeURIComponent(`${company}_${name}`)}"; filename*=UTF-8''${encodeURIComponent(`${company}_${name}`)}`;
  }
  return new Response(new Uint8Array(buf), { headers });
}
