# Handover: Brand Package Automation versi 1.1

Ringkasan lengkap kondisi aplikasi setelah rilis 1.1, untuk melanjutkan pembahasan di sesi Claude Code yang baru tanpa riwayat chat. Dokumen ini **melengkapi**, bukan menggantikan, dokumen lain; untuk detail selalu rujuk:

| Dokumen | Isi |
|---|---|
| [`SPEC.md`](SPEC.md) | Sumber kebenaran: kebutuhan, aturan, roadmap, keputusan (bagian 18) |
| [`materials.md`](materials.md) | Cara tiap materi dibuat (Tahap 4-6) |
| [`brand.md`](brand.md) | Mesin brand: logo, palet, font, tone (Tahap 3) |
| [`worker.md`](worker.md) | Runbook sesi pekerja Claude |
| [`release.md`](release.md) | Daftar periksa rilis dan setelah deploy |
| [`auth.md`](auth.md), [`render.md`](render.md) | Login/admin (Tahap 2), uji render (Tahap 1) |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Perubahan per tahap dan per rilis |

Ditulis 2026-11-24, diperbarui 2026-11-26 setelah rilis 1.1.

## 1. Status saat ini

- **Versi 1.1 berjalan normal di production**: `https://automatebrandpackage.vercel.app`. Dirilis dan deploy berhasil 2026-11-25. Versi 1.0 dirilis 2026-11-23 (deploy 2026-11-24).
- Branch `main` = commit `31ed3b2` ("Rilis 1.1"), sama dengan `dev` saat rilis.
- Isi 1.1: push ke branch selain `main` tidak lagi membuat deployment Vercel (`git.deploymentEnabled`, terverifikasi); status cron pembersihan + riwayat 7 run di Admin (run pertama di production 2026-11-26 03.01 WIB berhasil, dicek pemilik); `npm audit` ditinjau ulang.
- Diuji pemilik: SVG di Illustrator (editable), PDF lewat File > Open, DOCX di Word, PPTX di PowerPoint, email signature di klien email, visual dekoratif di Illustrator, alur form sampai unduhan, Riwayat, Pemakaian, lalu di production: login super admin, Google Drive terhubung, bel pekerja aktif, alur brand package berjalan normal.
- Tes otomatis: 120 tes (`npm test`), typecheck, lint, dan `npm run build` lolos.
- **Cara kerja ke depan (keputusan pemilik 2026-11-24)**: develop dan uji di **lokal**; deploy ke Vercel (push ke `main`) hanya bila di lokal sudah sesuai dan pemilik memerintahkan.

## 2. Gambaran aplikasi

Web app internal (prototype, dipakai pemilik dan tim) yang membuat **brand package** dari logo + data perusahaan: dua paket berbeda (A dan B) untuk dibandingkan, dipilih satu, lalu diunduh.

### Alur user
1. **Beranda `/`**: form 3 langkah. (1) logo + cek logo (peringatan, bukan penolakan), nama perusahaan, bidang usaha (20 pilihan, "Lainnya" + teks). (2) email, alamat dan telepon (maks. 3, tepat satu "Utama"; yang lain hanya di footer kop surat, maks. 2), 7 sosial media opsional. (3) ringkasan + kotak centang **visual dekoratif** (bawaan tidak dicentang).
2. **Halaman hasil `/hasil/<id>`**: status pekerja Claude (font + tone, lalu visual bila diminta) → materi dibuat otomatis (18 tugas = 9 materi × 2 paket, 4 paralel, progres per materi, ulang yang gagal) → perbandingan A/B (tab Ringkasan: font, warna, tone; tab per materi; pratinjau email signature) → **Ubah data kontak** (sebelum memilih; materi dibuat ulang tanpa pekerja) → **Pilih Paket A/B** dengan konfirmasi (paket lain langsung dihapus dari Drive) → **unduh**: semua (ZIP), per materi (ZIP kecil), checklist 2-7 materi (`..._Pilihan.zip`). ZIP dibuat saat diunduh (streaming), tidak disimpan, selalu berisi `BACA-SAYA.txt` / `README.txt`.
3. **Riwayat `/riwayat`**: user melihat miliknya, super admin melihat semua; status, tanggal dibuat, tersedia hingga (90 hari).
4. Tombol bahasa **ID/EN** di header: antarmuka + bahasa materi. Data perusahaan tidak diterjemahkan.

### Super admin
- **Admin `/admin`**: status Google Drive (hubungkan/ulang), status bel pekerja + antrean, **pembersihan otomatis** (status: normal, gagal, terlambat > 26 jam, belum tercatat; tabel 7 run terakhir dari kunci bersama `bpa:shared:cron:cleanup`, jadi tampil juga di lokal), kelola user, **Pemakaian** (per user + total, per bulan WIB, 30 sesi login terbaru; tanpa biaya token).
- **Lab `/admin/lab`**: alat uji tiap tahap (cek logo/palet, kirim job font, visual dekoratif, materi dengan data contoh). Tidak dibatasi rate limit.
- Halaman login menampilkan versi (sekarang "Version 1.1"), ditambah "(lokal)" saat berjalan di lokal/dev.

### Materi per paket
| Materi | Format | Catatan |
|---|---|---|
| Guideline | PDF A4 6 halaman | sampul, logo (area bebas, ukuran minimum), warna HEX/RGB/CMYK + kontras, tipografi + tautan unduh, tone of voice, contoh kalimat + catatan |
| Kartu nama | SVG depan/belakang + PDF | 90 × 55 mm, bleed 3 mm, safe 4 mm |
| ID card | portrait + landscape, SVG + PDF | CR80, area lubang tali dicek |
| Amplop | SVG + PDF | DL 110 × 220 mm |
| Cap | SVG + PDF | satu warna, logo saja; A: logo 40 mm, B: logo dalam lingkaran Ø 40 mm |
| Kop surat | DOCX + PDF/SVG | header/footer asli Word |
| Template PPT | PPTX | theme asli (warna + font tema), 5 layout + slide contoh |
| Email signature | HTML + `logo-email.png` | tabel inline, font cadangan web-safe |

Paket A: selaras logo, harmoni analogus. Paket B: wajib beda karakter (font heading beda kategori/gaya), komplementer terbelah, tone bernuansa lain.

## 3. Arsitektur dan infrastruktur

- **Kode**: Next.js 16.4.6 (App Router, Turbopack), TypeScript, Node 26.x. Pustaka render: sharp, resvg, PDFKit + svg-to-pdfkit, fontkit, docx 9.15.3, pptxgenjs 4.0.1, jszip 3.10.2. Font: 324 family Google terkurasi di `fonts/lib` (dibuat `npm run fonts:build`).
- **Repo GitHub**: `marketingbrandingiglo/BrandPackageMat_DB` (publik). Branch: `main` (production), `dev` (kerja), `bpa/control-channel` (PR #1, saluran bel pekerja; jangan di-merge/ditutup), `claude/tahap-0-fondasi-pjdg6o` (salinan `dev` dari sesi Claude Code sebelumnya; bukan branch production lagi).
- **Vercel**: project `automatebrandpackage`, paket **Hobby** (keputusan pemilik), region `sin1`. Production Branch Tracking = **`main`**. `vercel.json`: deployment hanya untuk `main` (`git.deploymentEnabled`, mulai 1.1; `ignoreCommand` sebagai pengaman kedua), cron harian `/api/cron/cleanup` (19.30 UTC, Hobby ±59 menit). Batas Hobby: fungsi maks. 300 detik (aplikasi memakai 300), **maks. 100 deployment per hari per akun** (akun dipakai banyak project lain).
- **Upstash Redis**: satu database untuk dev **dan** prod (database `codia-fix-users` di akun Personal Upstash pemilik, cabang `main`), dipisah awalan kunci `bpa:dev:` / `bpa:prod:`; dipakai juga aplikasi lain dengan awalan sendiri dan **token yang sama**. Kunci bersama: `bpa:shared:drive:*` (token Drive terenkripsi, dipakai dev dan prod).
  - Catatan: integrasi Upstash di Vercel sempat menghubungkan project ke database **lain** yang juga bernama `codia-fix-users` (dikelola lewat Vercel, berisi data `codia:*` milik project `codiafixgenerator`). Sambungan itu **sudah dilepas** dari project ini (2026-11-23); jangan disambungkan lagi. Env var Upstash di Vercel diisi manual dengan nilai yang sama dengan `.env.local`.
- **Google Drive**: akun Gmail pribadi pemilik (paket 400 GB). Folder `Brand Package Automation > dev|prod > <ID job>`. OAuth scope `drive.file`, app "In production". Redirect URI: `http://localhost:3000/api/drive/callback` dan `https://automatebrandpackage.vercel.app/api/drive/callback`.
- **Sesi pekerja Claude** (langganan, tanpa API key): environment claude.ai/code **"BPA Pekerja"**, model Opus, memantau PR #1. Bel: komentar `🛎️ job <env>/<id>` atau `🛎️ visual <env>/<id>` (berisi ID saja). Satu sesi melayani dev dan prod. Runbook: `worker.md`; perintah `npm run worker -- status|pending|begin|traits|pick|tone|visual-begin|visual-check|visual-save|visual-fail|fail`. `begin` menolak jalan bila kode tertinggal dari `origin/dev`.
- **Masa simpan**: 90 hari. Data job di Upstash kedaluwarsa tepat 90 hari sejak dibuat; folder Drive dihapus cron harian; paket yang tidak dipilih langsung dihapus saat memilih.

### Env var (nama saja; nilai tidak pernah ditulis di repo/chat)
| Variabel | Lokal (`.env.local`) | Vercel Production | Sesi pekerja |
|---|---|---|---|
| Upstash URL/token | `UPSTASH_REDIS_REST_URL/TOKEN` | `KV_REST_API_URL/TOKEN` (manual) | `KV_REST_API_URL/TOKEN` |
| `SESSION_SECRET` | ya (nilai lokal) | ya (nilai **berbeda**) | - |
| `GITHUB_TOKEN`, `CONTROL_PR` (+ `GITHUB_REPO`) | ya | ya | - |
| `GOOGLE_CLIENT_ID/SECRET` | ya | ya | ya |
| `DRIVE_TOKEN_SECRET` | ya | ya (**sama**) | ya (**sama**) |
| `CRON_SECRET` | - | ya | - |
| `APP_ENV` | `development` | jangan diisi | - |

Aplikasi menerima nama `KV_REST_API_*` atau `UPSTASH_REDIS_REST_*`.

## 4. Riwayat tahap dan keputusan penting

Rincian lengkap: SPEC bagian 18 dan CHANGELOG. Ringkasnya:

- **Tahap 0-2**: fondasi, uji render PDF dari SVG tanpa browser (lolos di Vercel), login buatan sendiri (argon2id, sesi 12 jam, rate limit login), halaman admin.
- **Tahap 3 (mesin brand)**: cek logo + sanitasi SVG; palet k-means OKLab (A analogus, B komplementer terbelah, CMYK hanya acuan); 324 font terkurasi; seleksi font dua tahap (shortlist dari metadata, Claude memilih dari lembar spesimen; Paket B wajib beda karakter); pemetaan 19 bidang usaha; tone of voice ID + EN.
- **Engine Claude (2026-11-19)**: sesi pekerja berlangganan, **tanpa API key**; jalur API dihapus. Penyimpanan Google Drive (Vercel Blob penuh). Masa simpan 90 hari.
- **Tahap 4 (materi)**: 4a kartu nama, 4b ID card + amplop, 4c cap (revisi: tanpa teks/ornamen), 4d kop surat, 4e PPT, 4f email signature (logo file terpisah), 4g guideline.
- **Tahap 5**: visual dekoratif SVG per paket oleh pekerja Claude; validator (palet paket, tanpa teks/gambar/script/filter, maks. 150 KB, maks. 3 penolakan); cache 90 hari; dipakai di belakang kartu nama/ID card, sampul + penutup PPT, sampul guideline.
- **Tahap 6**: 6a form + bahasa, 6b materi otomatis per tugas (hasil per tugas di hash Upstash `job:<id>:mat`), 6c bandingkan/ubah kontak/pilih, 6d unduh + Riwayat.
- **Tahap 7**: penghitung pemakaian (`lib/usage.ts`), rekap Admin, kedaluwarsa job absolut 90 hari.
- **Tahap 8 / rilis**: rate limit generate (10 job baru dan 10 buat ulang materi per jam per user), tes unit (90 hari, pemakaian, versi), `release.md`. Keputusan pemilik: **reset token Upstash dilewati** (database dipakai bersama aplikasi lain; token tidak tersebar), **tetap Vercel Hobby**, label "(lokal)" pada versi.
- **Versi 1.1 (2026-11-25)**: `git.deploymentEnabled` di `vercel.json` (`"**": false, "main": true`; `ignoreCommand` tetap sebagai pengaman kedua), status cron di Admin (`lib/cron.ts`, `app/admin/cron-status.tsx`; cron membalas 500 bila gagal), SPEC bagian 8 dikoreksi ke Hobby, audit ditinjau ulang.

## 5. Aturan kerja (dari CLAUDE.md dan SPEC)

- Dokumen berbahasa Indonesia; istilah teknis Inggris.
- Kerjakan per tahap/bagian, laporkan, **tunggu pemilik menguji**; jangan lanjut tanpa perintah. Bila pemilik bilang "pahami dulu, jangan dieksekusi", cukup jelaskan.
- Hal yang belum diputuskan: ajukan usulan dengan pilihan (a/b/c), jangan putuskan sendiri.
- **Rahasia tidak pernah** masuk repo, log, atau chat; jangan minta pemilik menempel nilai rahasia.
- **Push ke `main` hanya atas perintah pemilik.** Prosedur: fetch; pull `main` bila ada perubahan; gabungkan `dev` ke `main`; `npm run version:bump -- [minor|major]` (minor default; major untuk perubahan alur) dan commit; push `main`; laporkan versi dan alasannya. Setelah push, cek deployment Production di Vercel.
- Kerja harian: commit di `dev`, push ke `dev` (keputusan pemilik 2026-11-25: push hanya ke `dev`; `main` hanya atas perintah). Sejak 1.1 push ke `dev` **tidak** membuat deployment Vercel, jadi tidak memakai kuota; hanya push ke `main` yang memakai 1 deployment. Branch lama (`claude/*`, `bpa/control-channel`) masih memakai `vercel.json` lama; dibiarkan (keputusan pemilik), jangan push ke sana.
- Commit diakhiri trailer `Co-Authored-By` dan `Claude-Session` (lihat commit sebelumnya); tanpa ID model di artefak repo.
- Sesi pekerja perlu `git pull origin dev` dan membaca ulang `worker.md` setiap kali runbook berubah; pemilik meneruskan pesan itu ke chat pekerja.

## 6. Masalah yang pernah terjadi dan solusinya

| Masalah | Penyebab | Solusi |
|---|---|---|
| Pekerja menjalankan kode lama (tanpa tone, aturan Paket B) | sesi pekerja belum `git pull` | `ensureLatestCode` di `begin`; pemilik menyuruh pekerja pull + baca ulang runbook |
| Pekerja gagal: `VISUAL_MAX_ATTEMPTS` tidak ditemukan | `export *` tidak terbaca saat dijalankan `tsx` | ekspor eksplisit; skrip pekerja diuji langsung dengan `tsx` |
| Guideline "Gagal" di production lokal pemilik | dugaan: Google Drive membatasi unggahan paralel | ulang otomatis untuk 429/5xx/rate limit Drive; galat tiap tugas ditampilkan; tombol coba lagi |
| Peringatan React "two children with the same key" | peringatan PDF yang sama per halaman | peringatan digabung, key unik |
| `git pull` ditolak di Mac | `package-lock.json` berubah lokal | `git restore package-lock.json`, pull, `npm install` |
| Vercel production memakai database Upstash lain | integrasi Upstash Vercel | sambungan dilepas, env var diisi manual |
| Branch Tracking `main` ditolak | branch `main` belum ada | `main` dibuat saat rilis 1.0 |
| Deploy ditolak "api-deployments-free-per-day" | Hobby maks. 100 deployment/hari per akun, banyak project + push `dev`/branch kerja | tunggu 24 jam; diperbaiki di 1.1 (`git.deploymentEnabled`) |
| PDF tidak bisa diedit di Illustrator | dibuka lewat File > Place | buka lewat File > Open (dicatat di BACA-SAYA) |

## 7. Hal yang masih terbuka dan usulan berikutnya

Selesai di 1.1: kuota deployment (`git.deploymentEnabled`), pemantauan cron pembersihan (berjalan normal di production), tinjauan `npm audit`.

1. **Cron pembersihan**: pantau lewat Admin. Kuning = run terakhir lebih dari 26 jam lalu (cek Vercel > Settings > Cron Jobs dan Logs); merah = gagal (pesan galat tampil, mis. Drive terputus).
2. **Branch lama di remote** (`claude/hopeful-cannon-nq25qs`, `claude/tahap-0-fondasi-pjdg6o`): dibiarkan atas keputusan pemilik; masih memakai `vercel.json` lama, jadi push ke sana memakai kuota.
3. **`npm audit`**: 2 temuan high di `image-size` (lewat `pptxgenjs` 4.0.1), dinilai tidak terjangkau, diterima sebagai risiko (ditinjau ulang 2026-11-25); tinjau lagi saat `pptxgenjs` merilis versi baru.
4. **SPEC 17 yang masih terbuka**: spesifikasi cetak (ukuran amplop, bleed, safe area) belum diverifikasi ke vendor; ambang peringatan resolusi logo (sekarang < 800 px peringatan, < 400 px keras) belum dikonfirmasi; butir harga token dan kurs tidak relevan selama memakai sesi pekerja.
5. **Fitur opsional SPEC yang belum dibuat**: perbaikan logo oleh AI (upscale, hapus latar, vektorisasi; hanya dengan persetujuan user); bundel file font di ZIP; pilihan/koreksi warna utama oleh user.
6. **Ditunda pemilik**: reset token Upstash (cara: `release.md` bagian C.1; ingat database dipakai aplikasi lain); pindah ke Vercel Pro bila pemakaian bertambah atau dipakai lebih luas; bila aplikasi dibuka untuk publik, arsitektur (engine Claude, penyimpanan) ditinjau ulang (SPEC bagian 2).

## 8. Cara melanjutkan di chat baru

1. Buka sesi Claude Code baru di repo ini, branch `dev`.
2. Kirim: *"Baca CLAUDE.md, docs/HANDOVER.md, dan docs/SPEC.md. Kita lanjut membahas versi 1.2, mulai dari HANDOVER bagian 7. Jangan dieksekusi dulu."*
3. Untuk menjalankan lokal: `npm install`, isi `.env.local` (template `.env.example`), `npm run dev`, buka `http://localhost:3000`. Sesi pekerja tetap environment "BPA Pekerja" (PR #1).
