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
import type { CheckIssue } from "./checks";
import { envelope, ENVELOPE_SIZE } from "./envelope";
import { idCard, ID_SIZE } from "./id-card";
import { kitFonts, type BrandKit } from "./kit";
import type { CompanyData, Lang, MaterialKey, MaterialPackage, Materials, PackageKey } from "./types";

/**
 * Tahap 4: membuat materi (4a kartu nama, 4b ID card dan amplop) dari job 3d-3e yang selesai + data perusahaan, lalu menyimpannya di
 * folder job (Google Drive). Render dilakukan kode aplikasi (bukan Claude).
 */
export type { MaterialKey, MaterialPackage, Materials } from "./types";

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

interface Side {
  name: string;
  svg: string;
  issues: CheckIssue[];
}

/** Simpan satu materi: SVG per sisi, PDF (semua sisi), pratinjau per sisi. */
async function store(job: FontJob, kit: BrandKit, base: string, size: { widthMm: number; heightMm: number }, sides: Side[], title: string): Promise<MaterialPackage> {
  const fonts = kitFonts(kit);
  const { pdf, warnings } = await svgToPdf(sides.map((s) => s.svg), { ...size, fonts, title });
  const files: string[] = [];
  const previews: string[] = [];
  for (const s of sides) {
    const svgName = sides.length > 1 ? `${base}-${s.name}.svg` : `${base}.svg`;
    await put(job, svgName, "image/svg+xml", Buffer.from(s.svg));
    files.push(svgName);
    const prevName = sides.length > 1 ? `pratinjau-${base}-${s.name}.png` : `pratinjau-${base}.png`;
    const width = Math.round(size.widthMm * 12.2);
    await put(job, prevName, "image/png", await trimmed(svgToPng(s.svg, fonts, width), size.widthMm, size.heightMm));
    previews.push(prevName);
  }
  await put(job, `${base}.pdf`, "application/pdf", pdf);
  files.push(`${base}.pdf`);
  return {
    files,
    previews,
    issues: [
      ...sides.flatMap((s) => s.issues.map((i) => (sides.length > 1 ? `${s.name[0].toUpperCase()}${s.name.slice(1)}: ${i.message}` : i.message))),
      ...warnings.filter((w) => w.source === "font").map((w) => `PDF: ${w.message}`),
    ],
  };
}

export async function makeMaterials(job: FontJob, company: CompanyData, lang: Lang): Promise<Materials> {
  const r = job.result;
  if (job.status !== "done" || !r) throw new Error("Job belum selesai.");
  const buf = await download(job.files.logo.id);
  const rep = await analyzeLogo(buf);
  const palette = buildPalette(rep.colors);
  const items: Materials["items"] = {};
  const set = (key: MaterialKey, pkg: PackageKey, v: MaterialPackage) => {
    items[key] = { ...(items[key] ?? ({} as Record<PackageKey, MaterialPackage>)), [pkg]: v };
  };

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
    const name = company.name;
    const card = businessCard(kit);
    set("businessCard", pkg, await store(job, kit, `kartu-nama-${pkg}`, CARD_SIZE, [{ name: "depan", ...card.front }, { name: "belakang", ...card.back }], `${name} - kartu nama ${pkg}`));
    for (const o of ["landscape", "portrait"] as const) {
      const id = idCard(kit, o);
      set(o === "landscape" ? "idLandscape" : "idPortrait", pkg, await store(job, kit, `id-card-${o}-${pkg}`, ID_SIZE[o], [{ name: "depan", ...id.front }, { name: "belakang", ...id.back }], `${name} - ID card ${o} ${pkg}`));
    }
    const env = envelope(kit);
    set("envelope", pkg, await store(job, kit, `amplop-${pkg}`, ENVELOPE_SIZE, [{ name: "depan", ...env }], `${name} - amplop ${pkg}`));
  }
  const materials: Materials = { lang, company, generatedAt: new Date().toISOString(), items };
  job.materials = materials;
  await saveJob(job as Job);
  return materials;
}
