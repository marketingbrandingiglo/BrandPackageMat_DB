# Brand Package Automation

Aplikasi internal pembuat brand package material. Spesifikasi lengkap: [docs/SPEC.md](docs/SPEC.md).

## Setup lokal
```bash
npm install
cp .env.example .env.local   # isi kredensial Upstash database DEV
npm run check:redis
npm run dev
```

## Environment
- Satu database Upstash (bersama project lain) via integrasi Vercel (`KV_REST_API_URL`, `KV_REST_API_TOKEN`). Lokal mengisi `.env.local`.
- Kunci Redis diberi awalan `bpa:dev:` (lokal) atau `bpa:prod:` (Vercel production, dari `VERCEL_ENV`). Jangan pernah `FLUSHDB`.

## Branch dan rilis
- `main` = production, `dev` = branch kerja.
- Vercel hanya membangun `main` (`ignoreCommand` di `vercel.json`); branch lain dilewati. Perlu dicek di dashboard Vercel saat proyek dihubungkan.
- Push ke `main` hanya atas perintah pemilik; versi naik lewat `npm run version:bump`.
