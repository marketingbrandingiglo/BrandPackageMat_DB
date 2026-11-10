import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { Resvg } from "@resvg/resvg-js";
import { allFontFiles, firstFamily, type FontFamily } from "./fonts";
import { withMergedTextRuns } from "./text-runs";

const MM_TO_PT = 72 / 25.4;

export interface PdfOptions {
  /** Ukuran halaman dalam mm (termasuk bleed). */
  widthMm: number;
  heightMm: number;
  fonts: Record<string, FontFamily>;
  title?: string;
}

export interface RenderWarning {
  source: "pdf" | "font";
  message: string;
}

/**
 * SVG -> PDF vektor tanpa browser (PDFKit + svg-to-pdfkit).
 * Teks tetap teks (font di-embed sebagai subset), bentuk tetap vektor.
 * Huruf dalam satu baris digabung menjadi satu potongan teks (lib/render/text-runs.ts)
 * agar Illustrator membukanya sebagai kalimat utuh, bukan per huruf.
 * Catatan: svg-to-pdfkit hanya mengenali bold bila font-weight="bold" (bukan 700).
 */
export async function svgToPdf(
  svg: string,
  opts: PdfOptions,
): Promise<{ pdf: Buffer; warnings: RenderWarning[] }> {
  const warnings: RenderWarning[] = [];
  const width = opts.widthMm * MM_TO_PT;
  const height = opts.heightMm * MM_TO_PT;
  const doc = new PDFDocument({
    size: [width, height],
    margin: 0,
    autoFirstPage: true,
    info: { Title: opts.title ?? "Brand Package", Producer: "Brand Package Automation" },
  });

  const registered = new Set<string>();
  for (const [family, files] of Object.entries(opts.fonts)) {
    doc.registerFont(`${family}|regular`, files.regular);
    registered.add(`${family}|regular`);
    if (files.bold) {
      doc.registerFont(`${family}|bold`, files.bold);
      registered.add(`${family}|bold`);
    }
  }

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", reject);
  });

  withMergedTextRuns(doc, () => SVGtoPDF(doc, svg, 0, 0, {
    width,
    height,
    preserveAspectRatio: "xMidYMid meet",
    warningCallback: (message) => warnings.push({ source: "pdf", message }),
    fontCallback: (family, bold) => {
      const name = firstFamily(family);
      const key = `${name}|${bold ? "bold" : "regular"}`;
      if (registered.has(key)) return key;
      if (registered.has(`${name}|regular`)) {
        warnings.push({ source: "font", message: `Bold tidak tersedia untuk "${name}", dipakai Regular` });
        return `${name}|regular`;
      }
      warnings.push({ source: "font", message: `Font "${name}" tidak terdaftar, dipakai Helvetica` });
      return bold ? "Helvetica-Bold" : "Helvetica";
    },
  }));
  doc.end();
  await done;
  return { pdf: Buffer.concat(chunks), warnings };
}

/** SVG -> PNG preview (resvg, tanpa browser). Hanya memakai font yang diberikan, bukan font sistem. */
export function svgToPng(svg: string, fonts: Record<string, FontFamily>, widthPx = 1200): Buffer {
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: widthPx },
    font: { loadSystemFonts: false, fontFiles: allFontFiles(fonts), defaultFontFamily: "Lato" },
    background: "white",
  });
  return r.render().asPng();
}
