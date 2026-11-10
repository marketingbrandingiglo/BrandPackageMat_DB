# CLAUDE.md

Proyek: Brand Package Automation. **Sumber kebenaran: [`docs/SPEC.md`](docs/SPEC.md)** — baca seluruhnya sebelum menulis kode.

Aturan singkat (detail di SPEC):
- Bahasa dokumen Indonesia; istilah teknis tetap Inggris.
- Kerjakan per tahap (SPEC bagian 16), laporkan singkat, tunggu pemilik menguji. Jangan lanjut ke tahap berikutnya tanpa perintah.
- Hal di SPEC bagian 17 belum diputuskan: ajukan usulan, jangan putuskan sendiri. Bila ada yang tidak jelas, tanya pemilik.
- **Jangan push ke `main`** kecuali diperintahkan pemilik (prosedur di SPEC bagian 14). `dev` = branch kerja.
- Rahasia tidak pernah masuk repo, log, atau percakapan. `.env.local` tidak di-commit; `.env.example` adalah templatnya.
- Versi `MAJOR.MINOR` hanya naik saat push ke `main` (`npm run version:bump -- [minor|major]`).

Perintah: `npm run dev | build | lint | typecheck | test | check:redis`

Catatan Next.js: versi ini punya perubahan dari yang umum dikenal; baca `node_modules/next/dist/docs/` sebelum memakai API Next.js.
