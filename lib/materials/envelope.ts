import { SPECS } from "@/lib/brand/specs";
import { contactLines } from "./business-card";
import { checkLayout, type CheckIssue } from "./checks";
import { kitColors, PLACEHOLDER, type BrandKit } from "./kit";
import { placeLogo } from "./logo";
import { BLEED, sheet, svgDoc } from "./svgdoc";
import { fit, r, text, wrap, type Box, type TextStyle } from "./text";

/**
 * Amplop DL 220 x 110 mm, tanpa bleed (SPEC bagian 5; bleed dihapus 2026-11-27; ukuran diverifikasi ke percetakan).
 * Satu sisi (depan): logo dan alamat pengirim di kiri atas, area alamat penerima di kanan.
 */
const E = SPECS.materials.envelope;
const S = sheet(E.widthMm, E.heightMm);
export const ENVELOPE_SIZE = S.size;

export interface Envelope {
  svg: string;
  issues: CheckIssue[];
}

export function envelope(kit: BrandKit): Envelope {
  const k = kitColors(kit);
  const { W, H } = S;
  const parts: string[] = [];
  const boxes: Box[] = [];
  // Margin dalam lebih lega untuk amplop (12 mm dari garis potong).
  const M = BLEED + 12;
  const isB = kit.pkg === "B";
  const x0 = isB ? M + 6 : M;
  // Segitiga sudut kanan atas: memotong tepi atas 38,4 mm dari kanan dan tepi kanan 25,04 mm dari atas
  // (relatif garis potong), diperpanjang ke tepi bleed bila ada.
  const tx = W - BLEED - 38.4 - BLEED * (46 / 30);
  const ty = 25.04 + BLEED + BLEED * (30 / 46);

  parts.push(
    isB
      ? `  <g id="latar"><rect width="${W}" height="${H}" fill="#FFFFFF"/><rect id="panel" x="0" y="0" width="${BLEED + 8}" height="${H}" fill="${k.primary}"/><rect id="garis-aksen" x="${BLEED + 8}" y="0" width="1.5" height="${H}" fill="${k.accent}"/><path id="sudut-aksen" d="M${r(tx)} 0 L${W} 0 L${W} ${r(ty)} Z" fill="${k.primary}"/></g>`
      : `  <g id="latar"><rect width="${W}" height="${H}" fill="#FFFFFF"/><rect id="pita" x="0" y="${r(H - BLEED - 5)}" width="${W}" height="${r(BLEED + 5)}" fill="${k.primary}"/></g>`,
  );

  const logo = placeLogo(kit.logo, { x: x0, y: M, w: 45, h: 14 }, "start", "top");
  parts.push(`  <g id="logo">${logo.svg}</g>`);

  // Alamat pengirim.
  const senderW = 80;
  let y = logo.y + logo.h + 7;
  const ns: TextStyle = { font: kit.fonts.heading, bold: true, size: 3, color: k.dark };
  const lines: string[] = [];
  const nameLines = wrap(kit.company.name, ns, senderW, 2);
  nameLines.forEach((v, i) => {
    const t = text(`pengirim-nama-${i + 1}`, v, x0, y, i === nameLines.length - 1 ? fit(v, ns, senderW, 2.4) : ns);
    t.box.bg = "#FFFFFF";
    lines.push(t.svg);
    boxes.push(t.box);
    y += 4;
  });
  const cs: TextStyle = { font: kit.fonts.body, size: 2.5, color: k.dark };
  for (const l of contactLines(kit, cs, senderW)) {
    const t = text(`pengirim-${l.id}`, l.value, x0, y, cs, "#FFFFFF");
    lines.push(t.svg);
    boxes.push(t.box);
    y += 3.6;
  }
  parts.push(`  <g id="pengirim">${lines.join("")}</g>`);

  // Area penerima: label + 4 garis tipis untuk diisi.
  const rx = W / 2 + 6;
  const rw = W - M - rx;
  const ry = H / 2 - 2;
  const to = text("penerima-label", PLACEHOLDER[kit.lang].to, rx, ry, { font: kit.fonts.body, size: 2.8, color: k.mid }, "#FFFFFF");
  boxes.push(to.box);
  const rules = [1, 2, 3, 4].map((i) => `<rect x="${r(rx)}" y="${r(ry + 3 + i * 7)}" width="${r(rw)}" height="0.25" fill="${k.light}"/>`).join("");
  parts.push(`  <g id="penerima">${to.svg}${rules}</g>`);

  const safe = { x: x0, y: M, w: W - M - x0, h: H - 2 * M };
  return { svg: svgDoc(S, `${kit.company.name} - amplop (Paket ${kit.pkg})`, parts.join("\n")), issues: checkLayout(boxes, safe) };
}
