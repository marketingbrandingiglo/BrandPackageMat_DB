import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { escapeXml } from "@/lib/render/escape";
import type { FontRef } from "@/lib/brand/font-select";
import { formatPhone, kitColors, PLACEHOLDER, socialLine, type BrandKit } from "./kit";
import { SIGNATURE_LOGO_FILE, type Social } from "./types";

export { SIGNATURE_LOGO_FILE };

/**
 * Tahap 4f: email signature HTML (SPEC bagian 7 dan 17 butir 5, keputusan pemilik 2026-11-20: pilihan a).
 * Satu folder berisi `signature.html` + `logo-email.png` (gambar dirujuk relatif, bukan base64 dan
 * bukan URL aplikasi, karena file aplikasi hanya disimpan 90 hari). Tabel + gaya inline, lebar maks.
 * 600 px, font brand disebut pertama lalu cadangan web-safe (Arial/Georgia/Courier New).
 * Paket A: logo kiri + garis pemisah warna utama. Paket B: logo atas + pita warna aksen.
 */

export const SIGNATURE_MAX_WIDTH = 600;

/** Kotak logo dalam px CSS; file PNG dibuat 2x untuk layar retina. */
const LOGO_BOX = { A: { w: 120, h: 56 }, B: { w: 170, h: 48 } } as const;

export interface EmailSignature {
  html: string;
  logo: { png: Buffer; width: number; height: number };
  issues: string[];
}

export function fontStack(f: FontRef): string {
  const fallback = f.category === "Serif" ? "Georgia, 'Times New Roman', serif" : f.category === "Monospace" ? "'Courier New', Courier, monospace" : "Arial, Helvetica, sans-serif";
  return `'${f.family.replace(/'/g, "")}', ${fallback}`;
}

/** Tautan profil sosial media dari handle (URL lengkap dipakai apa adanya). */
export function socialUrl(s: Social): string {
  const h = s.handle.trim();
  if (/^https?:\/\//i.test(h)) return h;
  const at = h.replace(/^@/, "");
  switch (s.platform) {
    case "instagram":
      return `https://www.instagram.com/${at}`;
    case "linkedin":
      return at.includes("/") ? `https://www.linkedin.com/${at}` : `https://www.linkedin.com/company/${at}`;
    case "facebook":
      return `https://www.facebook.com/${at}`;
    case "x":
      return `https://x.com/${at}`;
    case "tiktok":
      return `https://www.tiktok.com/@${at}`;
    case "youtube":
      return `https://www.youtube.com/@${at}`;
    case "whatsapp":
      return `https://wa.me/${formatPhone(at).replace(/\D/g, "")}`;
  }
}

/** Logo PNG 2x: SVG dirender ulang, PNG dipangkas tepinya lalu diperkecil. */
async function logoPng(kit: BrandKit): Promise<EmailSignature["logo"]> {
  const box = LOGO_BOX[kit.pkg];
  let src: Buffer;
  if (kit.logo.kind === "svg" && kit.logo.svg) {
    src = new Resvg(kit.logo.svg, { fitTo: { mode: "width", value: box.w * 4 }, background: "rgba(0,0,0,0)" }).render().asPng();
  } else {
    src = kit.logo.png;
  }
  const trimmedSrc = await sharp(src).trim().png().toBuffer().catch(() => src);
  // Ukuran tampil dibulatkan ke px utuh, file tepat 2x (tajam di layar retina).
  const m = await sharp(trimmedSrc).metadata();
  const aspect = (m.width ?? 1) / (m.height ?? 1);
  let width: number = box.w;
  let height: number = Math.round(width / aspect);
  if (height > box.h) {
    height = box.h;
    width = Math.max(1, Math.round(height * aspect));
  }
  const png = await sharp(trimmedSrc).resize({ width: width * 2, height: height * 2, fit: "fill" }).png().toBuffer();
  return { png, width, height };
}

const e = escapeXml;

export async function emailSignature(kit: BrandKit): Promise<EmailSignature> {
  const c = kitColors(kit);
  const t = PLACEHOLDER[kit.lang];
  const co = kit.company;
  const head = fontStack(kit.fonts.heading);
  const body = fontStack(kit.fonts.body);
  const logo = await logoPng(kit);
  const isB = kit.pkg === "B";
  const issues: string[] = [];
  const link = isB ? c.accentText : c.primaryText;

  const img = `<img src="${SIGNATURE_LOGO_FILE}" width="${logo.width}" height="${logo.height}" alt="${e(co.name)}" style="display:block;border:0;outline:none;width:${logo.width}px;height:${logo.height}px;">`;
  const p = (style: string, html: string) => `<p style="margin:0;padding:0;${style}">${html}</p>`;
  const a = (href: string, label: string) => `<a href="${e(href)}" style="color:${link};text-decoration:none;">${e(label)}</a>`;

  const nameBlock = [
    p(`font-family:${head};font-size:17px;line-height:22px;font-weight:bold;color:${c.dark};`, e(t.name)),
    p(`font-family:${body};font-size:13px;line-height:18px;color:${c.mid};`, e(t.title)),
    p(`font-family:${body};font-size:13px;line-height:18px;font-weight:bold;color:${c.primaryText};padding-top:2px;`, e(co.name)),
  ].join("");

  const contact: string[] = [];
  const phone = co.phone.trim() ? formatPhone(co.phone) : "";
  const parts: string[] = [];
  if (phone) parts.push(`<span style="color:${c.mid};">${e(t.phone)}</span>&nbsp;${a(`tel:${phone.replace(/[^\d+]/g, "")}`, phone)}`);
  if (co.email.trim()) parts.push(`<span style="color:${c.mid};">Email</span>&nbsp;${a(`mailto:${co.email.trim()}`, co.email.trim())}`);
  if (parts.length) contact.push(p(`font-family:${body};font-size:12px;line-height:18px;color:${c.dark};`, parts.join(`<span style="color:${c.light};">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`)));
  if (co.address.trim()) contact.push(p(`font-family:${body};font-size:12px;line-height:18px;color:${c.mid};`, e(co.address.trim())));
  const socials = co.socials.filter((s) => s.handle.trim());
  if (socials.length) {
    contact.push(
      p(`font-family:${body};font-size:12px;line-height:18px;padding-top:4px;`, socials.map((s) => a(socialUrl(s), socialLine(s))).join(`<span style="color:${c.light};">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`)),
    );
  }
  if (!phone && !co.email.trim()) issues.push(kit.lang === "id" ? "Telepon dan email kosong: signature hanya berisi nama dan perusahaan." : "Phone and email are empty.");

  const table = (inner: string, extra = "") =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;${extra}">${inner}</table>`;

  let sig: string;
  if (!isB) {
    // Paket A: logo | garis warna utama | teks.
    sig = table(
      `<tr><td valign="middle" style="padding:0 16px 0 0;vertical-align:middle;">${img}</td>` +
        `<td style="width:3px;background:${c.primary};font-size:0;line-height:0;">&nbsp;</td>` +
        `<td valign="top" style="padding:0 0 0 16px;vertical-align:top;">${nameBlock}<div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>${contact.join("")}</td></tr>`,
      `max-width:${SIGNATURE_MAX_WIDTH}px;`,
    );
  } else {
    // Paket B: logo atas, nama, pita aksen, kontak.
    sig = table(
      `<tr><td style="padding:0 0 12px 0;">${img}</td></tr>` +
        `<tr><td style="padding:0;">${nameBlock}</td></tr>` +
        `<tr><td style="padding:10px 0 8px 0;">${table(`<tr><td style="width:48px;height:4px;background:${c.accent};font-size:0;line-height:0;">&nbsp;</td><td style="width:16px;height:4px;background:${c.primary};font-size:0;line-height:0;">&nbsp;</td></tr>`)}</td></tr>` +
        `<tr><td style="padding:0;">${contact.join("")}</td></tr>`,
      `max-width:${SIGNATURE_MAX_WIDTH}px;`,
    );
  }

  const guide =
    kit.lang === "id"
      ? [
          "Simpan file ini di folder yang sama dengan <b>logo-email.png</b>, lalu buka di browser.",
          "Ganti <b>Nama Lengkap</b> dan <b>Jabatan</b> setelah ditempel (atau sunting file ini dengan editor teks sebelum dibuka).",
          "Blok seluruh isi kotak di bawah, salin (Ctrl/Cmd + C), lalu tempel di pengaturan signature aplikasi email.",
          "<b>Outlook desktop dan Apple Mail:</b> logo ikut tertempel.",
          "<b>Gmail</b> (Setelan, Tanda tangan) dan <b>Outlook web</b>: bila logo tidak muncul, hapus gambar yang rusak lalu sisipkan <b>logo-email.png</b> lewat tombol Sisipkan gambar, Unggah.",
        ]
      : [
          "Keep this file in the same folder as <b>logo-email.png</b>, then open it in a browser.",
          "Replace <b>Full Name</b> and <b>Job Title</b> after pasting (or edit this file in a text editor first).",
          "Select everything inside the box below, copy (Ctrl/Cmd + C), and paste it into your email app's signature settings.",
          "<b>Outlook desktop and Apple Mail:</b> the logo is pasted along with the text.",
          "<b>Gmail</b> (Settings, Signature) and <b>Outlook on the web</b>: if the logo is missing, delete the broken image and insert <b>logo-email.png</b> with the Insert image, Upload button.",
        ];
  const title = `${co.name} - email signature ${kit.pkg}`;
  const html = `<!DOCTYPE html>
<html lang="${kit.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
</head>
<body style="margin:0;padding:24px;background:#F4F4F2;font-family:Arial, Helvetica, sans-serif;color:#333333;">
<div style="max-width:${SIGNATURE_MAX_WIDTH + 48}px;margin:0 auto;">
<ol style="margin:0 0 20px 0;padding-left:20px;font-size:13px;line-height:20px;">
${guide.map((g) => `<li>${g}</li>`).join("\n")}
</ol>
<div style="background:#FFFFFF;border:1px dashed #BBBBBB;padding:24px;">
<!-- signature: mulai -->
${sig}
<!-- signature: selesai -->
</div>
</div>
</body>
</html>
`;
  return { html, logo, issues };
}
