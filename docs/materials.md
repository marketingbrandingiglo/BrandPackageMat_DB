# Materi (Tahap 4)

Materi dibuat **kode aplikasi** (bukan Claude) dari hasil job 3d-3e (pasangan font, karakter logo) + palet dari logo (3b) + data perusahaan. Hasil disimpan di folder job di Google Drive (90 hari) dan diunduh lewat `/api/jobs/<id>/file/<nama>?download=1` (nama file `<NamaPerusahaan>_<nama>`).

Diuji di **Lab**: setelah job 3d-3e selesai, isi data perusahaan contoh (email, telepon utama, alamat utama, Instagram/LinkedIn opsional), pilih bahasa, klik "Buat kartu nama".

## Fondasi (`lib/materials/`)

- `kit.ts`: `BrandKit` per paket (data perusahaan, logo, palet, font, bahasa), warna template yang aman kontras (`kitColors`), placeholder per bahasa ("Nama Lengkap"/"Full Name", "Telp"/"Tel"), format telepon Indonesia (`0812...` → `+62 812-3456-7890`).
- `text.ts`: mengukur lebar teks dari file font katalog (fontkit), memperkecil (`fit`) dan membungkus (`wrap`) teks, membuat `<text>` hidup beserta kotak batasnya.
- `logo.ts`: logo SVG disisipkan sebagai `<svg>` bersarang (tetap vektor di PDF/Illustrator, id diberi awalan `lg-`), logo PNG sebagai `<image>`; ukuran mengikuti rasio logo.
- `checks.ts`: pengecekan otomatis tiap render (SPEC bagian 15): teks keluar area aman, blok bertabrakan, kontras teks (≥ 4,5:1 teks kecil, ≥ 3:1 teks ≥ 4 mm). Hasilnya tampil di Lab.
- `lib/render/svg.ts`: `svgToPdf` menerima beberapa SVG → PDF beberapa halaman.
- Nama family/style di dalam file font sudah ditulis ulang sesuai katalog (`lib/fonts/sfnt-names.ts`), sehingga PDF menyebut font yang benar (mis. `Montserrat-Bold`) saat dibuka di Illustrator.

## 4a · Kartu nama

`lib/materials/business-card.ts`. 90 × 55 mm + bleed 3 mm (SVG 96 × 61 mm, satuan viewBox mm), area aman 4 mm dari garis potong.

- **Depan** = orang dan kontak (placeholder nama/jabatan untuk diketik ulang), **belakang** = logo.
- **Paket A** (tenang): latar putih; depan logo kecil, nama (font heading), jabatan (warna utama), garis aksen, kontak di kiri bawah, sosial media di kanan bawah; belakang logo besar + pita warna utama.
- **Paket B** (berani): depan panel warna utama dengan logo di pelat putih, garis aksen paket B, kontak dengan penanda warna aksen; belakang warna utama + lingkaran aksen, logo di pelat putih.
- Logo tanpa tulisan (hasil analisis 3d): nama perusahaan ditulis di belakang (maks. 2 baris).
- Alamat maks. 2 baris; sosial media maks. 2; tanpa website (SPEC bagian 3).
- Output: `kartu-nama-<A|B>-depan.svg`, `-belakang.svg`, `kartu-nama-<A|B>.pdf` (2 halaman, font ter-embed), pratinjau PNG sebesar ukuran jadi (tanpa bleed).
- Grup ber-id (layer di Illustrator): `latar`, `logo`, `orang`, `kontak`, `garis-aksen`, `panduan` (garis potong dan area aman, tersembunyi).
