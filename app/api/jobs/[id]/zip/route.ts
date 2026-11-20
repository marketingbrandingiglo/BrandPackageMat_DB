import { Readable } from "node:stream";
import JSZip from "jszip";
import { getCurrentUser } from "@/lib/auth/server";
import type { FontSelectResult } from "@/lib/brand/font-select";
import { download } from "@/lib/drive/drive";
import { currentEnv, getJob, JOB_TTL_SECONDS, usageRef } from "@/lib/jobs/jobs";
import { track } from "@/lib/usage";
import { findJobFile, loadMaterials } from "@/lib/materials/generate";
import { GROUP_KEYS, GROUPS, groupFolder, safeName, zipName, type GroupKey } from "@/lib/materials/groups";
import { readme, readmeName } from "@/lib/materials/readme";
import { SIGNATURE_LOGO_FILE } from "@/lib/materials/types";

/**
 * Tahap 6d: unduhan ZIP paket terpilih (SPEC bagian 9): semua, satu materi, atau checklist
 * (2 sampai 7 materi). ZIP dibuat saat diunduh dan dialirkan (streaming), tidak disimpan.
 * Parameter `g`: daftar kelompok dipisah koma; kosong = semua.
 */
export const maxDuration = 300;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const cu = await getCurrentUser();
  if (!cu) return new Response("unauthorized", { status: 401 });
  const job = await getJob<FontSelectResult>(currentEnv(), (await ctx.params).id);
  if (!job || (job.userId !== cu.user.id && cu.user.role !== "superadmin")) return new Response("not found", { status: 404 });
  if (!job.chosen || !job.result) return new Response("Pilih paket terlebih dulu.", { status: 409 });
  const q = new URL(req.url).searchParams.get("g");
  const groups = q ? GROUPS.filter((g) => q.split(",").includes(g)) : [...GROUPS];
  if (!groups.length) return new Response("bad request", { status: 400 });
  const { materials } = await loadMaterials(job as Parameters<typeof loadMaterials>[0]);
  if (!materials) return new Response("not found", { status: 404 });
  const pkg = job.chosen.pkg;
  const lang = materials.lang;
  const company = job.input.companyName;
  const prefix = safeName(company);
  const name = zipName(company, pkg, lang, groups as GroupKey[]);
  const root = name.replace(/\.zip$/, "");

  const zip = new JSZip();
  for (const g of groups) {
    const folder = `${root}/${groupFolder(lang, g)}`;
    for (const key of GROUP_KEYS[g]) {
      const files = materials.items[key]?.[pkg]?.files ?? [];
      for (const n of files) {
        const f = await findJobFile(job, n);
        if (!f) continue;
        // Email signature: nama tetap karena HTML merujuk logo secara relatif.
        const out = g === "emailSignature" ? (n.endsWith(".html") ? "signature.html" : SIGNATURE_LOGO_FILE) : `${prefix}_${n}`;
        zip.file(`${folder}/${out}`, download(f.id));
      }
    }
  }
  const until = new Date(Date.parse(job.createdAt) + JOB_TTL_SECONDS * 1000).toLocaleDateString(lang === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  zip.file(
    `${root}/${readmeName(lang)}`,
    readme({ lang, company, pkg, fonts: { heading: job.result.packages[pkg].heading, body: job.result.packages[pkg].body }, groups: groups as GroupKey[], availableUntil: until, pngLogo: job.files.logo.mimeType === "image/png" }),
  );
  await track(usageRef(job), "downloads");
  const stream = zip.generateNodeStream({ type: "nodebuffer", streamFiles: true, compression: "DEFLATE", compressionOptions: { level: 6 } });
  return new Response(Readable.toWeb(stream as Readable) as ReadableStream, {
    headers: {
      "content-type": "application/zip",
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
