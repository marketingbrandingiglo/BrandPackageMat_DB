# SPEC — Brand Package Automation

> Status: disepakati pemilik pada 2026-11-09 (belum ada kode). Dokumen ini adalah sumber kebenaran untuk sesi Claude Code berikutnya.
> Bahasa dokumen: Indonesia. Istilah teknis dibiarkan dalam bahasa Inggris.

## 0. Cara memakai dokumen ini (untuk Claude Code)

- Baca seluruh dokumen sebelum menulis kode. Keputusan di sini mengikat. Kalau ada yang bertentangan atau belum jelas, **tanya pemilik dulu**, jangan menebak.
- Bagian 17 memuat hal yang **belum diputuskan**. Jangan memutuskan sendiri diam-diam; ajukan usulan dan minta persetujuan.
- **Jangan push ke `main` kecuali pemilik memerintahkan.** Lihat bagian 14.
- Rahasia (API key, password, token) tidak pernah masuk repo, log, atau percakapan.
- Pekerjaan dikerjakan per tahap (bagian 16). Setelah tiap tahap, laporkan hasil singkat dan tunggu pemilik menguji di lokal.

## 1. Tujuan

Web app internal (prototype) yang menghasilkan **brand package material** sebuah perusahaan dari input minimal: logo, data perusahaan, dan bidang usaha. Hasilnya berupa brand guideline plus materi desain standar (kartu nama, kop surat, amplop, ID card, template PPT, email signature, cap perusahaan), dalam **dua paket dengan look and feel berbeda** yang bisa dibandingkan user, lalu dipilih satu dan diunduh.

Semua materi berupa **template placeholder**. Pengisian data per orang dilakukan user sendiri setelah mengunduh.

### Di luar cakupan (sekarang)

- Input website perusahaan (belum semua perusahaan punya).
- Hasil final per karyawan / batch dari CSV.
- File siap cetak CMYK dengan profil ICC dan crop marks (CMYK hanya berupa kode acuan di guideline).
- Pantone.
- Pembuatan atau desain ulang logo.
- Batas pemakaian keras per user (hanya pemantauan; batas ditambah nanti atas permintaan pemilik).
- Multi-tenant / pengguna eksternal.

## 2. Pengguna dan akses

- Pengguna: **internal saja**. Pengguna aplikasi terpisah dari anggota tim Vercel.
- Satu **halaman login** (email + password). Tanpa registrasi mandiri.
- **Super admin** = pemilik. Super admin dapat: membuat user beserta password-nya, menonaktifkan atau menghapus user, melihat pemakaian token/kredit dan estimasi biaya per user dan per sesi.
- Password buatan super admin **boleh langsung dipakai** user (tidak dipaksa ganti saat login pertama).
- **Sesi login berlaku 12 jam.**
- Keamanan login:
  - Password disimpan sebagai **hash** (argon2id atau bcrypt), tidak pernah teks asli.
  - Cookie sesi: `httpOnly`, `secure`, `sameSite`, ditandatangani. Perlindungan CSRF.
  - **Pembatasan percobaan login** per email dan per IP (Upstash ratelimit).
  - Pesan error login tidak membocorkan apakah email terdaftar.
- **Password super admin** diatur dan direvisi lewat **skrip** yang dijalankan Claude Code atas permintaan pemilik (mis. `npm run admin:set-password`). Password dimasukkan lewat prompt/variabel sementara, tidak ditulis ke file atau commit. Skrip menulis hash ke Upstash environment yang dituju (dev atau prod).
- Halaman login production menampilkan **versi aplikasi** (bagian 14).

## 3. Input (web form bertahap)

| Field | Wajib | Aturan |
|---|---|---|
| Logo | Ya | SVG atau PNG. Lihat pengecekan logo di bawah. |
| Nama perusahaan | Ya | Teks, panjang dibatasi. |
| Email perusahaan | Ya | Validasi format. |
| Bidang usaha | Ya | Dropdown (daftar di bawah). Bila "Lainnya": kolom teks bebas wajib, panjang dibatasi. |
| Alamat | Ya (min. 1) | Boleh banyak. **Tepat satu** ditandai alamat utama. |
| Nomor telepon | Ya (min. 1) | Boleh banyak. **Tepat satu** ditandai nomor utama. Normalisasi format Indonesia (+62). |
| Sosial media | Tidak | Platform: Instagram, LinkedIn, Facebook, X, TikTok, YouTube, WhatsApp. Hanya handle/ID. |

Website **tidak** menjadi input. Semua layout harus tampil rapi tanpa website, dan juga tanpa sosial media (field opsional yang kosong membuat layout menyesuaikan, bukan meninggalkan lubang).

### Pengecekan logo (peringatan, bukan penolakan)

- Hanya SVG dan PNG. Batas ukuran file (default 5 MB).
- PNG: peringatan bila **resolusi rendah** dan bila **latar tidak transparan**. Ambang default bisa diubah (usulan awal: peringatan di bawah 800 px sisi terpanjang, peringatan keras di bawah 400 px).
- SVG: **disanitasi** (buang script, event handler, referensi eksternal, `foreignObject`), peringatan bila ada gambar raster tertanam atau teks yang belum di-outline.
- Varian untuk latar gelap dicek/dibuat agar logo tetap terbaca di kartu berwarna dan slide gelap.
- Perbaikan logo oleh AI (upscale, hapus background, vektorisasi) hanya bila **disetujui user**, dan logo asli selalu disimpan. Fitur ini opsional dan bukan bagian tahap awal.

### Daftar bidang usaha (dropdown)

Label ditampilkan sesuai bahasa yang dipilih. Pemetaan tiap kategori ke karakter font dan tone diputuskan saat Tahap 3 (lihat bagian 17).

1. Teknologi Informasi & Software (IT & Software)
2. Keamanan Siber (Cybersecurity)
3. Telekomunikasi & Jaringan (Telecommunications & Networking)
4. Keuangan, Perbankan & Asuransi (Finance, Banking & Insurance)
5. Konsultan & Jasa Profesional (Consulting & Professional Services)
6. Kesehatan, Farmasi & Alat Kesehatan (Healthcare & Pharma)
7. Pendidikan & Pelatihan (Education & Training)
8. Makanan & Minuman (Food & Beverage)
9. Perhotelan, Pariwisata & Event (Hospitality, Tourism & Events)
10. Ritel & E-commerce (Retail & E-commerce)
11. Manufaktur & Industri (Manufacturing & Industrial)
12. Konstruksi, Properti & Arsitektur (Construction, Property & Architecture)
13. Energi, Pertambangan & Lingkungan (Energy, Mining & Environment)
14. Logistik & Transportasi (Logistics & Transportation)
15. Pertanian, Perikanan & Perkebunan (Agriculture, Fisheries & Plantation)
16. Kreatif, Media & Periklanan (Creative, Media & Advertising)
17. Fashion, Kecantikan & Gaya Hidup (Fashion, Beauty & Lifestyle)
18. Otomotif (Automotive)
19. Organisasi Nirlaba, Komunitas & Pemerintahan (Non-profit, Community & Government)
20. Lainnya (Other) + teks bebas

## 4. Bahasa (i18n)

- Dua bahasa: **Indonesia dan Inggris**, dipilih lewat tombol di bagian atas web.
- Bahasa terpilih berlaku untuk antarmuka dan **teks yang dihasilkan** (isi guideline, tone of voice, label seperti "Telp"/"Tel", teks placeholder, isi BACA-SAYA, nama folder ZIP).
- **Data perusahaan tidak diterjemahkan.**

## 5. Output

Dua paket (**Paket A** dan **Paket B**) dengan look and feel berbeda. Warna utama tetap dari logo. Yang berbeda: pasangan tipografi, layout, aksen warna pendukung, dan tone of voice.

| Materi | Output |
|---|---|
| Guideline (font Google, palet, tone of voice) | PDF |
| Kartu nama (depan + belakang) | SVG + PDF |
| ID card, **portrait dan landscape** (depan + belakang) | SVG + PDF |
| Amplop | SVG + PDF |
| Cap perusahaan | SVG + PDF |
| Kop surat | DOCX + PDF |
| Template PPT | PPTX (theme asli) |
| Email signature | HTML |

### Ukuran umum dan katalog spesifikasi

Disimpan di satu file data (mis. `data/specs.json`) agar mudah diubah. Nilai di bawah adalah **ukuran umum, bukan hasil verifikasi vendor**; pemilik akan memverifikasi ke percetakan.

| Materi | Ukuran |
|---|---|
| Kartu nama | 90 × 55 mm |
| ID card | CR80: 85,6 × 54 mm (landscape) dan 54 × 85,6 mm (portrait) |
| Amplop | DL 110 × 220 mm (sebagian percetakan Indonesia memakai ±110 × 230 mm) |
| Kop surat | A4 210 × 297 mm |
| Cap | Bulat, Ø 40 mm |
| Template PPT | 16:9 |
| Email signature | Lebar maksimal ±600 px |
| Cetak | Bleed 3 mm, safe area ±4 mm |

### Aturan konten per materi

- Alamat dan telepon utama dipakai di kartu nama dan ID card. Kop surat memuat yang utama di header dan lokasi/kontak lain di footer. Alamat/telepon tambahan tidak dijejalkan ke materi kecil.
- Teks placeholder mengikuti bahasa terpilih (mis. "Nama Lengkap", "Jabatan", foto placeholder di ID card).
- Kop surat: **header dan footer yang sama di setiap halaman.**

### Aturan teknis per format

**SVG (kartu nama, ID card, amplop, cap)** — untuk diedit di Adobe Illustrator:
- Ditulis **langsung sebagai SVG dari template** (bukan hasil screenshot HTML). PDF dan PNG preview dirender dari SVG yang sama, jadi satu sumber untuk semua format.
- Pakai atribut sederhana. **Hindari** variabel CSS, filter CSS, blend mode, `color-mix`, `foreignObject`. Beri `id`/grup bernama agar muncul rapi sebagai layer.
- **Teks hidup (live text)**, bukan outline, supaya placeholder bisa diketik ulang. Konsekuensi: font Google harus terpasang di komputer user. Tautan unduh font ada di `BACA-SAYA` dan guideline.
- SVG hanya RGB. Kode CMYK dicatat di guideline sebagai acuan.

**DOCX (kop surat)**: header dan footer asli Word, logo di header, gaya paragraf memakai font dan warna brand. Fontnya harus terpasang di komputer user.

**PPTX**: theme asli (warna tema, font tema major/minor, slide master dengan logo, layout: judul, bagian, isi, dua kolom, penutup). Dibuat dengan memodifikasi XML theme di dalam file. Verifikasi render lewat LibreOffice; pengujian akhir di PowerPoint oleh pemilik.

**Email signature (HTML)**: HTML berbasis tabel dengan inline CSS. Font Google tidak tampil di klien email, jadi pakai **font cadangan web-safe** (mis. Arial/Georgia). Gambar (logo, ikon) harus berupa URL yang di-host. Lihat risiko di bagian 17.

**Cap**: bulat, vektor **satu warna**, latar transparan. Ini desain, bukan stempel yang sah secara hukum.

## 6. Mesin brand (guideline)

1. **Analisis logo**: kombinasi deteksi deterministik (warna dominan lewat k-means) dan analisis visual oleh Claude (gaya: geometris/organik, ketebalan, ada/tidak serif, formalitas, energi). Output berupa JSON terstruktur, divalidasi schema.
2. **Palet warna**: warna utama dari logo, 2-3 warna pendukung dari aturan harmoni, plus netral. Tiap warna punya **HEX, RGB, CMYK**. CMYK dari konversi hitung-hitungan dan **hanya acuan**; guideline mencantumkan catatan bahwa hasil cetak perlu proof. Pasangan warna teks/latar dicek kontrasnya (WCAG).
3. **Font** (hanya Google Fonts):
   - **Daftar terkurasi sekitar 300 family** di dalam repo, dipangkas ke aksara Latin, beserta file lisensi tiap font (OFL/Apache). Skrip pembuatnya **bisa dijalankan ulang**, sehingga menambah font nanti cukup dengan menambah nama family ke daftar atas permintaan pemilik.
   - Seleksi dua tahap: (a) saring dengan metadata (kategori, **tag karakter** dari repo Google Fonts seperti Business/Calm/Competent/Playful, klasifikasi seperti Humanist, dukungan huruf Indonesia, ketersediaan Regular dan Bold) lalu ambil shortlist 20-40 kandidat; (b) render spesimen tiap kandidat bersama logo dan nama perusahaan, lalu Claude membandingkan secara visual dan memilih pasangan heading + body untuk Paket A dan B.
   - Font display dan tulisan tangan hanya untuk heading pada konteks tertentu, bukan teks isi.
   - Yang dicapai adalah **kecocokan karakter**, bukan mengenali font persis di dalam logo.
4. **Tone of voice**: dihasilkan dari kesan visual logo dan bidang usaha. Ini **hipotesis**, ditulis sebagai usulan, dalam bahasa terpilih. Berbeda untuk Paket A dan B.

## 7. Visual AI (opsional)

- Lingkup: **satu aset dekoratif per paket** (pola/ilustrasi latar) yang dipakai ulang di beberapa materi, bukan satu per materi. Pola sederhana dibuat dari kode.
- Penyedia: **Claude API** (sama dengan mesin brand), hanya dipanggil dari server. Keluaran berupa **kode SVG** (pola, bentuk geometris, ilustrasi abstrak), bukan gambar raster; tidak ada foto atau ilustrasi realistis. SVG hasil Claude disanitasi dan divalidasi seperti logo unggahan. *(Diubah 2026-11-10: sebelumnya OpenAI Images API atau Magnific.)*
- Aturan prompt tetap: tanpa teks, tanpa logo, tanpa wajah orang nyata, sisakan ruang kosong untuk judul. Teks dan logo selalu dari template.
- Cache berdasarkan hash prompt, maksimal 3 kali percobaan ulang, biaya dicatat.
- Karena keluarannya vektor, aset tetap bisa diedit di Illustrator dan tajam untuk cetak.

## 8. Arsitektur

- **Stack**: Next.js (App Router) + TypeScript, deploy di **Vercel Pro** (satu tim). Satu codebase untuk tampilan dan backend.
- **Upstash Redis**: user, sesi, status job, penghitung pemakaian, rate limit, cache kurs. **Dua database terpisah**: lokal/dev dan production.
- **Vercel Blob (private)**: logo yang diunggah, hasil generate, ZIP. Dikirim ke user lewat route yang butuh login (bukan URL publik yang bisa ditebak).
- **Vercel Cron**: pembersihan file kedaluwarsa.
- **Claude API**: dipanggil dari server saja (analisis logo, saran font/warna/tone, terjemahan konten, aset dekoratif SVG). Input user diperlakukan sebagai data (lihat bagian 12).
- **Render**: kebutuhan arsitektur ini diputuskan oleh **uji kelayakan di Tahap 1**, dengan urutan prioritas:
  1. PDF dari SVG **tanpa browser** (pustaka ringan);
  2. Chromium versi ringkas untuk serverless;
  3. layanan render terpisah (kontainer kecil), web form tetap di Vercel.
- **Generate paralel**: tahap 1 (analisis logo, guideline, aset visual) harus selesai dulu karena semua materi bergantung padanya. Setelah itu **semua materi dikerjakan bersamaan**, tiap materi sebagai tugas pendek terpisah untuk kedua paket. Status tiap tugas ada di Redis; UI menampilkan progres per materi.
- **Font di bundel**: terkurasi (±300 family, ±43 MB setelah dipangkas), di dalam repo, aman terhadap batas ukuran fungsi.

### Fakta platform (diverifikasi pada 2026-11-09 dari dokumentasi Vercel; cek ulang bila ragu)

- Vercel Functions dengan Fluid compute: durasi default 300 detik (maks 800 detik di Pro). Batas bundle 250 MB uncompressed ("large functions" beta sampai 5 GB). Batas body request/respons 4,5 MB, **tidak berlaku untuk respons streaming**. Puppeteer dengan Chromium bawaan disebut penyebab umum melebihi batas 250 MB.
- Vercel Blob tersedia di semua plan; di Pro dibayar berdasarkan pemakaian (contoh di dokumentasi: ±$0,023/GB-bulan untuk penyimpanan; operasi hapus gratis).
- Password Protection bawaan Vercel **tidak dipakai** (di Pro berbiaya $20/bulan/proyek). Autentikasi dilakukan oleh aplikasi sendiri.
- Data font (diukur 2026-11-09 dari repo `google/fonts`): 2.042 family, 3.785 file, 2,23 GB; family CJK saja 1,34 GB; ini alasan memakai daftar terkurasi.

## 9. Unduhan

Setelah kedua paket selesai, user membandingkan lalu **memilih satu paket**. Untuk paket terpilih tersedia tiga cara unduh:

1. **Unduh semua (ZIP)**: seluruh materi paket terpilih.
2. **Unduh per materi**: tombol unduh di tiap materi.
3. **Checklist**: user mencentang **lebih dari satu materi, tetapi tidak semua**, lalu mengunduh pilihannya sebagai satu ZIP.

Aturan:
- ZIP lengkap dibuat sebagai **langkah terakhir** setelah semua materi selesai, disimpan di Blob. ZIP hasil checklist dibuat **sesuai permintaan** dengan streaming dari file yang sudah ada (tidak disimpan).
- Struktur ZIP lengkap:

```
NamaPerusahaan_BrandPackage_A.zip
├── 01_Guideline/        (PDF)
├── 02_Kartu-Nama/       (SVG depan, SVG belakang, PDF)
├── 03_Kop-Surat/        (DOCX, PDF)
├── 04_Amplop/           (SVG, PDF)
├── 05_ID-Card/          (portrait dan landscape, SVG + PDF)
├── 06_Template-PPT/     (PPTX)
├── 07_Email-Signature/  (HTML)
├── 08_Cap/              (SVG, PDF)
└── BACA-SAYA            (tautan unduh font, cara memakai, catatan CMYK)
```

- Nama folder dan isi `BACA-SAYA` mengikuti bahasa terpilih. Nama file memakai nama perusahaan yang sudah dibersihkan dari karakter bermasalah. `BACA-SAYA` selalu ikut di setiap ZIP, termasuk hasil checklist (usulan penamaan: `..._A_Pilihan.zip`).
- **Paket yang tidak dipilih tetap tersedia sampai batas 24 jam**, supaya user bisa berubah pikiran.
- **File font tidak dibundel** di ZIP untuk saat ini; hanya tautan unduh font Google di `BACA-SAYA` (font di repo sudah dipangkas ke Latin, jadi tidak cocok didistribusikan untuk diedit). Bisa ditambah nanti.

## 10. Retensi dan privasi

- Semua hasil generate **dan logo yang diunggah dihapus otomatis setelah 24 jam**, atau lebih awal saat user yang sama memulai generate baru (hasil sebelumnya diganti, per user).
- Penghapusan dilakukan per user/sesi, tidak pernah global. Pembersihan terjadwal lewat Vercel Cron; metadata di Redis memakai TTL 24 jam.
- Antarmuka menampilkan keterangan "file tersedia hingga {waktu}" (hitung mundur).
- Setiap user hanya menyimpan satu generate (kedua paket A dan B) pada satu waktu.

## 11. Pemakaian dan biaya

- Setiap pemanggilan penyedia dicatat sebagai event: user, sesi, job, penyedia (Anthropic), model, token input/output, estimasi biaya.
- **Sesi = satu kali login** (maksimal 12 jam). Pemakaian ditampilkan per proses generate dan kumulatif per sesi, per user, dan **total gabungan semua pengguna** (hitungan atomik di Upstash).
- Yang dihitung "token" hanya bagian Claude (satu-satunya penyedia AI). Render PDF/PPTX tidak memakai token.
- **Biaya ditampilkan dalam USD dan IDR.** USD adalah nilai dasar. Kurs USD→IDR diambil server dari sumber publik, disimpan sementara di Upstash, diperbarui setiap beberapa jam. Antarmuka menampilkan kurs, waktu, dan sumbernya. Bila sumber gagal, dipakai kurs terakhir yang berhasil diambil.
- Sumber gratis umumnya hanya diperbarui sekali sehari (mis. kurs referensi harian Bank Indonesia atau kurs berbasis Bank Sentral Eropa); kurs intrahari butuh layanan berbayar. Sumber final diverifikasi saat membangun.
- **Tabel harga** (per juta token Claude, per model) disimpan sebagai data yang mudah diubah dan **diverifikasi ke halaman harga resmi** saat dipakai.
- Default: IDR dihitung dengan **kurs saat event terjadi** dan disimpan bersama event, supaya riwayat tidak berubah ketika kurs bergerak.
- Admin melihat rekap di halaman admin. Belum ada batas pemakaian.

## 12. Keamanan input

- Brief, nama perusahaan, dan isi kolom "Lainnya" adalah **data, bukan instruksi**. Panggilan ke Claude memakai output terstruktur (schema), tanpa akses tool berbahaya, dan hasilnya divalidasi.
- Semua teks user di-escape saat masuk ke SVG, HTML, dan DOCX. Nama file disanitasi.
- Upload dibatasi tipe dan ukuran. SVG disanitasi (bagian 3).
- API key hanya di environment variable server. Tidak ada di kode klien.
- Rate limit pada login dan pada endpoint generate.

## 13. Struktur data (garis besar)

Redis (kunci berawalan sesuai environment): `user:{id}`, `session:{id}` (TTL 12 jam), `job:{id}` dan `task:{id}` (status materi, TTL 24 jam), `usage:*` (penghitung), `fx:usd_idr` (cache kurs). File di Blob dengan prefiks per user.

## 14. Alur development dan rilis

- Pengembangan di **lokal** pemilik. Repo GitHub; hanya pemilik yang mengerjakan repo ini.
- Branch: **`main`** = production, **`dev`** = branch kerja. `dev` di-push ke GitHub sebagai cadangan **tanpa memicu Vercel**: preview deployment untuk branch selain `main` dimatikan (lewat `vercel.json` atau Ignored Build Step; caranya diverifikasi saat setup).
- **Vercel hanya diperbarui saat pemilik memerintahkan push ke `main`.**
- Tanpa pull request. Prosedur push ke `main` atas perintah pemilik:
  1. `fetch` dari GitHub; bila `main` di remote punya perubahan baru, **pull dulu**.
  2. Gabungkan `dev` ke `main`.
  3. Naikkan versi di `package.json` dan commit.
  4. Push `main`.
  5. Laporkan nomor versi dan alasannya.
- Dua environment dengan **Upstash dan API key terpisah**: lokal/dev dan production. File `.env.local` tidak pernah di-commit; production memakai environment variable Vercel.

### Versi aplikasi

- Format `MAJOR.MINOR` (tanpa angka patch). Versi pertama yang dirilis: **1.0**.
- Naik hanya saat push ke `main`.
- **Minor** (angka belakang: 1.1, 1.2, ...) adalah default, termasuk bila pemilik tidak menyebut jenis perubahan.
- **Major** (angka depan: 2.0, 3.0, ...) untuk perubahan atau penambahan **alur**. Claude Code menilai dan menyebut alasannya; pemilik bisa meminta koreksi.
- Versi disimpan di satu tempat (`package.json`), dibaca saat build, dan ditampilkan di halaman login. Disarankan menambah `CHANGELOG.md` singkat per rilis.

## 15. Pengujian dan kualitas

- **Pengecekan otomatis** tiap render: teks meluap, teks keluar dari margin atau safe area, blok bertabrakan, kontras warna, font terpasang. Mode ketat mengembalikan error untuk dipakai di pipeline.
- Hasil render diperiksa secara visual sebelum dianggap selesai.
- Pemilik menguji sendiri: SVG di Illustrator, PPTX di PowerPoint, DOCX di Word, signature di klien email. Itu tidak bisa diverifikasi dari lingkungan cloud.
- Tes unit untuk validasi input, perhitungan biaya, aturan versi, dan penghapusan 24 jam.

## 16. Roadmap

Tiap tahap dikerjakan di lokal, diuji pemilik, **tanpa naik ke Vercel sebelum diperintahkan**.

0. **Fondasi**: repo, Next.js + TS, branch `main`/`dev`, preview dimatikan untuk non-`main`, pengelolaan rahasia, dua database Upstash, mekanisme versi 1.0, file ini ke repo (bersama `CLAUDE.md` singkat yang menunjuk ke sini).
1. **Uji render**: buktikan PDF dari SVG tanpa browser, uji di Vercel sungguhan (butuh satu kali deploy atas izin pemilik). Bila gagal, pindah ke Chromium ringkas atau layanan terpisah.
2. **Login dan super admin**: user, password ter-hash, sesi 12 jam, pembatasan login, halaman admin, versi di halaman login.
3. **Mesin brand**: katalog spesifikasi, pengecekan logo, daftar font terkurasi dan seleksi dua tahap, palet HEX/RGB/CMYK, tone of voice, dua arah paket, dua bahasa.
4. **Materi**: kartu nama, cap, amplop, ID card (SVG + PDF); kop surat (DOCX + PDF); PPTX; email signature HTML; guideline PDF.
5. **Visual AI (opsional)**: aset dekoratif per paket, cache, batas percobaan.
6. **Web form**: wizard input, tombol bahasa, progres paralel per materi, tampilan dua paket berdampingan, pilih satu, unduh semua / per materi / checklist.
7. **Pemakaian dan kurs**: penghitung, estimasi USD/IDR, rekap admin, penghapusan 24 jam.
8. **Pengujian dan rilis 1.0**: pengecekan otomatis, pengujian pemilik di aplikasi Adobe/Microsoft, push ke `main` sebagai versi 1.0.

## 17. Belum diputuskan / perlu diverifikasi

1. Nilai harga token Claude per model; sumber kurs final.
2. Daftar 300 font terkurasi: disusun Claude Code (kategori, tag, dukungan huruf Indonesia, bobot), **ditinjau pemilik**.
3. Pemetaan bidang usaha ke karakter font dan tone.
4. **Isi tengah cap**: logo dikonversi monokrom bila bersih, atau inisial/ornamen bila tidak. Diputuskan saat Tahap 4.
5. **Gambar di email signature** (logo, ikon sosial media): file hasil dihapus dalam 24 jam, sehingga signature tidak boleh bergantung pada URL milik aplikasi. Usulan: tempatkan placeholder URL, sertakan file gambar di ZIP, dan jelaskan di `BACA-SAYA` cara mengunggahnya ke Gmail/Outlook atau hosting sendiri; sosial media berupa tautan teks secara default.
6. Spesifikasi cetak (ukuran amplop, bleed, safe area) diverifikasi ke vendor.
7. Ambang peringatan resolusi logo.
8. Aset visual AI dipakai di materi mana (usulan: sampul PPT, sisi belakang ID card, sisi belakang kartu nama).
9. Penamaan ZIP hasil checklist, dan apakah versi di lokal diberi label "(lokal)".
10. ~~Detail API OpenAI dan Magnific~~ — tidak berlaku lagi (visual AI memakai Claude, 2026-11-10).
11. Penggantian kurs: IDR memakai kurs saat event (default di bagian 11); ubah bila pemilik memilih kurs berjalan.

## 18. Riwayat keputusan penting

- Font: opsi **A (terkurasi di repo)** dipilih karena tidak mau biaya tambahan; opsi katalog penuh dengan file di Blob ditunda.
- Akses: **login buatan sendiri (email + password)**, bukan Password Protection Vercel.
- Render: ditentukan oleh uji kelayakan Tahap 1. **Hasil (2026-11-10): PDF dari SVG tanpa browser (PDFKit + svg-to-pdfkit, PNG via resvg) lulus di lokal dan di Vercel.** Detail: `docs/render.md`.
- Unduhan: tiga cara (semua, per materi, checklist) disetujui; tiga keputusan kecil ZIP (paket tidak dipilih tetap 24 jam, font tidak dibundel, nama file) disetujui.
- Upstash (2026-11-10): dev dan production memakai **satu database Upstash yang sudah ada** (dipakai juga oleh project lain), dipisahkan dengan prefiks kunci `bpa:dev:` dan `bpa:prod:`. Ini menggantikan "dua database terpisah" di bagian 8, 13, dan 14. Konsekuensi yang diterima pemilik: kredensial database production ada di `.env.local`; pembersihan data wajib dibatasi ke prefiks `bpa:*` (tidak boleh `FLUSHDB`/`FLUSHALL`). Env var mengikuti integrasi Vercel: `KV_REST_API_URL`, `KV_REST_API_TOKEN`; environment dibaca dari `VERCEL_ENV`.
- Visual AI (2026-11-10): **Claude saja** (keluaran SVG), menggantikan OpenAI/Magnific. Satu penyedia dan satu API key; pencatatan biaya hanya token Claude.
- Tahap 3 (2026-11-10): dikerjakan bertahap 3a-3e dengan titik uji pemilik di tiap bagian; diuji lewat halaman `/admin/lab` (khusus super admin). Ambang resolusi logo tetap (peringatan < 800 px, peringatan keras < 400 px). Pemilik menyetujui: tinjauan daftar font, usulan pemetaan bidang usaha, dan pembagian model Claude (model paling mampu untuk analisis visual/pemilihan font, model ringan untuk tugas sederhana; harga diverifikasi sebelum dipakai).
- Tahap 3b (2026-11-13): Paket A memakai harmoni analogus (didahului warna logo lain), Paket B komplementer terbelah. Pilihan/koreksi warna utama oleh user ditunda sampai semua materi tampil lengkap dengan warnanya.
- Upload logo (2026-11-13): drag & drop dan tempel dari clipboard (Cmd/Ctrl + V, termasuk teks SVG) selain klik; logo diproses saat tombol diklik, bukan otomatis. Komponen dipakai ulang di form Tahap 4.
- Tahap 3c (2026-11-13): daftar terkurasi 324 family (sans 136, serif 77, display 60, tulisan tangan 39, mono 12; 31,7 MB) disusun dari popularitas Google Fonts dan dipangkas manual; ditinjau pemilik di `/admin/lab/font`. File font dibuat dengan subset-font (harfbuzz) di Node, tanpa Python. Lisensi UFL (Ubuntu) tidak dipakai karena SPEC membatasi OFL/Apache.
