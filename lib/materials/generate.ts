import "server-only";
import type { FontSelectResult } from "@/lib/brand/font-select";
import { analyzeLogo } from "@/lib/brand/logo";
import { buildPalette } from "@/lib/brand/palette";
import { download, remove, upload } from "@/lib/drive/drive";
import { saveJob, type Job } from "@/lib/jobs/jobs";
import sharp from "sharp";
import { SPECS } from "@/lib/brand/specs";
import { svgToPdf, svgToPng } from "@/lib/render/svg";
import { businessCard, CARD_SIZE } from "./business-card";
import { kitFonts, type BrandKit, type CompanyData, type Lang, type PackageKey } from "./kit";

/**
 * Tahap 4: membuat materi dari job 3d-3e yang selesai + data perusahaan, lalu menyimpannya di
 * folder job (Google Drive). Render dilakukan kode aplikasi (bukan Claude).
 */
export interface MaterialPackage {
  /** File untuk diunduh (SVG/PDF), nama di folder job. */
  files: string[];
  /** PNG pratinjau, nama di folder job. */
  previews: string[];
  /** Hasil pengecekan otomatis (teks keluar area aman, tabrakan, kontras, font). */
  issues: string[];
}

export interface Materials {
  lang: Lang;
  company: CompanyData;
  generatedAt: string;
  businessCard?: Record<PackageKey, MaterialPackage>;
}

type FontJob = Job<FontSelectResult> & { materials?: Materials };

/** Pratinjau sebesar ukuran jadi (tanpa bleed), seperti hasil cetak setelah dipotong. */
async function trimmed(png: Buffer, widthMm: number, heightMm: number): Promise<Buffer> {
  const meta = await sharp(png).metadata();
  const pxPerMm = (meta.width ?? 0) / widthMm;
  const b = Math.round(SPECS.print.bleedMm * pxPerMm);
  return sharp(png)
    .extract({ left: b, top: b, width: (meta.width ?? 0) - 2 * b, height: Math.round(heightMm * pxPerMm) - 2 * b })
    .png()
    .toBuffer();
}

async function put(job: FontJob, name: string, mime: string, data: Buffer) {
  const old = job.files[name];
  if (old) await remove(old.id);
  const f = await upload(job.folderId, name, mime, data);
  job.files[name] = { id: f.id, name, mimeType: mime, size: f.size };
}

export async function makeBusinessCards(job: FontJob, company: CompanyData, lang: Lang): Promise<Materials> {
  const r = job.result;
  if (job.status !== "done" || !r) throw new Error("Job belum selesai.");
  const buf = await download(job.files.logo.id);
  const rep = await analyzeLogo(buf);
  const palette = buildPalette(rep.colors);
  const out = {} as Record<PackageKey, MaterialPackage>;

  for (const pkg of ["A", "B"] as const) {
    const kit: BrandKit = {
      pkg,
      lang,
      company,
      palette,
      fonts: { heading: r.packages[pkg].heading, body: r.packages[pkg].body },
      logo: {
        kind: rep.kind,
        svg: rep.sanitized?.svg,
        png: rep.kind === "png" ? buf : rep.previews.original,
        aspect: rep.width && rep.height ? rep.width / rep.height : 1,
        hasText: r.traits.hasText,
      },
    };
    const card = businessCard(kit);
    const fonts = kitFonts(kit);
    const { pdf, warnings } = await svgToPdf([card.front.svg, card.back.svg], { ...CARD_SIZE, fonts, title: `${company.name} - kartu nama ${pkg}` });
    const base = `kartu-nama-${pkg}`;
    await put(job, `${base}-depan.svg`, "image/svg+xml", Buffer.from(card.front.svg));
    await put(job, `${base}-belakang.svg`, "image/svg+xml", Buffer.from(card.back.svg));
    await put(job, `${base}.pdf`, "application/pdf", pdf);
    for (const [side, svg] of [["depan", card.front.svg], ["belakang", card.back.svg]] as const) {
      const png = await trimmed(svgToPng(svg, fonts, 1170), CARD_SIZE.widthMm, CARD_SIZE.heightMm);
      await put(job, `pratinjau-${base}-${side}.png`, "image/png", png);
    }
    out[pkg] = {
      files: [`${base}-depan.svg`, `${base}-belakang.svg`, `${base}.pdf`],
      previews: [`pratinjau-${base}-depan.png`, `pratinjau-${base}-belakang.png`],
      issues: [
        ...card.front.issues.map((i) => `Depan: ${i.message}`),
        ...card.back.issues.map((i) => `Belakang: ${i.message}`),
        ...warnings.filter((w) => w.source === "font").map((w) => `PDF: ${w.message}`),
      ],
    };
  }
  const materials: Materials = { lang, company, generatedAt: new Date().toISOString(), businessCard: out };
  job.materials = materials;
  await saveJob(job as Job);
  return materials;
}
