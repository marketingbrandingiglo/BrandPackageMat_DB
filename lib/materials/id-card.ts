import { SPECS } from "@/lib/brand/specs";
import { contactLines } from "./business-card";
import { checkLayout, type CheckIssue } from "./checks";
import { kitColors, PLACEHOLDER, type BrandKit } from "./kit";
import { placeLogo } from "./logo";
import { placeVisual } from "./visual";
import { BLEED, sheet, svgDoc, type Sheet } from "./svgdoc";
import { fit, r, text, wrap, type Box, type TextStyle } from "./text";

/**
 * ID card CR80 (SPEC bagian 5): landscape 85,6 x 54 mm dan portrait 54 x 85,6 mm, tanpa bleed (dihapus 2026-11-27).
 * Depan: logo, foto (placeholder), nama, jabatan, nomor ID. Belakang: logo, kontak perusahaan,
 * catatan "bila menemukan kartu ini". Area lubang tali (tengah atas) dibiarkan kosong.
 */
export type Orientation = "landscape" | "portrait";

const L = sheet(SPECS.materials.idCardLandscape.widthMm, SPECS.materials.idCardLandscape.heightMm);
const P = sheet(SPECS.materials.idCardPortrait.widthMm, SPECS.materials.idCardPortrait.heightMm);
export const ID_SIZE: Record<Orientation, { widthMm: number; heightMm: number }> = { landscape: L.size, portrait: P.size };

/** Lubang tali (slot) 13 x 3 mm di tengah atas, 4 mm dari tepi potong (kedua orientasi). */
function slot(s: Sheet) {
  return { x: s.W / 2 - 6.5, y: BLEED + 4, w: 13, h: 3 };
}
/** Zona larangan di sekitar lubang tali (dipakai pengecekan tabrakan). */
const keepOut = (z: { x: number; y: number; w: number; h: number }): Box => ({ id: "lubang-tali", x: z.x - 2, y: z.y - 2, w: z.w + 4, h: z.h + 4 });
const slotGuide = (z: { x: number; y: number; w: number; h: number }) =>
  `\n    <rect id="lubang-tali" x="${r(z.x)}" y="${r(z.y)}" width="${r(z.w)}" height="${r(z.h)}" rx="1.5" fill="none" stroke="#FF00FF" stroke-width="0.1"/>`;

export interface IdSide {
  svg: string;
  issues: CheckIssue[];
}
export interface IdCard {
  front: IdSide;
  back: IdSide;
}

function photo(x: number, y: number, w: number, h: number, label: string, k: ReturnType<typeof kitColors>, kit: BrandKit, round = false) {
  const st: TextStyle = { font: kit.fonts.body, size: 2.2, color: k.dark, anchor: "middle" };
  const t = text("label-foto", label, x + w / 2, y + h / 2 + 0.8, st, k.light);
  const shape = round
    ? `<circle id="bingkai-foto" cx="${r(x + w / 2)}" cy="${r(y + h / 2)}" r="${r(w / 2)}" fill="${k.light}" stroke="#FFFFFF" stroke-width="0.8"/>`
    : `<rect id="bingkai-foto" x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="1.5" fill="${k.light}"/>`;
  return { svg: `  <g id="foto">${shape}${t.svg}</g>`, box: t.box };
}

function person(kit: BrandKit, k: ReturnType<typeof kitColors>, x: number, y: number, maxW: number, anchor: "start" | "middle", bg = "#FFFFFF") {
  const ph = PLACEHOLDER[kit.lang];
  const name = text("nama", ph.name, x, y, fit(ph.name, { font: kit.fonts.heading, bold: true, size: 3.8, color: k.dark, anchor }, maxW, 2.8), bg);
  const titleStyle: TextStyle = kit.pkg === "B"
    ? { font: kit.fonts.body, bold: true, size: 2.2, color: k.accentText, letterSpacing: 0.25, anchor }
    : { font: kit.fonts.body, size: 2.5, color: k.primaryText, anchor };
  const titleText = kit.pkg === "B" ? ph.title.toUpperCase() : ph.title;
  const title = text("jabatan", titleText, x, y + 4.4, titleStyle, bg);
  const id = text("nomor-id", ph.idNumber, x, y + 9, { font: kit.fonts.body, size: 2.1, color: k.mid, anchor }, bg);
  return { svg: `  <g id="orang">${name.svg}${title.svg}${id.svg}</g>`, boxes: [name.box, title.box, id.box] };
}

/* ---------------- Depan ---------------- */

function frontLandscape(kit: BrandKit): IdSide {
  const k = kitColors(kit);
  const s = L;
  const ph = PLACEHOLDER[kit.lang];
  const z = slot(s);
  const x0 = s.IN;
  const top = z.y + z.h + 4; // di bawah lubang tali
  const parts: string[] = [];
  const boxes: Box[] = [];
  if (kit.pkg === "A") {
    parts.push(`  <g id="latar"><rect width="${s.W}" height="${s.H}" fill="#FFFFFF"/><rect id="pita" x="0" y="${r(s.H - BLEED - 4)}" width="${s.W}" height="${r(BLEED + 4)}" fill="${k.primary}"/></g>`);
    const logo = placeLogo(kit.logo, { x: x0, y: s.IN, w: Math.min(28, z.x - 3 - x0), h: 9 }, "start", "top");
    parts.push(`  <g id="logo">${logo.svg}</g>`);
    boxes.push({ id: "logo", x: logo.x, y: logo.y, w: logo.w, h: logo.h });
    const f = photo(x0, top + 4, 20, 25, ph.photo, k, kit);
    const p = person(kit, k, x0 + 24, top + 13, s.W - s.IN - (x0 + 24), "start");
    parts.push(f.svg, p.svg);
    boxes.push(f.box, ...p.boxes);
  } else {
    const panel = x0 + 24;
    parts.push(`  <g id="latar"><rect width="${s.W}" height="${s.H}" fill="#FFFFFF"/><rect id="panel" x="0" y="0" width="${r(panel)}" height="${s.H}" fill="${k.primary}"/><rect id="garis-aksen" x="${r(panel)}" y="0" width="1.2" height="${s.H}" fill="${k.accent}"/></g>`);
    const f = photo(x0 + 1, top + 4, 18, 23, ph.photo, k, kit);
    const logoX = z.x + z.w + 3;
    const logo = placeLogo(kit.logo, { x: logoX, y: s.IN, w: s.W - s.IN - logoX, h: 9 }, "end", "top");
    boxes.push({ id: "logo", x: logo.x, y: logo.y, w: logo.w, h: logo.h });
    const p = person(kit, k, panel + 5, top + 13, s.W - s.IN - panel - 5, "start");
    parts.push(f.svg, `  <g id="logo">${logo.svg}</g>`, p.svg);
    boxes.push(...p.boxes);
  }
  return { svg: svgDoc(s, `${kit.company.name} - ID card landscape depan (Paket ${kit.pkg})`, parts.join("\n"), slotGuide(z)), issues: checkLayout(boxes, s.safe, [keepOut(z)]) };
}

function frontPortrait(kit: BrandKit): IdSide {
  const k = kitColors(kit);
  const s = P;
  const ph = PLACEHOLDER[kit.lang];
  const z = slot(s);
  const y0 = z.y + z.h + 3;
  const cx = s.W / 2;
  const parts: string[] = [];
  const boxes: Box[] = [];
  if (kit.pkg === "A") {
    parts.push(`  <g id="latar"><rect width="${s.W}" height="${s.H}" fill="#FFFFFF"/><rect id="pita" x="0" y="${r(s.H - BLEED - 5)}" width="${s.W}" height="${r(BLEED + 5)}" fill="${k.primary}"/></g>`);
    const logo = placeLogo(kit.logo, { x: s.IN, y: y0, w: s.safe.w, h: 10 }, "center", "top");
    const f = photo(cx - 12, y0 + 14, 24, 30, ph.photo, k, kit);
    const p = person(kit, k, cx, y0 + 52, s.safe.w, "middle");
    parts.push(`  <g id="logo">${logo.svg}</g>`, f.svg, p.svg);
    boxes.push(f.box, ...p.boxes);
  } else {
    const band = y0 + 30;
    parts.push(`  <g id="latar"><rect width="${s.W}" height="${s.H}" fill="#FFFFFF"/><rect id="panel" x="0" y="0" width="${s.W}" height="${r(band)}" fill="${k.primary}"/><rect id="garis-aksen" x="0" y="${r(band)}" width="${s.W}" height="1.2" fill="${k.accent}"/></g>`);
    const f = photo(cx - 13, band - 20, 26, 26, ph.photo, k, kit, true);
    const p = person(kit, k, cx, band + 15, s.safe.w, "middle");
    const logo = placeLogo(kit.logo, { x: s.IN + 6, y: s.H - s.IN - 9, w: s.safe.w - 12, h: 9 }, "center", "bottom");
    parts.push(f.svg, p.svg, `  <g id="logo">${logo.svg}</g>`);
    boxes.push(...p.boxes);
  }
  return { svg: svgDoc(s, `${kit.company.name} - ID card portrait depan (Paket ${kit.pkg})`, parts.join("\n"), slotGuide(z)), issues: checkLayout(boxes, s.safe, [keepOut(z)]) };
}

/* ---------------- Belakang ---------------- */

function back(kit: BrandKit, o: Orientation): IdSide {
  const k = kitColors(kit);
  const s = o === "portrait" ? P : L;
  const z = slot(s);
  // Visual dekoratif (Tahap 5): pita bawah, isi berhenti 2 mm di atasnya.
  const band = kit.visual ? BLEED + (o === "portrait" ? 16 : 7) : 0;
  const bottom = band ? Math.min(s.H - s.IN, s.H - band - 2) : s.H - s.IN;
  const area = { x: s.IN, y: z.y + z.h + 3, w: s.safe.w, h: bottom - (z.y + z.h + 3) };
  const dark = kit.pkg === "B";
  const bg = dark ? k.primary : "#FFFFFF";
  const fg = dark ? k.onPrimary : k.dark;
  const parts: string[] = [];
  const boxes: Box[] = [];
  parts.push(
    kit.visual
      ? `  <g id="latar"><rect width="${s.W}" height="${s.H}" fill="${dark ? k.primary : "#FFFFFF"}"/>${placeVisual(kit.visual, { x: 0, y: s.H - band, w: s.W, h: band }, "pita")}</g>`
      : dark
      ? `  <g id="latar"><rect width="${s.W}" height="${s.H}" fill="${k.primary}"/><circle id="lingkaran-aksen" cx="${r(s.W - BLEED + 1)}" cy="${r(s.H - BLEED + 1)}" r="${o === "portrait" ? 13 : 9}" fill="${k.accent}"/></g>`
      : `  <g id="latar"><rect width="${s.W}" height="${s.H}" fill="#FFFFFF"/><rect id="pita" x="0" y="${r(s.H - BLEED - 3)}" width="${s.W}" height="${r(BLEED + 3)}" fill="${k.primary}"/></g>`,
  );
  // Logo (di atas pelat putih bila latar berwarna).
  const logoH = o === "portrait" ? 14 : 8;
  const plate = { x: area.x, y: area.y, w: area.w, h: logoH + (dark ? 6 : 0) };
  const logo = placeLogo(kit.logo, dark ? { x: plate.x + 4, y: plate.y + 3, w: plate.w - 8, h: logoH } : { x: area.x, y: area.y, w: area.w, h: logoH }, "center", "middle");
  parts.push(`  <g id="logo">${dark ? `<rect id="pelat-logo" x="${r(plate.x)}" y="${r(plate.y)}" width="${r(plate.w)}" height="${r(plate.h)}" rx="2" fill="#FFFFFF"/>` : ""}${logo.svg}</g>`);

  const anchor = "middle" as const;
  const cx = area.x + area.w / 2;
  let y = plate.y + plate.h + 6;
  const name = kit.company.name;
  const ns: TextStyle = { font: kit.fonts.heading, bold: true, size: 2.6, color: fg, anchor };
  const nameLines = wrap(name, ns, area.w, 2);
  const lines: string[] = [];
  nameLines.forEach((v, i) => {
    const t = text(`nama-perusahaan-${i + 1}`, v, cx, y, i === nameLines.length - 1 ? fit(v, ns, area.w, 2) : ns, bg);
    lines.push(t.svg);
    boxes.push(t.box);
    y += 3.3;
  });
  y += 0.8;
  const cs: TextStyle = { font: kit.fonts.body, size: 2, color: fg, anchor };
  for (const l of contactLines(kit, cs, area.w)) {
    const t = text(l.id, l.value, cx, y, cs, bg);
    lines.push(t.svg);
    boxes.push(t.box);
    y += 2.9;
  }
  const note = wrap(PLACEHOLDER[kit.lang].found, { ...cs, size: 1.8 }, area.w, 3);
  y += 1.2;
  note.forEach((v, i) => {
    const t = text(`catatan-${i + 1}`, v, cx, y, { ...cs, size: 1.8 }, bg);
    lines.push(t.svg);
    boxes.push(t.box);
    y += 2.5;
  });
  parts.push(`  <g id="perusahaan">${lines.join("")}</g>`);
  return { svg: svgDoc(s, `${kit.company.name} - ID card ${o} belakang (Paket ${kit.pkg})`, parts.join("\n"), slotGuide(z)), issues: checkLayout(boxes, area, [keepOut(z)]) };
}

export function idCard(kit: BrandKit, o: Orientation): IdCard {
  return { front: o === "portrait" ? frontPortrait(kit) : frontLandscape(kit), back: back(kit, o) };
}
