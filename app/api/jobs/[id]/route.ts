import { getCurrentUser } from "@/lib/auth/server";
import { currentEnv, getJob } from "@/lib/jobs/jobs";

/** Status job untuk UI (pemilik job atau super admin). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const cu = await getCurrentUser();
  if (!cu) return Response.json({ error: "unauthorized" }, { status: 401 });
  const job = await getJob(currentEnv(), (await ctx.params).id);
  if (!job || (job.userId !== cu.user.id && cu.user.role !== "superadmin")) return Response.json({ error: "not found" }, { status: 404 });
  const { id, status, step, createdAt, startedAt, finishedAt, error, result, belled, input } = job;
  const materials = (job as { materials?: unknown }).materials;
  return Response.json({ id, status, step, createdAt, startedAt, finishedAt, error, result, belled, materials, companyName: input.companyName, industry: input.industry }, { headers: { "cache-control": "no-store" } });
}
