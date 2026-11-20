# Changelog

## Belum dirilis
- Tahap 4c: cap perusahaan satu warna (warna utama gelap), tanpa ornamen dan teks: model 1 (Paket A) logo saja, model 2 (Paket B) logo di dalam satu lingkaran Ø 40 mm. Logo SVG tetap vektor, PNG satu warna.
- Tahap 4b: ID card portrait dan landscape (depan/belakang, area lubang tali dicek otomatis) dan amplop DL, Paket A dan B. Lab membuat semua materi sekaligus dengan tab per materi. Modul `svgdoc.ts` (kerangka SVG cetak) dan `types.ts` (tipe materi untuk klien).
- Tahap 4a: fondasi materi (`lib/materials/`: kit, ukur/bungkus teks, logo vektor bersarang, pengecekan otomatis area aman/tabrakan/kontras), kartu nama Paket A dan B (SVG depan/belakang + PDF 2 halaman + pratinjau), panel materi di Lab, unduhan bernama `<Perusahaan>_<file>`. Detail: `docs/materials.md`.
- Font: nama family/style di dalam file ditulis ulang sesuai katalog (PDF menyebut font yang benar).
- Tahap 3e: pemetaan bidang usaha ke karakter font dan nada dasar (`data/industries.json`), tag bidang usaha ikut menyusun shortlist font, tone of voice Paket A/B (Indonesia + Inggris) ditulis sesi pekerja (`npm run worker -- tone`) dan tampil di Lab. Lab: isi bebas untuk bidang usaha "Lainnya".
- Font: Paket B wajib beda karakter dari Paket A (kategori atau gaya heading berbeda, tanpa font yang sama). Shortlist menambah maks. 6 kandidat kontras berlabel di lembar spesimen; `npm run worker -- pick` menolak pilihan yang melanggar.
- Sesi pekerja Claude (tanpa API key): job di Upstash, bel komentar di PR #1, skrip `npm run worker` (begin/traits/pick/fail), runbook `docs/worker.md`. Lab 3d mengirim job dan memantau status tiap 5 detik. Jalur Claude API dihapus.
- Google Drive: hubungkan dari Admin (OAuth `drive.file`, token terenkripsi di Upstash), logo dan lembar spesimen disimpan per job, pembersihan harian folder > 90 hari (`/api/cron/cleanup`, Vercel Cron). Halaman publik `/privacy`.
- Form Lab tidak lagi direset setelah dikirim (logo, nama perusahaan, bidang usaha tetap terisi).
- SPEC: engine Claude lewat sesi pekerja berlangganan (tanpa API key), penyimpanan Google Drive pemilik, masa simpan 90 hari, paket tidak dipilih langsung dihapus, ZIP dibuat saat unduh, halaman Riwayat. PR saluran kontrol #1. Batas logo 4 MB.
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
