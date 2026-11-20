# Materi (Tahap 4)

Materi dibuat **kode aplikasi** (bukan Claude) dari hasil job 3d-3e (pasangan font, karakter logo) + palet dari logo (3b) + data perusahaan. Hasil disimpan di folder job di Google Drive (90 hari) dan diunduh lewat `/api/jobs/<id>/file/<nama>?download=1` (nama file `<NamaPerusahaan>_<nama>`).

Diuji di **Lab**: setelah job 3d-3e selesai, isi data perusahaan contoh (email, telepon utama, alamat utama, Instagram/LinkedIn opsional), pilih bahasa, klik "Buat materi". Semua materi yang sudah tersedia dibuat sekaligus untuk Paket A dan B (±30 detik), dengan tab per materi.

## Fondasi (`lib/materials/`)

- `kit.ts`: `BrandKit` per paket (data perusahaan, logo, palet, font, bahasa), warna template yang aman kontras (`kitColors`), placeholder per bahasa ("Nama Lengkap"/"Full Name", "Telp"/"Tel"), format telepon Indonesia (`0812...` → `+62 812-3456-7890`).
- `text.ts`: mengukur lebar teks dari file font katalog (fontkit), memperkecil (`fit`) dan membungkus (`wrap`) teks, membuat `<text>` hidup beserta kotak batasnya.
- `logo.ts`: logo SVG disisipkan sebagai `<svg>` bersarang (tetap vektor di PDF/Illustrator, id diberi awalan `lg-`), logo PNG sebagai `<image>`; ukuran mengikuti rasio logo.
- `svgdoc.ts`: kerangka SVG cetak (ukuran jadi + bleed, grup `panduan` tersembunyi berisi garis potong, area aman, dan panduan tambahan).
- `checks.ts`: pengecekan otomatis tiap render (SPEC bagian 15): teks keluar area aman, blok bertabrakan, kontras teks (≥ 4,5:1 teks kecil, ≥ 3:1 teks ≥ 4 mm), dan area terlarang (mis. lubang tali ID card). Hasilnya tampil di Lab.
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

## 4b · ID card dan amplop

**ID card** (`lib/materials/id-card.ts`): CR80 landscape 85,6 × 54 mm dan portrait 54 × 85,6 mm, + bleed 3 mm.

- Lubang tali 13 × 3 mm di tengah atas (4 mm dari garis potong), di panduan `lubang-tali`; teks dan logo tidak boleh menimpa area itu (dicek otomatis).
- **Depan**: logo, foto (placeholder "Foto"/"Photo"), nama, jabatan, nomor ID (placeholder). **Belakang**: logo, nama perusahaan (maks. 2 baris), kontak, catatan "Bila menemukan kartu ini, mohon kembalikan ke alamat di atas." (Inggris: "If found, ...").
- Paket A: latar putih, pita warna utama. Paket B: panel/blok warna utama, garis aksen, foto bulat (portrait), belakang warna utama dengan logo di pelat putih dan lingkaran aksen.
- Output: `id-card-<landscape|portrait>-<A|B>-depan.svg`, `-belakang.svg`, `.pdf` (2 halaman), pratinjau.

**Amplop** (`lib/materials/envelope.ts`): DL 220 × 110 mm + bleed 3 mm (ukuran diverifikasi ke percetakan; sebagian memakai ±110 × 230 mm), satu sisi.

- Kiri atas: logo dan alamat pengirim (nama perusahaan, telepon, email, alamat). Kanan: "Kepada Yth."/"To" + 4 garis isian penerima. Margin dalam 12 mm.
- Paket A: pita warna utama di bawah. Paket B: panel warna utama di kiri, garis aksen, segitiga warna utama di sudut kanan atas.
- Output: `amplop-<A|B>.svg`, `.pdf`, pratinjau.

