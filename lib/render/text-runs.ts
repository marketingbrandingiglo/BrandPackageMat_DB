/**
 * svg-to-pdfkit menulis setiap huruf dengan matriks posisi sendiri ("Tm ... Tj"),
 * sehingga Illustrator membuka teks PDF sebagai potongan per huruf.
 *
 * Modul ini menyisipkan filter pada doc.addContent selama render SVG: blok teks
 * (BT ... ET) dikumpulkan, lalu huruf-huruf yang berada di satu baris dan
 * bertransformasi sama digabung menjadi satu "Tm" + satu operator "TJ" dengan
 * penyesuaian jarak (kerning, letter-spacing). Posisi akhir setiap huruf tetap sama.
 */

interface Glyph {
  m: number[]; // a b c d e f
  raw: string; // baris Tm asli
  hex: string;
}

type PdfDoc = PDFKit.PDFDocument & {
  addContent(data: string): PdfDoc;
  _fontFamilies?: Record<string, { id?: string; widths?: number[] }>;
};

const TM = /^(-?[\d.e+-]+) (-?[\d.e+-]+) (-?[\d.e+-]+) (-?[\d.e+-]+) (-?[\d.e+-]+) (-?[\d.e+-]+) Tm$/;
const TJ = /^<([0-9a-fA-F]+)> Tj$/;
const TF = /^\/(\S+) (-?[\d.e+-]+) Tf$/;
const EPS = 1e-6;

function fmt(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

function fontWidths(doc: PdfDoc, id: string): number[] | undefined {
  for (const f of Object.values(doc._fontFamilies ?? {})) {
    if (f.id === id && Array.isArray(f.widths)) return f.widths;
  }
  return undefined;
}

/** Gabungkan satu blok BT..ET. Mengembalikan null bila blok tidak dikenali (ditulis apa adanya). */
export function mergeTextBlock(lines: string[], widthsFor: (fontId: string) => number[] | undefined): string[] | null {
  const out: string[] = [];
  let size = 0;
  let widths: number[] | undefined;
  let run: Glyph[] = [];

  const flush = () => {
    if (!run.length) return;
    const a = run[0].m[0];
    out.push(run[0].raw);
    const parts: string[] = [];
    for (let i = 0; i < run.length; i++) {
      parts.push(`<${run[i].hex}>`);
      const next = run[i + 1];
      if (!next) break;
      const w = widths![parseInt(run[i].hex, 16)] ?? 0;
      // Jarak alami setelah huruf ini (ruang pengguna) vs jarak sebenarnya.
      const natural = (w / 1000) * size * a;
      const actual = next.m[4] - run[i].m[4];
      const adj = (-(actual - natural) * 1000) / (size * a);
      if (Math.abs(adj) > 0.01) parts.push(fmt(adj));
    }
    out.push(`[${parts.join(" ")}] TJ`);
    run = [];
  };

  for (const line of lines) {
    let m: RegExpExecArray | null;
    if ((m = TF.exec(line))) {
      flush();
      size = Number(m[2]);
      widths = widthsFor(m[1]);
      if (!widths) return null;
      out.push(line);
    } else if ((m = TM.exec(line))) {
      const g: Glyph = { m: m.slice(1, 7).map(Number), raw: line, hex: "" };
      const prev = run[run.length - 1];
      // Satu run hanya bila a,b,c,d sama, baseline sama (f), tanpa rotasi, dan maju ke kanan.
      const same =
        prev &&
        [0, 1, 2, 3].every((k) => Math.abs(prev.m[k] - g.m[k]) < EPS) &&
        Math.abs(prev.m[5] - g.m[5]) < EPS &&
        Math.abs(g.m[1]) < EPS &&
        Math.abs(g.m[2]) < EPS &&
        g.m[0] > 0 &&
        g.m[4] >= prev.m[4];
      if (!same) flush();
      run.push(g);
    } else if ((m = TJ.exec(line))) {
      const last = run[run.length - 1];
      if (!last || last.hex) return null;
      last.hex = m[1];
    } else if (line === "BT" || line === "ET" || /^\d Tr$/.test(line)) {
      flush();
      out.push(line);
    } else {
      return null;
    }
  }
  flush();
  return out;
}

/** Jalankan fn dengan filter penggabung teks aktif pada doc. */
export function withMergedTextRuns<T>(doc: PDFKit.PDFDocument, fn: () => T): T {
  const d = doc as PdfDoc;
  const original = d.addContent.bind(d);
  let block: string[] | null = null;
  d.addContent = (data: string) => {
    if (block === null) {
      if (data === "BT") block = ["BT"];
      else original(data);
      return d;
    }
    block.push(data);
    if (data === "ET") {
      const lines = block;
      block = null;
      const merged = mergeTextBlock(lines, (id) => fontWidths(d, id));
      for (const l of merged ?? lines) original(l);
    }
    return d;
  };
  try {
    return fn();
  } finally {
    const pending = block as string[] | null;
    if (pending) for (const l of pending) original(l);
    d.addContent = original;
  }
}
