# Mesin brand (Tahap 3)

Diuji lewat halaman **`/admin/lab`** (khusus super admin, hasil tidak disimpan).

## 3a · Katalog spesifikasi dan pengecekan logo

- `data/specs.json`: ukuran materi (SPEC bagian 5), bleed/safe area, dan aturan logo (tipe, maks 5 MB, ambang resolusi 800/400 px, kontras minimum 3:1, warna latar gelap/terang uji).
- `data/industries.json`: 20 bidang usaha (label Indonesia/Inggris). Pemetaan ke font/tone ditambah di 3e.
- `lib/brand/svg-sanitize.ts`: sanitasi SVG. Dibuang: `script`, `foreignObject`, animasi, elemen tak dikenal, atribut `on*`, `javascript:`, tautan/`<use>`/`<image>` eksternal, `@import` dan `url()` eksternal di CSS. DTD dengan entity ditolak.
- `lib/brand/logo.ts`:
  - Tipe dideteksi dari isi file (bukan nama). Selain SVG/PNG dan file > 5 MB ditolak.
  - PNG: peringatan resolusi (< 800 px), peringatan keras (< 400 px).
  - SVG: peringatan raster tertanam, teks belum di-outline, tanpa viewBox.
  - Semua: peringatan latar tidak transparan.
  - Keterbacaan di latar gelap (`#212122`) dan putih: porsi piksel logo dengan kontras < 3:1. Bila > 35%: logo satu warna dibuat **versi satu warna** (putih/gelap, PNG dan SVG); logo berwarna diletakkan di atas **bidang** kontras; logo tidak transparan tampil berkotak.
- Batas Vercel: body request fungsi maks 4,5 MB. Upload > 4,5 MB di production perlu unggah langsung ke Blob (Tahap 6).
