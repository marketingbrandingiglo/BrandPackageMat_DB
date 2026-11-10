# Brand Package Automation

Aplikasi internal pembuat brand package material. Spesifikasi lengkap: [docs/SPEC.md](docs/SPEC.md).

## Setup lokal
Butuh **Node.js 26** (sama dengan Vercel; lihat `.nvmrc` dan `engines` di package.json).

```bash
npm install
cp .env.example .env.local   # isi kredensial Upstash database DEV
npm run check:redis
npm run dev
```

## Environment
- Satu database Upstash (bersama project lain) via integrasi Vercel (`KV_REST_API_URL`, `KV_REST_API_TOKEN`). Lokal mengisi `.env.local`.
- Kunci Redis diberi awalan `bpa:dev:` (lokal) atau `bpa:prod:` (Vercel production, dari `VERCEL_ENV`). Jangan pernah `FLUSHDB`.

## Region
Fungsi Vercel berjalan di `sin1` (Singapura), dekat dengan Upstash (`ap-southeast-1`) dan pengguna di Indonesia (`regions` di `vercel.json`).

## Branch dan rilis
- `main` = production, `dev` = branch kerja.
- Vercel hanya membangun `main` (`ignoreCommand` di `vercel.json`); branch lain dilewati.
- Pengecualian: deploy **preview** manual lewat CLI dengan `vercel deploy --build-env FORCE_BUILD=1` (tanpa `--prod`). `.vercelignore` mencegah `.env*` ikut terunggah.
- Push ke `main` hanya atas perintah pemilik; versi naik lewat `npm run version:bump`.
