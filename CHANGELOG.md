# Changelog

## Belum dirilis

## 1.1 · 2026-11-25
- Vercel: push ke branch selain `main` tidak lagi membuat deployment (`git.deploymentEnabled` di `vercel.json`), sehingga tidak memakai kuota harian Hobby; `ignoreCommand` tetap sebagai pengaman kedua.
- Admin: status cron pembersihan harian (normal, gagal, terlambat bila run terakhir lebih dari 26 jam lalu, atau belum tercatat) dan tabel 7 run terakhir (waktu WIB, folder dihapus dev/prod, sesi dirapikan, durasi, galat). Riwayat disimpan di kunci bersama `bpa:shared:cron:cleanup`, jadi tampil di Admin lokal maupun production. Cron mengembalikan status 500 bila gagal.
- Dokumen: SPEC bagian 8 dikoreksi ke Vercel Hobby; temuan `npm audit` `image-size` ditinjau ulang (risiko tetap diterima).

## 1.0 · 2026-11-23
Rilis pertama ke production (push pertama ke `main`).
- Halaman login menampilkan "(lokal)" di samping versi saat berjalan di lokal/dev.
- Tahap 8 (persiapan rilis 1.0): rate limit endpoint generate (10 brand package baru dan 10 kali buat ulang materi per jam per user), tes unit penghapusan 90 hari, pemakaian, dan aturan versi; daftar periksa rilis `docs/release.md`.
- Tahap 7: penghitung pemakaian (total, per user, per sesi, per bulan) dan rekap di halaman Admin; data job di Upstash kedaluwarsa tepat 90 hari sejak dibuat (sebelumnya terhitung ulang tiap kali job disimpan); cron harian juga merapikan indeks sesi.
- Tahap 6d: unduh paket terpilih (semua, per materi, checklist) sebagai ZIP yang dialirkan saat diunduh dengan struktur folder SPEC dan BACA-SAYA/README; halaman Riwayat; tautan Buat baru dan Riwayat di header; header rapi di layar sempit.
- Tahap 6c: tab Ringkasan (font, warna, tone per paket), pratinjau email signature, ubah data kontak sebelum memilih (materi dibuat ulang), pilih Paket A/B dengan konfirmasi, file paket lain langsung dihapus dari Drive.
- Tahap 6b: materi dibuat otomatis di halaman hasil setelah pekerja selesai: 18 tugas (materi × paket) paralel dengan progres per materi, hasil per tugas di Upstash, ulang tugas yang gagal; hasil Paket A dan B berdampingan per materi; catatan bila visual dekoratif tidak tersedia.
- Tahap 6a: form brand package 3 langkah di beranda (logo + cek logo, nama, bidang usaha; email, alamat dan telepon bertanda utama, sosial media; ringkasan + visual dekoratif opsional), tombol bahasa ID/EN di header (antarmuka dan bahasa materi), halaman status `/hasil/<id>`. Alamat/telepon tambahan di footer kop surat. Pekerja langsung membuat visual setelah tone bila diminta.
- Tahap 5: visual dekoratif SVG per paket dari sesi pekerja Claude (perintah `visual-begin/check/save/fail`, bel `🛎️ visual`), validator (palet paket, tanpa teks/gambar/script/filter, maks. 150 KB, maks. 3 penolakan), cache 90 hari, panel di Lab; dipakai di belakang kartu nama dan ID card, sampul dan penutup PPT, sampul guideline.
- Tahap 4g: guideline PDF Paket A dan B (6 halaman: sampul, logo, warna, tipografi, tone of voice, contoh kalimat dan catatan), pratinjau di Lab.
- Tahap 4f: email signature HTML Paket A dan B (tabel + gaya inline, lebar maks. 600 px, font cadangan web-safe), logo PNG 2x sebagai file terpisah, unduhan ZIP dibuat saat diunduh, pratinjau di Lab.
- Tahap 4e: template PPT 16:9 Paket A dan B: theme asli (warna dan font tema brand), slide master dengan layout Judul/Bagian/Isi/Dua kolom/Penutup berlogo, 5 slide contoh, pratinjau. Pustaka `pptxgenjs` 4.0.1 dan `jszip` 3.10.2.
- Tahap 4d: kop surat Paket A dan B: DOCX dengan header/footer asli Word, gaya paragraf berfont dan berwarna brand, kerangka surat berplaceholder (Indonesia/Inggris); PDF kertas kop untuk dicetak. Pustaka `docx` 9.15.3.
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
