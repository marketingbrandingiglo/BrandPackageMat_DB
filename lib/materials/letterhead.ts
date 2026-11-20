import {
  AlignmentType,
  BorderStyle,
  convertMillimetersToTwip,
  Document,
  Footer,
  Header,
  ImageRun,
  LineRuleType,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
  type IImageOptions,
} from "docx";
import { Resvg } from "@resvg/resvg-js";
import { SPECS } from "@/lib/brand/specs";
import { checkLayout, type CheckIssue } from "./checks";
import { formatPhone, kitColors, PLACEHOLDER, socialLine, type BrandKit } from "./kit";
import { placeLogo } from "./logo";
import { svgDoc, type Sheet } from "./svgdoc";
import { fit, r, text, wrap, type Box, type TextStyle } from "./text";

/**
 * Kop surat A4 (SPEC bagian 5): header dan footer yang sama di setiap halaman.
 * Header: logo, nama perusahaan, alamat utama, telepon. Footer: kontak lain (email, sosial media).
 * - DOCX: header/footer asli Word, gaya paragraf memakai font dan warna brand, kerangka surat
 *   dengan placeholder. Font Google harus terpasang di komputer user.
 * - PDF/SVG: kertas kop (header + footer saja) untuk dicetak. Tanpa bleed: semua elemen
 *   berada di dalam margin cetak printer kantor.
 */
const A4 = SPECS.materials.letterhead;
const PAGE: Sheet = { W: A4.widthMm, H: A4.heightMm, IN: 0, safe: { x: 12, y: 10, w: A4.widthMm - 24, h: A4.heightMm - 20 }, size: { widthMm: A4.widthMm, heightMm: A4.heightMm } };
export const LETTERHEAD_SIZE = PAGE.size;

/** Margin halaman surat (mm). */
export const MARGIN = { left: 25, right: 25, top: 50, bottom: 30, header: 12, footer: 12 };

interface Content {
  company: string;
  address: string;
  phone: string;
  footer: string;
  /** Alamat/telepon tambahan, baris kedua footer. */
  extra: string;
}

function content(kit: BrandKit): Content {
  const c = kit.company;
  const phone = c.phone ? `${PLACEHOLDER[kit.lang].phone} ${formatPhone(c.phone)}` : "";
  const footer = [c.email, ...c.socials.slice(0, 3).map(socialLine)].filter(Boolean).join("   ·   ");
  const extra = [...(c.extraAddresses ?? []).slice(0, 2), ...(c.extraPhones ?? []).slice(0, 2).map(formatPhone)].filter(Boolean).join("   ·   ");
  return { company: c.name, address: c.address, phone, footer, extra };
}

/* ---------------- PDF / SVG (kertas kop) ---------------- */

export function letterheadSvg(kit: BrandKit): { svg: string; issues: CheckIssue[] } {
  const k = kitColors(kit);
  const ct = content(kit);
  const W = PAGE.W;
  const L = MARGIN.left;
  const R = W - MARGIN.right;
  const top = MARGIN.header;
  const parts: string[] = [`  <g id="latar"><rect width="${W}" height="${PAGE.H}" fill="#FFFFFF"/></g>`];
  const boxes: Box[] = [];
  const isB = kit.pkg === "B";

  // Logo: Paket A di kiri, Paket B di kanan.
  const logo = placeLogo(kit.logo, { x: isB ? R - 40 : L, y: top, w: 40, h: 16 }, isB ? "end" : "start", "top");
  parts.push(`  <g id="logo">${logo.svg}</g>`);

  // Blok perusahaan: Paket A rata kanan, Paket B rata kiri.
  const anchor = isB ? "start" : "end";
  const x = isB ? L : R;
  const blockW = R - L - logo.w - 8;
  const name: TextStyle = { font: kit.fonts.heading, bold: true, size: isB ? 5.4 : 4.6, color: isB ? k.dark : k.primaryText, anchor };
  const small: TextStyle = { font: kit.fonts.body, size: 3, color: k.dark, anchor };
  let y = top + (isB ? 5.6 : 4.6);
  const lines: string[] = [];
  const nt = text("nama-perusahaan", ct.company, x, y, fit(ct.company, name, blockW, 3.4), "#FFFFFF");
  lines.push(nt.svg);
  boxes.push(nt.box);
  y += isB ? 5.4 : 5;
  for (const [i, v] of [...wrap(ct.address, small, blockW, 2), ct.phone].filter(Boolean).entries()) {
    const t = text(`kontak-${i + 1}`, v, x, y, small, "#FFFFFF");
    lines.push(t.svg);
    boxes.push(t.box);
    y += 4.1;
  }
  parts.push(`  <g id="perusahaan">${lines.join("")}</g>`);

  // Garis bawah header.
  const lineY = Math.max(top + 16, y - 1.5) + 3;
  parts.push(
    isB
      ? `  <g id="garis-header"><rect x="${L}" y="${r(lineY)}" width="${r(R - L)}" height="1.2" fill="${k.accent}"/><rect x="${L}" y="${r(lineY + 1.8)}" width="${r(R - L)}" height="0.35" fill="${k.primary}"/></g>`
      : `  <g id="garis-header"><rect x="${L}" y="${r(lineY)}" width="${r(R - L)}" height="0.5" fill="${k.primary}"/></g>`,
  );

  // Footer.
  const fy = PAGE.H - MARGIN.footer;
  const fs: TextStyle = { font: kit.fonts.body, size: 2.8, color: k.mid, anchor: isB ? "start" : "middle" };
  const flines = [ct.extra, ct.footer].filter(Boolean);
  if (flines.length) {
    const ts = flines.map((v, i) => {
      const t = text(`footer-${i + 1}`, v, isB ? L : W / 2, fy - (flines.length - 1 - i) * 4, fit(v, fs, R - L, 2.2), "#FFFFFF");
      boxes.push(t.box);
      return t.svg;
    });
    const ry = fy - 6 - (flines.length - 1) * 4;
    parts.push(`  <g id="footer"><rect x="${L}" y="${r(ry)}" width="${r(R - L)}" height="${isB ? 0.9 : 0.25}" fill="${isB ? k.primary : k.light}"/>${ts.join("")}</g>`);
  }
  const svg = svgDoc(PAGE, `${kit.company.name} - kop surat (Paket ${kit.pkg})`, parts.join("\n"));
  return { svg, issues: checkLayout(boxes, { x: L - 0.01, y: 8, w: R - L + 0.02, h: PAGE.H - 16 }) };
}

/* ---------------- DOCX ---------------- */

const hex = (c: string) => c.replace("#", "").toUpperCase();
const mmPx = (mm: number) => Math.round((mm / 25.4) * 96);
/** Spasi rapat untuk header/footer (tanpa jarak setelah paragraf, baris tunggal otomatis). */
const TIGHT = { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO };
const NONE: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

/** Logo untuk Word: SVG (dengan PNG cadangan) bila tersedia, PNG bila tidak. */
function logoRun(kit: BrandKit, wMm: number, hMm: number): ImageRun {
  let w = wMm;
  let h = w / kit.logo.aspect;
  if (h > hMm) {
    h = hMm;
    w = h * kit.logo.aspect;
  }
  const transformation = { width: mmPx(w), height: mmPx(h) };
  if (kit.logo.kind === "svg" && kit.logo.svg) {
    const png = new Resvg(kit.logo.svg, { fitTo: { mode: "width", value: Math.max(600, Math.round((w / 25.4) * 300)) }, background: "rgba(0,0,0,0)" }).render().asPng();
    const opts: IImageOptions = { type: "svg", data: Buffer.from(kit.logo.svg), fallback: { type: "png", data: png }, transformation, altText: { name: "Logo", description: kit.company.name, title: "Logo" } };
    return new ImageRun(opts);
  }
  return new ImageRun({ type: "png", data: kit.logo.png, transformation, altText: { name: "Logo", description: kit.company.name, title: "Logo" } });
}

const BODY: Record<"id" | "en", { place: string; number: string; subject: string; to: string; recipient: string; recipientAddress: string; greeting: string; body: string[]; closing: string }> = {
  id: {
    place: "[Kota], [tanggal bulan tahun]",
    number: "Nomor: [nomor surat]",
    subject: "Perihal: [perihal surat]",
    to: "Kepada Yth.",
    recipient: "[Nama penerima]",
    recipientAddress: "[Alamat penerima]",
    greeting: "Dengan hormat,",
    body: [
      "[Isi surat. Paragraf ini memakai gaya Normal dengan font dan warna brand. Ganti teks ini dengan isi surat Anda.]",
      "[Paragraf berikutnya. Header dan footer di atas dan di bawah halaman sama di setiap halaman.]",
    ],
    closing: "Hormat kami,",
  },
  en: {
    place: "[City], [date]",
    number: "Ref: [letter number]",
    subject: "Subject: [subject]",
    to: "To",
    recipient: "[Recipient name]",
    recipientAddress: "[Recipient address]",
    greeting: "Dear [recipient],",
    body: [
      "[Letter body. This paragraph uses the Normal style with the brand font and color. Replace this text with your letter.]",
      "[Next paragraph. The header and footer above and below are the same on every page.]",
    ],
    closing: "Sincerely,",
  },
};

export async function letterheadDocx(kit: BrandKit): Promise<Buffer> {
  const k = kitColors(kit);
  const ct = content(kit);
  const isB = kit.pkg === "B";
  const ph = PLACEHOLDER[kit.lang];
  const B = BODY[kit.lang];
  const bodyFont = kit.fonts.body.family;
  const headFont = kit.fonts.heading.family;
  const contentW = A4.widthMm - MARGIN.left - MARGIN.right;
  const logoW = 40;

  const companyParas = [
    new Paragraph({ alignment: isB ? AlignmentType.LEFT : AlignmentType.RIGHT, spacing: TIGHT, children: [new TextRun({ text: ct.company, font: headFont, bold: true, size: isB ? 30 : 26, color: hex(isB ? k.dark : k.primaryText) })] }),
    ...[ct.address, ct.phone].filter(Boolean).map(
      (v) => new Paragraph({ alignment: isB ? AlignmentType.LEFT : AlignmentType.RIGHT, spacing: { ...TIGHT, before: 30 }, children: [new TextRun({ text: v, font: bodyFont, size: 17, color: hex(k.dark) })] }),
    ),
  ];
  const logoPara = new Paragraph({ alignment: isB ? AlignmentType.RIGHT : AlignmentType.LEFT, spacing: TIGHT, children: [logoRun(kit, logoW, 16)] });
  const cellW = (mm: number) => ({ size: convertMillimetersToTwip(mm), type: WidthType.DXA });
  const logoCell = new TableCell({ width: cellW(logoW + 4), borders: noBorders, verticalAlign: VerticalAlign.CENTER, children: [logoPara] });
  const companyCell = new TableCell({ width: cellW(contentW - logoW - 4), borders: noBorders, verticalAlign: VerticalAlign.CENTER, children: companyParas });
  const headerTable = new Table({
    width: cellW(contentW),
    columnWidths: isB ? [convertMillimetersToTwip(contentW - logoW - 4), convertMillimetersToTwip(logoW + 4)] : [convertMillimetersToTwip(logoW + 4), convertMillimetersToTwip(contentW - logoW - 4)],
    borders: noBorders,
    rows: [new TableRow({ children: isB ? [companyCell, logoCell] : [logoCell, companyCell] })],
  });
  const rule = isB
    ? [
        new Paragraph({ spacing: { before: 100, after: 0, line: 40, lineRule: LineRuleType.EXACT }, border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: hex(k.accent), space: 1 } }, children: [] }),
        new Paragraph({ spacing: { before: 60, after: 0, line: 40, lineRule: LineRuleType.EXACT }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: hex(k.primary), space: 1 } }, children: [] }),
      ]
    : [new Paragraph({ spacing: { before: 100, after: 0, line: 40, lineRule: LineRuleType.EXACT }, border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: hex(k.primary), space: 1 } }, children: [] })];

  const flines = [ct.extra, ct.footer].filter(Boolean);
  const footerChildren = flines.length
    ? flines.map(
        (v, i) =>
          new Paragraph({
            alignment: isB ? AlignmentType.LEFT : AlignmentType.CENTER,
            spacing: TIGHT,
            ...(i === 0 ? { border: { top: isB ? { style: BorderStyle.SINGLE, size: 18, color: hex(k.primary), space: 6 } : { style: BorderStyle.SINGLE, size: 4, color: hex(k.light), space: 6 } } } : {}),
            children: [new TextRun({ text: v, font: bodyFont, size: 16, color: hex(k.mid) })],
          }),
      )
    : [new Paragraph({ children: [] })];

  // Tanpa `after`: jarak mengikuti gaya Normal (8 pt setelah paragraf).
  const p = (t: string, opts: { bold?: boolean; after?: number; style?: string } = {}) =>
    new Paragraph({ style: opts.style, ...(opts.after !== undefined ? { spacing: { after: opts.after } } : {}), children: [new TextRun({ text: t, bold: opts.bold })] });

  const doc = new Document({
    creator: "Brand Package Automation",
    title: `${kit.company.name} - kop surat`,
    styles: {
      default: { document: { run: { font: bodyFont, size: 22, color: hex(k.dark) }, paragraph: { spacing: { line: 288, lineRule: LineRuleType.AUTO } } } },
      paragraphStyles: [
        { id: "Normal", name: "Normal", run: { font: bodyFont, size: 22, color: hex(k.dark) }, paragraph: { spacing: { after: 160, line: 288, lineRule: LineRuleType.AUTO } } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: headFont, bold: true, size: 30, color: hex(k.primaryText) }, paragraph: { spacing: { before: 240, after: 120 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: headFont, bold: true, size: 24, color: hex(k.dark) }, paragraph: { spacing: { before: 200, after: 80 } } },
        { id: "Perihal", name: isBLabel(kit.lang), basedOn: "Normal", run: { font: headFont, bold: true, color: hex(k.primaryText) } },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            // Nilai twip A4 standar Word (11906 x 16838) supaya dikenali sebagai "A4".
            size: { width: 11906, height: 16838 },
            margin: {
              top: convertMillimetersToTwip(MARGIN.top),
              bottom: convertMillimetersToTwip(MARGIN.bottom),
              left: convertMillimetersToTwip(MARGIN.left),
              right: convertMillimetersToTwip(MARGIN.right),
              header: convertMillimetersToTwip(MARGIN.header),
              footer: convertMillimetersToTwip(MARGIN.footer),
            },
          },
        },
        headers: { default: new Header({ children: [headerTable, ...rule] }) },
        footers: { default: new Footer({ children: footerChildren }) },
        children: [
          p(B.place, { after: 0 }),
          p(B.number, { after: 0 }),
          p(B.subject, { after: 240, style: "Perihal" }),
          p(B.to, { after: 0 }),
          p(B.recipient, { bold: true, after: 0 }),
          p(B.recipientAddress, { after: 240 }),
          p(B.greeting),
          ...B.body.map((t) => p(t)),
          p(B.closing, { after: 900 }),
          p(`[${ph.name}]`, { bold: true, after: 0 }),
          p(`[${ph.title}]`),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

const isBLabel = (lang: "id" | "en") => (lang === "id" ? "Perihal" : "Subject");
