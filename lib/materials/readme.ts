import type { FontRef } from "@/lib/brand/font-select";
import { groupFolder, type GroupKey } from "./groups";
import type { Lang } from "./types";

/**
 * Tahap 6d: isi BACA-SAYA.txt / README.txt di setiap ZIP (SPEC bagian 9): tautan unduh font,
 * cara memakai tiap file, catatan CMYK. Teks biasa, mengikuti bahasa materi.
 */
export interface ReadmeInput {
  lang: Lang;
  company: string;
  pkg: string;
  fonts: { heading: FontRef; body: FontRef };
  groups: GroupKey[];
  availableUntil: string;
  pngLogo: boolean;
}

export const readmeName = (lang: Lang) => (lang === "en" ? "README.txt" : "BACA-SAYA.txt");

const fontUrl = (f: FontRef) => `https://fonts.google.com/specimen/${f.family.replace(/ /g, "+")}`;

const USE: Record<Lang, Record<GroupKey, string>> = {
  id: {
    guideline: "PDF panduan brand: logo, warna (HEX/RGB/CMYK), font, tone of voice.",
    businessCard: "SVG depan dan belakang (buka di Adobe Illustrator untuk mengedit) + PDF siap cetak 2 halaman. Ganti Nama Lengkap dan Jabatan.",
    letterhead: "DOCX untuk menulis surat di Microsoft Word (header dan footer otomatis di setiap halaman) + PDF/SVG kertas kop kosong untuk dicetak.",
    envelope: "SVG + PDF amplop DL (110 x 220 mm). Cek ukuran ke percetakan.",
    idCard: "ID card portrait dan landscape, SVG depan/belakang + PDF. Ganti nama, jabatan, nomor ID, dan foto.",
    presentation: "PPTX dengan warna dan font tema serta layout Judul, Bagian, Isi, Dua kolom, Penutup (Beranda > Tata Letak).",
    emailSignature: "Buka signature.html di browser (logo-email.png harus di folder yang sama), ikuti panduan di halamannya, lalu tempel ke Gmail/Outlook/Apple Mail.",
    stamp: "Cap satu warna, SVG + PDF. Ini desain, bukan stempel yang sah secara hukum.",
  },
  en: {
    guideline: "Brand guidelines PDF: logo, colors (HEX/RGB/CMYK), fonts, tone of voice.",
    businessCard: "Front and back SVG (open in Adobe Illustrator to edit) + 2-page print-ready PDF. Replace Full Name and Job Title.",
    letterhead: "DOCX for writing letters in Microsoft Word (header and footer on every page) + blank letterhead PDF/SVG for printing.",
    envelope: "DL envelope (110 x 220 mm) SVG + PDF. Check the size with your printer.",
    idCard: "Portrait and landscape ID cards, front/back SVG + PDF. Replace the name, job title, ID number, and photo.",
    presentation: "PPTX with theme colors and fonts and Title, Section, Content, Two columns, Closing layouts (Home > Layout).",
    emailSignature: "Open signature.html in a browser (keep logo-email.png in the same folder), follow the guide on the page, then paste into Gmail/Outlook/Apple Mail.",
    stamp: "One-color stamp, SVG + PDF. This is a design, not a legally valid seal.",
  },
};

export function readme(i: ReadmeInput): string {
  const id = i.lang === "id";
  const L: string[] = [];
  const h = (t: string) => L.push("", t.toUpperCase(), "-".repeat(t.length));
  L.push(`${i.company} - ${id ? "Brand Package, Paket" : "Brand Package, Package"} ${i.pkg}`);
  L.push(id ? `Dibuat oleh Brand Package Automation. File tersedia untuk diunduh ulang hingga ${i.availableUntil}.` : `Made with Brand Package Automation. Files can be downloaded again until ${i.availableUntil}.`);

  h(id ? "1. Pasang font dulu" : "1. Install the fonts first");
  L.push(
    id
      ? "File SVG, DOCX, dan PPTX memakai teks hidup (bisa diedit). Agar tampil benar, pasang font Google berikut di komputer sebelum membuka file:"
      : "The SVG, DOCX, and PPTX files use live (editable) text. To display correctly, install the following Google fonts before opening the files:",
  );
  L.push(`- ${id ? "Judul" : "Headings"}: ${i.fonts.heading.family}  ${fontUrl(i.fonts.heading)}`);
  if (i.fonts.body.family !== i.fonts.heading.family) L.push(`- ${id ? "Teks isi" : "Body text"}: ${i.fonts.body.family}  ${fontUrl(i.fonts.body)}`);
  L.push(id ? "Klik \"Get font\" lalu \"Download all\", ekstrak, dan pasang file .ttf (Mac: Font Book; Windows: klik kanan > Install)." : "Click \"Get font\" then \"Download all\", unzip, and install the .ttf files (Mac: Font Book; Windows: right-click > Install).");
  L.push(id ? "PDF sudah menyertakan font, jadi PDF bisa langsung dicetak tanpa memasang font." : "PDFs embed the fonts, so they can be printed without installing anything.");

  h(id ? "2. Isi paket ini" : "2. What is in this package");
  for (const g of i.groups) L.push(`- ${groupFolder(i.lang, g)}: ${USE[i.lang][g]}`);

  h(id ? "3. Catatan cetak" : "3. Printing notes");
  L.push(
    ...(id
      ? [
          "- File cetak memakai bleed 3 mm dan area aman 4 mm. Ukuran adalah ukuran umum; konfirmasi ke percetakan.",
          "- File SVG hanya RGB. Kode CMYK di guideline adalah hasil konversi dan hanya acuan: minta proof cetak sebelum mencetak banyak.",
          "- Mengedit PDF di Illustrator: gunakan File > Open (bukan File > Place).",
        ]
      : [
          "- Print files use a 3 mm bleed and a 4 mm safe area. Sizes are common sizes; confirm with your printer.",
          "- SVG files are RGB only. CMYK values in the guidelines are calculated references: ask for a print proof before a large run.",
          "- To edit a PDF in Illustrator, use File > Open (not File > Place).",
        ]),
  );
  if (i.pngLogo)
    L.push(
      id
        ? "- Logo diunggah sebagai PNG, jadi logo di materi berupa gambar raster. Untuk hasil paling tajam, ganti logo di file SVG dengan versi vektor (SVG/AI) dari desainer."
        : "- The logo was uploaded as a PNG, so it is a raster image in the materials. For the sharpest print, replace it in the SVG files with a vector version (SVG/AI).",
    );
  L.push("");
  return L.join("\r\n");
}
