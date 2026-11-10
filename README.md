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
- Dua database Upstash terpisah: dev (lokal, `.env.local`) dan production (env var Vercel, `APP_ENV=production`).
- Kunci Redis diberi awalan `dev:` atau `prod:`.

## Branch dan rilis
- `main` = production, `dev` = branch kerja.
- Vercel hanya membangun `main` (`ignoreCommand` di `vercel.json`); branch lain dilewati. Perlu dicek di dashboard Vercel saat proyek dihubungkan.
- Push ke `main` hanya atas perintah pemilik; versi naik lewat `npm run version:bump`.
