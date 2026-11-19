import { SPECS } from "@/lib/brand/specs";
import { escapeXml } from "@/lib/render/escape";
import { checkLayout, type CheckIssue } from "./checks";
import { formatPhone, kitColors, PLACEHOLDER, socialLine, type BrandKit } from "./kit";
import { placeLogo } from "./logo";
import { fit, r, text, wrap, type Box, type TextStyle } from "./text";

/**
 * Kartu nama 90 x 55 mm + bleed 3 mm (SPEC bagian 5). Depan = data orang dan kontak,
 * belakang = logo. Paket A dan B memakai layout berbeda. Satuan viewBox = mm.
 * Grup ber-id menjadi layer di Illustrator; panduan bleed/area aman ada di grup tersembunyi.
 */
const C = SPECS.materials.businessCard;
const BLEED = SPECS.print.bleedMm;
const SAFE = SPECS.print.safeAreaMm;
export const CARD_SIZE = { widthMm: C.widthMm + 2 * BLEED, heightMm: C.heightMm + 2 * BLEED };

const W = CARD_SIZE.widthMm;
const H = CARD_SIZE.heightMm;
const IN = BLEED + SAFE; // tepi area aman
const SAFE_AREA = { x: IN, y: IN, w: W - 2 * IN, h: H - 2 * IN };

export interface CardSide {
  svg: string;
  issues: CheckIssue[];
}

export interface BusinessCard {
  front: CardSide;
  back: CardSide;
}

function doc(title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
  <title>${escapeXml(title)}</title>
${body}
  <g id="panduan" display="none">
    <rect id="potong" x="${BLEED}" y="${BLEED}" width="${r(W - 2 * BLEED)}" height="${r(H - 2 * BLEED)}" fill="none" stroke="#FF00FF" stroke-width="0.1"/>
    <rect id="area-aman" x="${IN}" y="${IN}" width="${r(W - 2 * IN)}" height="${r(H - 2 * IN)}" fill="none" stroke="#00AEEF" stroke-width="0.1"/>
  </g>
</svg>`;
}

/** Baris kontak: telepon, email, alamat (maks. 2 baris), lalu sosial media (maks. 2). */
function contactLines(kit: BrandKit, style: TextStyle, maxWidth: number) {
  const c = kit.company;
  const lines: { id: string; value: string }[] = [];
  if (c.phone) lines.push({ id: "telepon", value: `${PLACEHOLDER[kit.lang].phone} ${formatPhone(c.phone)}` });
  if (c.email) lines.push({ id: "email", value: c.email });
  if (c.address) wrap(c.address, style, maxWidth, 2).forEach((v, i) => lines.push({ id: `alamat-${i + 1}`, value: v }));
  return lines;
}

/* ---------------- Paket A: putih, tenang, garis aksen ---------------- */

function frontA(kit: BrandKit): CardSide {
  const k = kitColors(kit);
  const ph = PLACEHOLDER[kit.lang];
  const heading = (size: number): TextStyle => ({ font: kit.fonts.heading, bold: true, size, color: k.dark });
  const body = (size: number, color = k.dark): TextStyle => ({ font: kit.fonts.body, size, color });
  const boxes: Box[] = [];
  const parts: string[] = [];

  const logo = placeLogo(kit.logo, { x: IN, y: IN, w: 26, h: 9 }, "start", "top");
  parts.push(`  <g id="logo">${logo.svg}</g>`);

  const nameStyle = fit(ph.name, heading(3.8), SAFE_AREA.w, 2.8);
  const name = text("nama", ph.name, IN, IN + 21, nameStyle, "#FFFFFF");
  const title = text("jabatan", ph.title, IN, IN + 25.5, body(2.5, k.primaryText), "#FFFFFF");
  boxes.push(name.box, title.box);

  const contactStyle = body(2.15, k.dark);
  const socials = kit.company.socials.slice(0, 2);
  const leftWidth = socials.length ? 50 : SAFE_AREA.w;
  const lines = contactLines(kit, contactStyle, leftWidth);
  const lh = 3.1;
  const contacts = lines.map((l, i) => text(l.id, l.value, IN, H - IN - (lines.length - 1 - i) * lh - 0.5, contactStyle, "#FFFFFF"));
  const soc = socials.map((s, i) => text(`sosmed-${i + 1}`, socialLine(s), W - IN, H - IN - (socials.length - 1 - i) * lh - 0.5, { ...contactStyle, anchor: "end" }, "#FFFFFF"));
  boxes.push(...contacts.map((x) => x.box), ...soc.map((x) => x.box));

  const ruleY = (contacts[0]?.box.y ?? H - IN - 6) - 2.6;
  return {
    svg: doc(
      `${kit.company.name} - kartu nama depan (Paket A)`,
      [
        `  <g id="latar"><rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/></g>`,
        ...parts,
        `  <g id="orang">${name.svg}${title.svg}</g>`,
        `  <g id="garis-aksen"><rect x="${IN}" y="${r(ruleY)}" width="10" height="0.6" fill="${k.primary}"/></g>`,
        `  <g id="kontak">${contacts.map((x) => x.svg).join("")}${soc.map((x) => x.svg).join("")}</g>`,
      ].join("\n"),
    ),
    issues: checkLayout(boxes, SAFE_AREA),
  };
}

function backA(kit: BrandKit): CardSide {
  const k = kitColors(kit);
  const boxes: Box[] = [];
  const stripH = BLEED + 3.5;
  const logoBox = { x: IN, y: IN, w: SAFE_AREA.w, h: SAFE_AREA.h - stripH + BLEED - 2 };
  let companySvg = "";
  let box = { ...logoBox };
  if (!kit.logo.hasText) {
    // Nama perusahaan maks. 2 baris di bawah logo.
    const st: TextStyle = { font: kit.fonts.heading, bold: true, size: 3.2, color: k.dark, anchor: "middle" };
    const lines = wrap(kit.company.name, st, SAFE_AREA.w - 4, 2);
    const last = fit(lines[lines.length - 1], st, SAFE_AREA.w - 4, 2.2);
    box = { ...logoBox, h: logoBox.h - 3 - 4 * lines.length };
    const ts = lines.map((v, i) => text(`nama-perusahaan-${i + 1}`, v, W / 2, box.y + box.h + 5 + i * 4, i === lines.length - 1 ? last : st, "#FFFFFF"));
    boxes.push(...ts.map((t) => t.box));
    companySvg = `  <g id="perusahaan">${ts.map((t) => t.svg).join("")}</g>`;
  }
  const logo = placeLogo(kit.logo, { x: box.x + 8, y: box.y + 4, w: box.w - 16, h: box.h - 6 });
  return {
    svg: doc(
      `${kit.company.name} - kartu nama belakang (Paket A)`,
      [
        `  <g id="latar"><rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/><rect id="pita" x="0" y="${r(H - stripH)}" width="${W}" height="${r(stripH)}" fill="${k.primary}"/></g>`,
        `  <g id="logo">${logo.svg}</g>`,
        companySvg,
      ].filter(Boolean).join("\n"),
    ),
    issues: checkLayout(boxes, SAFE_AREA),
  };
}

/* ---------------- Paket B: panel warna, aksen kontras ---------------- */

const PANEL = 33; // lebar panel kiri dari tepi bleed

function frontB(kit: BrandKit): CardSide {
  const k = kitColors(kit);
  const ph = PLACEHOLDER[kit.lang];
  const boxes: Box[] = [];
  const x0 = PANEL + 4;
  const area = { x: x0, y: IN, w: W - IN - x0, h: SAFE_AREA.h };

  // Logo di atas pelat putih membulat di panel warna utama (selalu terbaca).
  const plate = { x: BLEED + SAFE - 1, y: IN + 2, w: PANEL - BLEED - SAFE - 2, h: PANEL - BLEED - SAFE - 2 };
  const logo = placeLogo(kit.logo, { x: plate.x + 2.5, y: plate.y + 2.5, w: plate.w - 5, h: plate.h - 5 });

  const nameStyle = fit(ph.name, { font: kit.fonts.heading, bold: true, size: 3.6, color: k.dark }, area.w, 2.8);
  const name = text("nama", ph.name, x0, IN + 9, nameStyle, "#FFFFFF");
  const title = text("jabatan", ph.title.toUpperCase(), x0, IN + 13.2, { font: kit.fonts.body, bold: true, size: 2.1, color: k.accentText, letterSpacing: 0.25 }, "#FFFFFF");
  boxes.push(name.box, title.box);

  const contactStyle: TextStyle = { font: kit.fonts.body, size: 2.15, color: k.dark };
  const lines = contactLines(kit, contactStyle, area.w - 3);
  const socials = kit.company.socials.slice(0, 2).map((s, i) => ({ id: `sosmed-${i + 1}`, value: socialLine(s) }));
  const all = [...lines, ...socials];
  const lh = 3.2;
  const startY = H - IN - (all.length - 1) * lh - 0.5;
  const rows = all.map((l, i) => {
    const t = text(l.id, l.value, x0 + 3, startY + i * lh, contactStyle, "#FFFFFF");
    const isCont = /^alamat-[2-9]/.test(l.id);
    const dot = isCont ? "" : `<rect x="${r(x0)}" y="${r(startY + i * lh - 1.55)}" width="1.3" height="1.3" fill="${k.accent}"/>`;
    return { svg: dot + t.svg, box: t.box };
  });
  boxes.push(...rows.map((x) => x.box));

  return {
    svg: doc(
      `${kit.company.name} - kartu nama depan (Paket B)`,
      [
        `  <g id="latar"><rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/><rect id="panel" x="0" y="0" width="${PANEL}" height="${H}" fill="${k.primary}"/><rect id="garis-aksen" x="${PANEL}" y="0" width="1.2" height="${H}" fill="${k.accent}"/></g>`,
        `  <g id="logo"><rect id="pelat-logo" x="${r(plate.x)}" y="${r(plate.y)}" width="${r(plate.w)}" height="${r(plate.h)}" rx="2" fill="#FFFFFF"/>${logo.svg}</g>`,
        `  <g id="orang">${name.svg}${title.svg}</g>`,
        `  <g id="kontak">${rows.map((x) => x.svg).join("")}</g>`,
      ].join("\n"),
    ),
    issues: checkLayout(boxes, { ...area, x: area.x - 0.01 }),
  };
}

function backB(kit: BrandKit): CardSide {
  const k = kitColors(kit);
  const boxes: Box[] = [];
  const plateW = 52;
  const plateH = 30;
  const plate = { x: (W - plateW) / 2, y: (H - plateH) / 2, w: plateW, h: plateH };
  let inner = { x: plate.x + 5, y: plate.y + 4, w: plate.w - 10, h: plate.h - 8 };
  let companySvg = "";
  if (!kit.logo.hasText) {
    // Nama perusahaan maks. 2 baris di dalam pelat, dengan jarak tepi 6 mm.
    const st: TextStyle = { font: kit.fonts.heading, bold: true, size: 2.6, color: k.dark, anchor: "middle" };
    const lines = wrap(kit.company.name, st, plate.w - 12, 2);
    const last = fit(lines[lines.length - 1], st, plate.w - 12, 2);
    inner = { ...inner, h: inner.h - 3.6 * lines.length - 1 };
    const ts = lines.map((v, i) =>
      text(`nama-perusahaan-${i + 1}`, v, W / 2, plate.y + plate.h - 3.8 - (lines.length - 1 - i) * 3.4, i === lines.length - 1 ? last : st, "#FFFFFF"),
    );
    boxes.push(...ts.map((t) => t.box));
    companySvg = ts.map((t) => t.svg).join("");
  }
  const logo = placeLogo(kit.logo, inner);
  return {
    svg: doc(
      `${kit.company.name} - kartu nama belakang (Paket B)`,
      [
        `  <g id="latar"><rect x="0" y="0" width="${W}" height="${H}" fill="${k.primary}"/><circle id="lingkaran-aksen" cx="${r(W - 8)}" cy="8" r="16" fill="${k.accent}"/><circle id="lingkaran-kecil" cx="10" cy="${r(H - 9)}" r="6" fill="none" stroke="${k.onPrimary}" stroke-width="0.5" opacity="0.6"/></g>`,
        `  <g id="logo"><rect id="pelat-logo" x="${r(plate.x)}" y="${r(plate.y)}" width="${plate.w}" height="${plate.h}" rx="2.5" fill="#FFFFFF"/>${logo.svg}${companySvg}</g>`,
      ].join("\n"),
    ),
    issues: checkLayout(boxes, SAFE_AREA),
  };
}

export function businessCard(kit: BrandKit): BusinessCard {
  return kit.pkg === "A" ? { front: frontA(kit), back: backA(kit) } : { front: frontB(kit), back: backB(kit) };
}
