# Rilis 1.0 (Tahap 8)

Daftar periksa sebelum dan sesudah push pertama ke `main`. Push ke `main` **hanya atas perintah pemilik** (SPEC bagian 14). Rahasia tidak pernah ditempel ke chat; semua diisi langsung oleh pemilik di Vercel, Upstash, Google Cloud, atau environment sesi pekerja.

## A. Pemeriksaan otomatis (sudah dijalankan Claude Code, 2026-11-20)

- `npm run build` lolos (Next.js 16.4.6, 19 rute).
- `npm test` 113 tes lolos; `npm run typecheck` dan `npm run lint` bersih.
- File font (`fonts/lib`) ikut terbawa ke fungsi yang merender materi; ukuran fungsi terbesar ±105 MB (batas Vercel 250 MB).
- Semua rute API butuh login, kecuali `/api/cron/cleanup` (dilindungi `CRON_SECRET`). Rute Drive dan Lab khusus super admin. Rate limit: login, 10 brand package baru per jam per user, 10 kali buat ulang materi per jam per user.
- `npm audit`: 2 temuan "high" pada `image-size` (dipakai `pptxgenjs` 4.0.1). **Tidak terjangkau**: `pptxgenjs` hanya mengukur gambar yang diberikan lewat path tanpa ukuran, sedangkan aplikasi selalu memberi data gambar + ukuran, dan logo user sudah divalidasi sebagai PNG/SVG. Diterima sebagai risiko; ditinjau lagi saat `pptxgenjs` merilis versi yang memperbaikinya. Ditinjau ulang 2026-11-25: `pptxgenjs` 4.0.1 masih versi terbaru, risiko tetap diterima.

## B. Pengujian pemilik (sudah dilakukan selama Tahap 4-7)

SVG di Illustrator, PDF lewat File > Open, DOCX di Word, PPTX di PowerPoint, email signature di klien email, alur form sampai unduhan, Riwayat, Pemakaian.

## C. Persiapan production (dikerjakan pemilik)

1. ~~**Reset token Upstash**~~: **dilewati** atas keputusan pemilik (2026-11-22). Database Upstash (`codia-fix-users`, cabang `main`) dipakai bersama aplikasi Codia dengan prefiks kunci berbeda dan satu token yang sama, sehingga reset akan memutus Codia juga; token tidak pernah tersebar dan pemakainya hanya pemilik. Bila nanti perlu reset: Upstash > database > Settings > Reset Credentials, lalu perbarui `KV_REST_API_TOKEN` di semua aplikasi yang memakai database itu (BPA: `.env.local`, Vercel, environment sesi pekerja; Codia: env lokal dan Vercel-nya).
2. **Env var Vercel (Production)**, Settings > Environment Variables:
   - `KV_REST_API_URL`, `KV_REST_API_TOKEN` (dari integrasi Upstash).
   - `SESSION_SECRET`: nilai **baru**, berbeda dari lokal (cara buat ada di `.env.example`).
   - `GITHUB_TOKEN`, `GITHUB_REPO`, `CONTROL_PR=1` (bel pekerja).
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
   - `DRIVE_TOKEN_SECRET`: **sama** dengan lokal dan sesi pekerja.
   - `CRON_SECRET`: acak, minimal 16 karakter (Vercel Cron mengirimnya otomatis).
   - Jangan isi `APP_ENV` dan variabel `GOOGLE_*_URL`/`GOOGLE_DRIVE_API` di Vercel.
3. **Google Cloud** > Google Auth Platform > Clients > client aplikasi > Authorized redirect URIs: tambahkan `https://<domain production>/api/drive/callback` (mis. `https://automatebrandpackage.vercel.app/api/drive/callback`).
4. **Password super admin production**: di Mac, `npm run admin:set-password -- prod` (password diketik di terminal, tidak ditulis ke file).
5. **Vercel project** (paket Hobby): Settings > Environments > Production > Branch Tracking = **`main`** (sebelumnya `claude/tahap-0-fondasi-pjdg6o`); region `sin1` (dari `vercel.json`), Node.js 26.x, Cron aktif (Hobby: sekali sehari, ±59 menit), deployment untuk branch selain `main` dimatikan (`git.deploymentEnabled` di `vercel.json` sejak 1.1; `ignoreCommand` sebagai pengaman kedua). Env var Upstash sudah ada sejak 10 Nov; pastikan `KV_REST_API_URL` sama dengan `.env.local`.

## D. Push ke `main` (dikerjakan Claude Code atas perintah pemilik)

Prosedur SPEC bagian 14: fetch, pull `main` bila ada perubahan, gabungkan `dev` ke `main`, versi, push, laporkan. Rilis pertama tetap **1.0** (`package.json` sudah `1.0.0`); `npm run version:bump` dipakai mulai rilis berikutnya (1.1, 1.2, ... atau 2.0 untuk perubahan alur).

## E. Setelah deploy

1. Buka domain production: halaman login menampilkan "Version 1.0".
2. Login sebagai super admin production. Admin: Google Drive seharusnya sudah terhubung (sambungan Drive dipakai bersama dev dan prod); bila belum, klik Hubungkan.
3. Buat user tim di Admin.
4. Buat satu brand package uji. Pastikan folder baru muncul di **Brand Package Automation > prod** dan pekerja memproses bel `🛎️ job prod/...`.
5. Keesokan harinya: Vercel > Cron Jobs > `/api/cron/cleanup` berstatus berhasil.
