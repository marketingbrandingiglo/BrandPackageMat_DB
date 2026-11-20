import JSZip from "jszip";
import { getCurrentUser } from "@/lib/auth/server";
import { download } from "@/lib/drive/drive";
import { currentEnv, getJob } from "@/lib/jobs/jobs";
import { SIGNATURE_LOGO_FILE } from "@/lib/materials/types";

/**
 * Tahap 4f: unduhan email signature sebagai ZIP (dibuat saat diunduh, tidak disimpan; SPEC bagian 9).
 * Isi: satu folder dengan signature.html + logo-email.png (dirujuk relatif oleh HTML).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; pkg: string }> }) {
  const cu = await getCurrentUser();
  if (!cu) return new Response("unauthorized", { status: 401 });
  const { id, pkg } = await ctx.params;
  if (pkg !== "A" && pkg !== "B") return new Response("not found", { status: 404 });
  const job = await getJob(currentEnv(), id);
  if (!job || (job.userId !== cu.user.id && cu.user.role !== "superadmin")) return new Response("not found", { status: 404 });
  const html = job.files[`email-signature-${pkg}.html`];
  const logo = job.files[`logo-email-${pkg}.png`];
  if (!html || !logo) return new Response("not found", { status: 404 });
  const company = job.input.companyName.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 40) || "Perusahaan";
  const folder = `${company}_email-signature-${pkg}`;
  const zip = new JSZip();
  zip.file(`${folder}/signature.html`, await download(html.id));
  zip.file(`${folder}/${SIGNATURE_LOGO_FILE}`, await download(logo.id));
  const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const name = `${folder}.zip`;
  return new Response(buf as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
