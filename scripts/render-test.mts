// Uji render lokal Tahap 1: SVG -> PDF dan PNG tanpa browser.
// Pemakaian: npm run render:test   (hasil di folder out/render-test/, tidak di-commit)
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TEST_FONTS } from "../lib/render/fonts.ts";
import { SAMPLE_SIZE, sampleBusinessCardSvg } from "../lib/render/sample.ts";
import { svgToPdf, svgToPng } from "../lib/render/svg.ts";

const out = path.join(process.cwd(), "out/render-test");
mkdirSync(out, { recursive: true });

const svg = sampleBusinessCardSvg();
let t = performance.now();
const { pdf, warnings } = await svgToPdf(svg, { ...SAMPLE_SIZE, fonts: TEST_FONTS, title: "Uji render" });
const pdfMs = performance.now() - t;
t = performance.now();
const png = svgToPng(svg, TEST_FONTS);
const pngMs = performance.now() - t;

writeFileSync(path.join(out, "kartu-nama.svg"), svg);
writeFileSync(path.join(out, "kartu-nama.pdf"), pdf);
writeFileSync(path.join(out, "kartu-nama.png"), png);
console.log(`PDF ${(pdf.length / 1024).toFixed(1)} KB dalam ${pdfMs.toFixed(0)} ms`);
console.log(`PNG ${(png.length / 1024).toFixed(1)} KB dalam ${pngMs.toFixed(0)} ms`);
console.log(warnings.length ? warnings : "Tanpa peringatan");
console.log(`Hasil: ${out}`);
