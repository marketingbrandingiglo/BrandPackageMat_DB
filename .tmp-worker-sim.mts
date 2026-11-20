// Simulasi pekerja untuk uji lokal (tidak di-commit): selesaikan job font + tone + visual dari fixture.
import { readFileSync } from "node:fs";
import { buildResult, candidates, type LogoTraits } from "./lib/brand/font-select";
import { allowedColors, validateVisual } from "./lib/brand/visual";
import { finishJob, getJob, startJob, dequeueVisual, enqueueVisual, saveJob } from "./lib/jobs/jobs";
import { completeIfReady, jobPalette, newVisualTask, storeVisual } from "./lib/jobs/visual";
import { TONE_SAMPLE } from "./tests/fixtures/tone-sample";

const id = process.argv[2];
const job = await getJob("dev", id);
if (!job) throw new Error("job tidak ada");
await startJob(job);
const traits: LogoTraits = {
  hasText: true, letterform: "sans", geometry: "geometric", weight: "bold", formality: 4, energy: 3,
  impression: { id: "Logo geometris yang rapi.", en: "A tidy geometric logo." },
  wantTags: [{ tag: "Business", weight: 1 }, { tag: "Competent", weight: 0.8 }, { tag: "Calm", weight: 0.5 }],
  avoidTags: [], styles: ["Sans/Geometric"], headingCategories: ["Sans Serif"], bodyCategories: ["Sans Serif"],
};
const items = candidates(traits, job.input.industryId);
const body = items.filter((x) => x.body);
const contrast = items.find((x) => x.contrast) ?? items[1];
const r = buildResult(traits, items, { A: { heading: items[0].code, body: body[0].code, reason: { id: "uji", en: "test" } }, B: { heading: contrast.code, body: body[1].code, reason: { id: "uji", en: "test" } }, notes: { id: "uji", en: "test" } }, []);
await finishJob(job, { ...r, tone: TONE_SAMPLE });
console.log("font+tone selesai", r.packages.A.heading.family, r.packages.B.heading.family);
if (job.input.wantVisual) {
  await newVisualTask(job, true);
  await enqueueVisual(job);
  const { palette } = await jobPalette(job);
  const t = job.visual!;
  t.result = {};
  for (const p of ["A", "B"] as const) {
    const v = validateVisual(readFileSync(`tests/fixtures/visual-${p}.svg`, "utf8"), allowedColors(palette, p));
    let svg = v.ok ? v.svg : "";
    if (!v.ok) {
      const cols = allowedColors(palette, p).map((c) => c.hex);
      const parts = [`<rect width="1200" height="1200" fill="${cols[cols.length - 2]}"/>`];
      for (let i = 0; i < 300; i++) parts.push(`<circle cx="${(i * 97) % 1200}" cy="${(i * 53) % 1200}" r="${20 + (i % 7) * 12}" fill="${cols[i % cols.length]}" fill-opacity="0.7"/>`);
      const v2 = validateVisual(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200">${parts.join("")}</svg>`, allowedColors(palette, p));
      if (!v2.ok) throw new Error(v2.errors.join(";"));
      svg = v2.svg;
    }
    t.result[p] = await storeVisual(job, p, svg, { id: "uji", en: "test" });
  }
  completeIfReady(t);
  await dequeueVisual(job);
  await saveJob(job);
  console.log("visual", t.status);
}
