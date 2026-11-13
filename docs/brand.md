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

## 3c · Daftar font terkurasi

- **Daftar**: `data/fonts/families.txt`, satu nama family Google Fonts per baris (sekarang 324: sans serif 136, serif 77, display 60, tulisan tangan 39, monospace 12). Menambah atau membuang font cukup mengubah file ini lalu menjalankan `npm run fonts:build`.
- **Skrip** `scripts/fonts-build.mts` (bisa dijalankan ulang; hanya membangun yang belum ada, `--force` membangun ulang semua, `--only "A,B"` membangun ulang family tertentu; folder yang tidak lagi di daftar dihapus):
  1. Mengambil metadata fonts.google.com (kategori, popularitas) dan tag `tags/all/families.csv` dari repo `google/fonts` (tag karakter Expressive 0-100 seperti Business/Calm/Competent; klasifikasi seperti Sans/Humanist). Tag yang hanya ada per posisi sumbu dirata-rata.
  2. Mengunduh file dan `METADATA.pb` dari `google/fonts` (folder `ofl/` atau `apache/`; lisensi UFL tidak dipakai).
  3. Variable font dijadikan statis: Regular (wght 400) dan Bold (wght 700), sumbu lain di nilai default (subset-font/harfbuzz). Font statis memakai file 400 dan 700.
  4. Dipangkas ke rentang "latin" Google Fonts; dicek huruf wajib (A-Z, a-z, 0-9, tanda baca dasar). Tanda baca tipografis yang tidak ada dicatat di `missingNice`.
  5. Hasil: `fonts/lib/<folder>/<Nama>-Regular.ttf`, `-Bold.ttf`, file lisensi; metadata di `data/fonts/catalog.json` (`lib/brand/fonts.ts`).
- **Aturan**: font teks isi (sans, serif, mono) wajib Regular + Bold. Display dan tulisan tangan ditandai `headingOnly` (boleh satu bobot).
- Dibuang saat penyusunan: Tinos (tidak ada file lisensi di repo), Lusitana dan Squada One (tanpa tanda kutip melengkung/tanda pisah), Ubuntu (lisensi UFL), font tiruan metrik (Carlito, Caladea), varian SC/Unicase, font musiman/barcode, dan font yang aksara utamanya bukan Latin bila bagian Latinnya lemah.
- **Tinjauan pemilik**: `/admin/lab/font`, contoh teks memakai file font hasil skrip (dimuat saat kartu terlihat), filter kategori, urut menurut tag karakter, tombol Tandai dan Salin nama. File font dilayani route `/admin/lab/font/file/...` (super admin saja, hanya file yang tercatat di katalog).
- Seleksi dua tahap (shortlist metadata lalu perbandingan visual oleh Claude) dikerjakan di 3d.
- Catatan teknis: font hasil instancing variable font menyimpan nama family bawaan file (mis. "Nunito ExtraLight") di tabel nama. Mesin render tidak bergantung pada nama itu (font didaftarkan dengan nama katalog), dan file untuk user tetap diunduh dari Google Fonts.

## 3d · Analisis logo dan pasangan font

Detail alur, model, dan biaya: `docs/claude.md`. Kode: `lib/brand/font-select.ts` (panggilan Claude), `lib/brand/font-shortlist.ts` (seleksi metadata), `lib/brand/font-specimen.ts` (lembar spesimen). Di Lab: isi nama perusahaan (dan bidang usaha bila mau), lalu klik "Pilih font dengan Claude" setelah memilih logo.

