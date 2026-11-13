# Changelog

## Belum dirilis
- Perbaikan upload logo: file tetap terpilih setelah tombol diklik (sebelumnya klik kedua menghasilkan "Pilih file logo terlebih dulu").
- Tahap 3d: analisis logo oleh Claude (karakter visual -> kriteria font), shortlist 20-30 font dari metadata katalog, lembar spesimen dirender dengan font asli, Claude memilih pasangan heading + teks isi untuk Paket A dan B; tampil di Lab dengan biaya per percobaan. Panduan API key dan model: `docs/claude.md`.
- Tahap 3c: daftar 324 font Google terkurasi (`data/fonts/families.txt`), skrip `npm run fonts:build` (Regular/Bold statis dari variable font, dipangkas ke Latin, lisensi OFL/Apache, tag karakter Google Fonts), katalog `data/fonts/catalog.json`, halaman tinjauan `/admin/lab/font` dengan tombol tandai untuk dibuang.
- Upload logo: drag & drop dan tempel dari clipboard (Cmd/Ctrl + V, gambar atau teks SVG), thumbnail, tombol Ganti/Hapus, pengecekan awal di browser; komponen `app/_components/logo-dropzone.tsx` dipakai ulang di Tahap 4.
- Tahap 3b: palet warna dari logo (k-means OKLab), warna utama + versi teks, aksen Paket A (warna logo/analogus) dan Paket B (komplementer terbelah), netral, HEX/RGB/CMYK, pasangan kontras WCAG; tampil di Lab.
- Login adaptif: pas di layar tanpa scroll (HP sampai desktop), ukuran mengecil proporsional di layar pendek.
- Tahap 3a: katalog spesifikasi (`data/specs.json`), daftar bidang usaha, sanitasi SVG, pengecekan logo (resolusi, transparansi, keterbacaan di latar gelap/terang, varian satu warna), halaman `/admin/lab`. SPEC: visual AI memakai Claude (SVG).
- Tampilan aplikasi mengikuti IGLO Brand Center (warna, tipografi, komponen); logo IGLO hi-res.
- Tahap 2 (login dan super admin): login email + password (argon2id), sesi 12 jam bertanda tangan, pembatasan percobaan login, halaman admin (tambah, nonaktifkan, ganti password, hapus user), skrip `admin:set-password`, versi di halaman login. Detail: `docs/auth.md`.
- Region fungsi Vercel `sin1`; Node.js dikunci ke 26.x (`engines`, `.nvmrc`).
- Tahap 1 (uji render): SVG -> PDF (PDFKit + svg-to-pdfkit) dan PNG (resvg) tanpa browser; route uji `/api/render-test`; font uji Lato dan Playfair Display. Detail: `docs/render.md`. Teks PDF digabung per baris. Deploy preview manual via CLI (`FORCE_BUILD=1`), `.vercelignore`.
- Tahap 0 (fondasi): Next.js + TypeScript, mekanisme versi, Upstash satu database dengan prefiks `bpa:dev:` / `bpa:prod:`, Vercel hanya membangun `main`.
