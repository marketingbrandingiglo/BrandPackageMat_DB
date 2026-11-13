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

## 3b · Palet warna

Kode: `lib/brand/palette.ts`, konversi warna di `lib/brand/color.ts`. Diuji di Lab bersama 3a (satu unggahan).

- **Warna logo**: k-means (k = 6, seeding k-means++ deterministik) di ruang OKLab atas piksel logo yang buram penuh. Tepi semi-transparan diabaikan; latar logo yang tidak transparan dibuang. Cluster berjarak ΔE < 8 digabung, porsi < 2% dibuang.
- **Warna berkroma vs netral**: kroma OKLCH ≥ 0,04 dianggap berwarna.
- **Warna utama**: warna berkroma dengan porsi terbesar. Logo tanpa warna: warna terbesar (biasanya hitam).
- **Warna utama untuk teks**: bila warna utama < 4,5:1 di putih, dibuat versi lebih gelap (hue sama) untuk teks kecil.
- **Warna logo lain**: warna berkroma lain dengan porsi ≥ 5% (maks 2).
- **Paket A**: warna logo lain dulu, lalu analogus (hue ±30°), plus latar lembut. Kesan harmonis/tenang.
- **Paket B**: komplementer terbelah (hue +150° dan +210°), plus latar lembut. Kesan kontras/berani.
- Aksen: lightness 0,58-0,72 (hue kuning-hijau muda ≥ 0,80 agar tidak keruh), kroma 0,10-0,18, lalu dipetakan ke gamut sRGB.
- **Netral** (kedua paket): hue warna utama, kroma sangat rendah. Teks gelap, abu sedang, abu terang, latar terang.
- **Logo tanpa warna**: harmoni hue tidak berlaku. Pendukung sementara netral (A monokrom, B monokrom kontras); aksen berwarna diusulkan di 3d/3e berdasarkan bidang usaha.
- Tiap warna: **HEX, RGB, CMYK** (konversi naif, hanya acuan; catatan proof dicantumkan), kontras di putih dan di netral gelap, serta warna teks terbaik di atasnya.
- **Pasangan WCAG**: teks gelap di latar terang, abu sedang di putih, warna utama di putih, teks di warna utama, putih di netral gelap. Level: AAA ≥ 7, AA ≥ 4,5, AA teks besar ≥ 3.
