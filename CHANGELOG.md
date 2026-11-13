# Changelog

## Belum dirilis
- Login adaptif: pas di layar tanpa scroll (HP sampai desktop), ukuran mengecil proporsional di layar pendek.
- Tahap 3a: katalog spesifikasi (`data/specs.json`), daftar bidang usaha, sanitasi SVG, pengecekan logo (resolusi, transparansi, keterbacaan di latar gelap/terang, varian satu warna), halaman `/admin/lab`. SPEC: visual AI memakai Claude (SVG).
- Tampilan aplikasi mengikuti IGLO Brand Center (warna, tipografi, komponen); logo IGLO hi-res.
- Tahap 2 (login dan super admin): login email + password (argon2id), sesi 12 jam bertanda tangan, pembatasan percobaan login, halaman admin (tambah, nonaktifkan, ganti password, hapus user), skrip `admin:set-password`, versi di halaman login. Detail: `docs/auth.md`.
- Region fungsi Vercel `sin1`; Node.js dikunci ke 26.x (`engines`, `.nvmrc`).
- Tahap 1 (uji render): SVG -> PDF (PDFKit + svg-to-pdfkit) dan PNG (resvg) tanpa browser; route uji `/api/render-test`; font uji Lato dan Playfair Display. Detail: `docs/render.md`. Teks PDF digabung per baris. Deploy preview manual via CLI (`FORCE_BUILD=1`), `.vercelignore`.
- Tahap 0 (fondasi): Next.js + TypeScript, mekanisme versi, Upstash satu database dengan prefiks `bpa:dev:` / `bpa:prod:`, Vercel hanya membangun `main`.
