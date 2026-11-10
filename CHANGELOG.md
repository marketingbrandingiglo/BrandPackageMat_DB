# Changelog

## Belum dirilis
- Tahap 1 (uji render): SVG -> PDF (PDFKit + svg-to-pdfkit) dan PNG (resvg) tanpa browser; route uji `/api/render-test`; font uji Lato dan Playfair Display. Detail: `docs/render.md`. Teks PDF digabung per baris. Deploy preview manual via CLI (`FORCE_BUILD=1`), `.vercelignore`.
- Tahap 0 (fondasi): Next.js + TypeScript, mekanisme versi, Upstash satu database dengan prefiks `bpa:dev:` / `bpa:prod:`, Vercel hanya membangun `main`.
