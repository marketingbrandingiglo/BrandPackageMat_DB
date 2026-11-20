import "server-only";
import { analyzeLogo } from "@/lib/brand/logo";
import { INDUSTRIES } from "@/lib/brand/industries";
import { createFolder, envFolder, upload } from "@/lib/drive/drive";
import type { PublicUser } from "@/lib/auth/users";
import type { CompanyData } from "@/lib/materials/types";
import { ring } from "./bell";
import { currentEnv, enqueue, newJobId, saveJob, type Job } from "./jobs";

/**
 * Membuat job brand package: simpan logo di Drive, buat job, masukkan antrean, bunyikan bel.
 * Dipakai form user (Tahap 6) dan Lab. Melempar LogoRejected/DriveNotConnected/DriveError.
 */
export interface NewJobInput {
  user: PublicUser;
  logo: Buffer;
  companyName: string;
  industryId: string;
  industryOther?: string;
  company?: CompanyData;
  lang?: "id" | "en";
  wantVisual?: boolean;
}

export function industryLabel(industryId: string, other?: string) {
  const known = INDUSTRIES.find((x) => x.id === industryId);
  const o = (other ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (!known) return { known, id: undefined, en: undefined };
  if (known.freeText) return { known, id: o ? `Lainnya: ${o}` : undefined, en: o ? `Other: ${o}` : undefined };
  return { known, id: known.id_label, en: known.en_label };
}

export async function createBrandJob(i: NewJobInput): Promise<{ id: string; belled: boolean }> {
  const r = await analyzeLogo(i.logo);
  const env = currentEnv();
  const id = newJobId();
  const folderId = await createFolder(id, await envFolder(env));
  const ext = r.kind === "svg" ? "svg" : "png";
  const logo = await upload(folderId, `logo-asli.${ext}`, r.kind === "svg" ? "image/svg+xml" : "image/png", r.kind === "svg" && r.sanitized ? Buffer.from(r.sanitized.svg) : i.logo);
  const preview = await upload(folderId, "logo-pratinjau.png", "image/png", r.previews.original);
  const ind = industryLabel(i.industryId, i.industryOther);
  const now = new Date().toISOString();
  const job: Job = {
    id,
    env,
    type: "font-select",
    userId: i.user.id,
    userEmail: i.user.email,
    status: "queued",
    step: "Menunggu pekerja Claude",
    createdAt: now,
    updatedAt: now,
    input: {
      companyName: i.companyName,
      industry: ind.id,
      industryEn: ind.en,
      industryId: ind.known?.id,
      darkBackground: r.transparentBackground && r.onLight.strategy !== "original",
      company: i.company,
      lang: i.lang,
      wantVisual: i.wantVisual,
    },
    folderId,
    files: {
      logo: { id: logo.id, name: logo.name, mimeType: logo.mimeType, size: logo.size },
      preview: { id: preview.id, name: preview.name, mimeType: preview.mimeType, size: preview.size },
    },
    belled: false,
  };
  await enqueue(job);
  job.belled = await ring(env, id).catch(() => false);
  if (job.belled) await saveJob(job);
  return { id, belled: job.belled };
}
