import "server-only";
import { randomBytes } from "node:crypto";
import type { FontSelectResult } from "@/lib/brand/font-select";
import { analyzeLogo } from "@/lib/brand/logo";
import { buildPalette } from "@/lib/brand/palette";
import { download, remove, upload } from "@/lib/drive/drive";
import { k, saveJob, type Job, type JobFile } from "@/lib/jobs/jobs";
import { redis } from "@/lib/redis";
import sharp from "sharp";
import { SPECS } from "@/lib/brand/specs";
import { svgToPdf, svgToPng } from "@/lib/render/svg";
import { businessCard, CARD_SIZE } from "./business-card";
import type { CheckIssue } from "./checks";
import { emailSignature } from "./email-signature";
import { envelope, ENVELOPE_SIZE } from "./envelope";
import { guideline, GUIDELINE_SIZE } from "./guideline";
import { idCard, ID_SIZE } from "./id-card";
import { letterheadDocx, letterheadSvg, LETTERHEAD_SIZE } from "./letterhead";
import { presentationPptx, presentationPreviews } from "./presentation";
import { stamp } from "./stamp";
import { kitFonts, type BrandKit } from "./kit";
import { MATERIAL_KEYS, type CompanyData, type Lang, type MaterialKey, type MaterialPackage, type Materials, type PackageKey } from "./types";

/**
 * Tahap 4 + 6b: membuat materi dari job 3d-3e yang selesai + data perusahaan, lalu menyimpannya di
 * folder job (Google Drive). Render dilakukan kode aplikasi (bukan Claude).
 *
 * Tahap 6b: pekerjaan dipecah menjadi tugas pendek per materi per paket (SPEC bagian 8) yang bisa
 * berjalan paralel. Hasil tiap tugas disimpan di hash Upstash `job:<id>:mat` (satu field per tugas,
 * tulis atomik), sehingga tugas paralel tidak saling menimpa data job.
 */
export type { MaterialKey, MaterialPackage, Materials } from "./types";

type FontJob = Job<FontSelectResult> & { materials?: Materials };
export const PACKAGES: PackageKey[] = ["A", "B"];
export const TASKS = MATERIAL_KEYS.flatMap((key) => PACKAGES.map((pkg) => ({ key, pkg })));

/** Hasil satu tugas di hash. */
interface TaskRecord {
  run: string;
  pkg?: MaterialPackage;
  /** File Drive milik tugas ini (nama -> file). */
  refs: Record<string, JobFile>;
  error?: string;
  finishedAt: string;
}

const hashKey = (job: Job) => k(job.env, "job", job.id, "mat");
const field = (key: MaterialKey, pkg: PackageKey) => `${key}:${pkg}`;

async function readTasks(job: Job): Promise<Record<string, TaskRecord>> {
  const raw = await redis().hgetall<Record<string, TaskRecord>>(hashKey(job));
  return raw ?? {};
}

/** Cari file job: file job utama dulu, lalu file hasil tugas materi. */
export async function findJobFile(job: Job, name: string): Promise<JobFile | undefined> {
  if (job.files[name]) return job.files[name];
  const tasks = await readTasks(job);
  for (const t of Object.values(tasks)) if (t.refs?.[name]) return t.refs[name];
  return undefined;
}

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

/** Penyimpan file satu tugas: unggah ke folder job, catat sebagai ref tugas. */
class Sink {
  refs: Record<string, JobFile> = {};
  constructor(private folderId: string) {}
  async put(name: string, mime: string, data: Buffer) {
    const f = await upload(this.folderId, name, mime, data);
    this.refs[name] = { id: f.id, name, mimeType: mime, size: f.size };
  }
}

interface Side {
  name: string;
  svg: string;
  /** SVG khusus pratinjau PNG (opsional, mis. cap). */
  previewSvg?: string;
  issues: CheckIssue[];
}

/** Simpan satu materi: SVG per sisi, PDF (semua sisi), pratinjau per sisi. */
async function store(sink: Sink, kit: BrandKit, base: string, size: { widthMm: number; heightMm: number }, sides: Side[], title: string, bleed = true): Promise<MaterialPackage> {
  const fonts = kitFonts(kit);
  const { pdf, warnings } = await svgToPdf(sides.map((s) => s.svg), { ...size, fonts, title });
  const files: string[] = [];
  const previews: string[] = [];
  for (const s of sides) {
    const svgName = sides.length > 1 ? `${base}-${s.name}.svg` : `${base}.svg`;
    await sink.put(svgName, "image/svg+xml", Buffer.from(s.svg));
    files.push(svgName);
    const prevName = sides.length > 1 ? `pratinjau-${base}-${s.name}.png` : `pratinjau-${base}.png`;
    const width = Math.round(size.widthMm * 12.2);
    const png = svgToPng(s.previewSvg ?? s.svg, fonts, width);
    await sink.put(prevName, "image/png", bleed ? await trimmed(png, size.widthMm, size.heightMm) : png);
    previews.push(prevName);
  }
  await sink.put(`${base}.pdf`, "application/pdf", pdf);
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

/** Logo + analisisnya per job, disimpan sebentar di proses (tugas paralel di instance yang sama). */
const logoCache = new Map<string, Promise<{ buf: Buffer; rep: Awaited<ReturnType<typeof analyzeLogo>> }>>();
function logoOf(job: Job) {
  let p = logoCache.get(job.id);
  if (!p) {
    p = download(job.files.logo.id).then(async (buf) => ({ buf, rep: await analyzeLogo(buf) }));
    p.catch(() => logoCache.delete(job.id));
    logoCache.set(job.id, p);
    if (logoCache.size > 20) logoCache.delete(logoCache.keys().next().value!);
  }
  return p;
}

/** Bahan satu paket (logo, palet, font, visual). */
async function kitFor(job: FontJob, pkg: PackageKey): Promise<BrandKit> {
  const r = job.result;
  const m = job.materials;
  if (job.status !== "done" || !r || !m) throw new Error("Job belum siap untuk materi.");
  const { buf, rep } = await logoOf(job);
  let visual: string | undefined;
  const a = m.visual?.[pkg] ? job.visual?.result?.[pkg] : undefined;
  if (a && job.files[a.file]) visual = (await download(job.files[a.file].id)).toString("utf8");
  return {
    visual,
    pkg,
    lang: m.lang,
    company: m.company,
    palette: buildPalette(rep.colors),
    fonts: { heading: r.packages[pkg].heading, body: r.packages[pkg].body },
    logo: {
      kind: rep.kind,
      svg: rep.sanitized?.svg,
      png: rep.kind === "png" ? buf : rep.previews.original,
      aspect: rep.width && rep.height ? rep.width / rep.height : 1,
      hasText: r.traits.hasText,
    },
  };
}

async function build(job: FontJob, key: MaterialKey, kit: BrandKit, sink: Sink): Promise<MaterialPackage> {
  const pkg = kit.pkg;
  const name = kit.company.name;
  switch (key) {
    case "businessCard": {
      const card = businessCard(kit);
      return store(sink, kit, `kartu-nama-${pkg}`, CARD_SIZE, [{ name: "depan", ...card.front }, { name: "belakang", ...card.back }], `${name} - kartu nama ${pkg}`);
    }
    case "idLandscape":
    case "idPortrait": {
      const o = key === "idLandscape" ? "landscape" : "portrait";
      const id = idCard(kit, o);
      return store(sink, kit, `id-card-${o}-${pkg}`, ID_SIZE[o], [{ name: "depan", ...id.front }, { name: "belakang", ...id.back }], `${name} - ID card ${o} ${pkg}`);
    }
    case "envelope": {
      const env = envelope(kit);
      return store(sink, kit, `amplop-${pkg}`, ENVELOPE_SIZE, [{ name: "depan", ...env }], `${name} - amplop ${pkg}`);
    }
    case "stamp": {
      const cap = await stamp(kit);
      return store(sink, kit, `cap-${pkg}`, cap.size, [{ name: "cap", svg: cap.svg, issues: cap.issues }], `${name} - cap ${pkg}`, false);
    }
    case "letterhead": {
      const kop = letterheadSvg(kit);
      const p = await store(sink, kit, `kop-surat-${pkg}`, LETTERHEAD_SIZE, [{ name: "kop", ...kop }], `${name} - kop surat ${pkg}`, false);
      await sink.put(`kop-surat-${pkg}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", await letterheadDocx(kit));
      p.files.unshift(`kop-surat-${pkg}.docx`);
      return p;
    }
    case "presentation": {
      const fonts = kitFonts(kit);
      await sink.put(`template-ppt-${pkg}.pptx`, "application/vnd.openxmlformats-officedocument.presentationml.presentation", await presentationPptx(kit));
      const previews: string[] = [];
      for (const [i, svg] of presentationPreviews(kit).entries()) {
        const n = `pratinjau-template-ppt-${pkg}-${i + 1}.png`;
        await sink.put(n, "image/png", svgToPng(svg, fonts, 960));
        previews.push(n);
      }
      return { files: [`template-ppt-${pkg}.pptx`], previews, issues: [] };
    }
    case "emailSignature": {
      const sig = await emailSignature(kit);
      await sink.put(`email-signature-${pkg}.html`, "text/html; charset=utf-8", Buffer.from(sig.html));
      await sink.put(`logo-email-${pkg}.png`, "image/png", sig.logo.png);
      return { files: [`email-signature-${pkg}.html`, `logo-email-${pkg}.png`], previews: [], issues: sig.issues };
    }
    case "guideline": {
      const r = job.result!;
      const gl = guideline(kit, { tone: r.tone, generatedAt: new Date(job.materials!.generatedAt) });
      const fonts = kitFonts(kit);
      const pdf = await svgToPdf(gl.pages, { ...GUIDELINE_SIZE, fonts, title: `${name} - guideline ${pkg}` });
      await sink.put(`guideline-${pkg}.pdf`, "application/pdf", pdf.pdf);
      const previews: string[] = [];
      for (const [i, svg] of gl.pages.entries()) {
        const n = `pratinjau-guideline-${pkg}-${i + 1}.png`;
        await sink.put(n, "image/png", svgToPng(svg, fonts, 700));
        previews.push(n);
      }
      return {
        files: [`guideline-${pkg}.pdf`],
        previews,
        issues: [...gl.issues.map((i) => i.message), ...pdf.warnings.filter((w) => w.source === "font").map((w) => `PDF: ${w.message}`), ...(r.tone ? [] : ["Tone of voice belum ada untuk job ini; halaman tone berisi catatan."])],
      };
    }
  }
}

/**
 * Mulai putaran pembuatan materi: simpan data perusahaan, bahasa, dan pilihan visual di job.
 * Tugas-tugas dijalankan terpisah lewat runMaterialTask (paralel dari UI, berurutan di Lab).
 */
export async function beginMaterials(job: FontJob, company: CompanyData, lang: Lang, useVisual: boolean): Promise<Materials> {
  if (job.status !== "done" || !job.result) throw new Error("Job belum selesai.");
  const v = useVisual && job.visual?.status === "done";
  job.materials = {
    lang,
    company,
    generatedAt: new Date().toISOString(),
    items: {},
    visual: { A: Boolean(v && job.visual?.result?.A), B: Boolean(v && job.visual?.result?.B) },
    run: randomBytes(4).toString("hex"),
  };
  await saveJob(job as Job);
  return job.materials;
}

/** Jalankan satu tugas (materi x paket). File lama tugas yang sama dihapus setelah yang baru tersimpan. */
export async function runMaterialTask(job: FontJob, key: MaterialKey, pkg: PackageKey): Promise<{ ok: boolean; error?: string }> {
  const m = job.materials;
  if (!m?.run) throw new Error("Putaran materi belum dimulai.");
  const prev = (await redis().hget<TaskRecord>(hashKey(job), field(key, pkg))) ?? undefined;
  if (prev?.run === m.run && prev.pkg) return { ok: true };
  const sink = new Sink(job.folderId);
  let rec: TaskRecord;
  try {
    const kit = await kitFor(job, pkg);
    const out = await build(job, key, kit, sink);
    // Peringatan yang sama (mis. font tanpa Bold di tiap halaman PDF) cukup sekali.
    out.issues = [...new Set(out.issues)];
    rec = { run: m.run, pkg: out, refs: sink.refs, finishedAt: new Date().toISOString() };
  } catch (e) {
    console.error(`[materi] ${job.id} ${key}:${pkg} gagal:`, e);
    rec = { run: m.run, refs: sink.refs, error: (e as Error).message.slice(0, 200), finishedAt: new Date().toISOString() };
  }
  await redis().hset(hashKey(job), { [field(key, pkg)]: rec });
  // File lama (putaran sebelumnya) yang tidak dipakai lagi.
  for (const [n, f] of Object.entries(prev?.refs ?? {})) if (rec.refs[n]?.id !== f.id) await remove(f.id).catch(() => {});
  return rec.error ? { ok: false, error: rec.error } : { ok: true };
}

export type TaskState = "pending" | "done" | "error";

/** Materi putaran terakhir (gabungan data job + hasil tugas) dan status tiap tugas. */
export async function loadMaterials(job: FontJob): Promise<{ materials?: Materials; tasks: Record<string, { state: TaskState; error?: string }> }> {
  const m = job.materials;
  const tasks: Record<string, { state: TaskState; error?: string }> = {};
  if (!m) return { tasks };
  // Job lama (sebelum 6b): materi utuh tersimpan di job.
  if (!m.run) return { materials: m, tasks };
  const recs = await readTasks(job);
  const items: Materials["items"] = {};
  for (const { key, pkg } of TASKS) {
    const r = recs[field(key, pkg)];
    if (r?.run === m.run && r.pkg) {
      items[key] = { ...(items[key] ?? ({} as Record<PackageKey, MaterialPackage>)), [pkg]: r.pkg };
      tasks[field(key, pkg)] = { state: "done" };
    } else tasks[field(key, pkg)] = r?.run === m.run && r.error ? { state: "error", error: r.error } : { state: "pending" };
  }
  return { materials: { ...m, items }, tasks };
}

/** Lab: buat semua materi berurutan (perilaku Tahap 4). */
export async function makeMaterials(job: FontJob, company: CompanyData, lang: Lang, useVisual = false): Promise<Materials> {
  await beginMaterials(job, company, lang, useVisual);
  for (const { key, pkg } of TASKS) await runMaterialTask(job, key, pkg);
  return (await loadMaterials(job)).materials!;
}
