import { Resvg } from "@resvg/resvg-js";
import { escapeXml } from "./escape";

/**
 * SVG contoh untuk uji render Tahap 1: kartu nama depan 90 x 55 mm + bleed 3 mm.
 * Satuan viewBox = mm. Menguji: teks hidup 2 family (statis + variable), bold,
 * text-anchor, letter-spacing, gradien, path vektor, gambar PNG tertanam,
 * karakter khusus yang di-escape, dan grup ber-id (layer di Illustrator).
 */
export const SAMPLE_SIZE = { widthMm: 96, heightMm: 61, bleedMm: 3 };

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
<circle cx="100" cy="100" r="90" fill="#0E5A8A"/><path d="M60 140 L100 50 L140 140 Z" fill="#F2B134"/></svg>`;

/** Logo raster (PNG) untuk menguji gambar tertanam, seperti logo PNG unggahan user. */
export function sampleLogoPng(): Buffer {
  return new Resvg(LOGO_SVG, { fitTo: { mode: "width", value: 400 }, background: "rgba(0,0,0,0)" })
    .render()
    .asPng();
}

export function sampleBusinessCardSvg(data = {
  company: "PT Contoh Sejahtera & Mitra <Uji>",
  name: "Nama Lengkap",
  title: "Jabatan",
  phone: "Telp +62 21 1234 5678",
  email: "halo@contoh.co.id",
  address: "Jl. Jend. Sudirman Kav. 52–53, Jakarta Selatan 12190",
}): string {
  const { widthMm: W, heightMm: H, bleedMm: B } = SAMPLE_SIZE;
  const logo = sampleLogoPng().toString("base64");
  const e = escapeXml;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="aksen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0E5A8A"/>
      <stop offset="1" stop-color="#3FA7D6"/>
    </linearGradient>
  </defs>
  <g id="latar">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/>
    <rect x="0" y="${H - B - 8}" width="${W}" height="${B + 8}" fill="url(#aksen)"/>
    <path id="ornamen" d="M${W - 18} 0 C ${W - 12} 7, ${W - 5} 8, ${W} 6 L ${W} 0 Z" fill="#F2B134" opacity="0.85"/>
  </g>
  <g id="logo">
    <image x="${B + 4}" y="${B + 4}" width="12" height="12" xlink:href="data:image/png;base64,${logo}"/>
  </g>
  <g id="teks">
    <text id="perusahaan" x="${B + 19}" y="${B + 9}" font-family="Playfair Display" font-size="3.6" fill="#0E2A3F">${e(data.company)}</text>
    <text id="nama" x="${B + 4}" y="${B + 27}" font-family="Lato" font-weight="bold" font-size="4.2" fill="#0E2A3F">${e(data.name)}</text>
    <text id="jabatan" x="${B + 4}" y="${B + 31.5}" font-family="Lato" font-size="2.6" letter-spacing="0.3" fill="#3A4A57">${e(data.title.toUpperCase())}</text>
    <text id="telepon" x="${W - B - 4}" y="${B + 27}" text-anchor="end" font-family="Lato" font-size="2.4" fill="#0E2A3F">${e(data.phone)}</text>
    <text id="email" x="${W - B - 4}" y="${B + 30.5}" text-anchor="end" font-family="Lato" font-size="2.4" fill="#0E2A3F">${e(data.email)}</text>
    <text id="alamat" x="${B + 4}" y="${H - B - 3}" font-family="Lato" font-size="2.2" fill="#FFFFFF">${e(data.address)}</text>
  </g>
  <g id="panduan" display="none">
    <rect x="${B}" y="${B}" width="${W - 2 * B}" height="${H - 2 * B}" fill="none" stroke="#FF00FF" stroke-width="0.1"/>
  </g>
</svg>`;
}
