# Render: SVG -> PDF / PNG tanpa browser (Tahap 1)

Pilihan 1 dari SPEC bagian 8 (PDF dari SVG tanpa browser).

| Kebutuhan | Pustaka | Catatan |
|---|---|---|
| SVG -> PDF vektor | `pdfkit` + `svg-to-pdfkit` | Teks tetap teks; font TTF di-embed sebagai subset. |
| SVG -> PNG preview | `@resvg/resvg-js` | Binary native (prebuilt untuk macOS arm64 dan Linux x64). Hanya memakai font yang diberikan, bukan font sistem. |

Kode: `lib/render/svg.ts`. Uji lokal: `npm run render:test` (hasil di `out/render-test/`, tidak di-commit). Uji server: `GET /api/render-test` (JSON), `?format=pdf|png|svg`.

## Hasil uji lokal (2026-11-10, Linux x64, Node 22)

- Kartu nama 96 x 61 mm (90 x 55 + bleed 3 mm): PDF ±27 KB dalam ±100-200 ms, PNG 1200 px dalam ±30-40 ms.
- Ukuran halaman PDF tepat 272,13 x 172,91 pt. Tiga font ter-embed (Lato Regular, Lato Bold, Playfair Display), teks bisa dipilih/disalin.
- Diuji: teks hidup, bold, `text-anchor="end"`, `letter-spacing`, gradien linear, path, opacity, PNG tertanam (logo), karakter `& < >` yang di-escape, grup ber-`id`.
- Render PDF dan PNG terlihat sama.
- Bundle fungsi `/api/render-test`: ±20 MB (termasuk resvg linux gnu + musl 2 x 4,4 MB). Jauh di bawah batas 250 MB.

## Aturan untuk template SVG (Tahap 4)

- Bold ditulis `font-weight="bold"`, bukan angka (`700`): svg-to-pdfkit hanya mengenali kata `bold`.
- `font-family` cukup satu nama family yang terdaftar; fallback memberi peringatan dan memakai Helvetica.
- Variable font: PDFKit dan resvg hanya memakai **instance default**. Untuk Bold dll., skrip font Tahap 3 perlu membuat file statis (Regular/Bold) dari variable font (mis. `fontTools.varLib.instancer`).
- Satuan viewBox = mm; ukuran halaman PDF diberikan dalam mm saat render.

## Belum diuji

- Di Vercel sungguhan (butuh satu kali deploy atas izin pemilik).
- Buka SVG di Illustrator (pemilik).
