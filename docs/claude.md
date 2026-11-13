# Claude API

Dipakai mesin brand (SPEC bagian 6 dan 8): analisis logo, pemilihan font, nanti tone of voice, terjemahan, dan aset SVG. Hanya dipanggil dari server.

## API key

1. Masuk ke [platform.claude.com](https://platform.claude.com) (Claude Console) dengan akun perusahaan.
2. **Billing**: pastikan ada kredit atau metode pembayaran.
3. **Limits** (opsional, disarankan): pasang batas belanja bulanan, mis. US$20 selama pengembangan.
4. **API keys** > **Create key**. Beri nama yang jelas, mis. `bpa-dev` (lokal) dan nanti `bpa-prod` (production).
5. Salin key (hanya tampil sekali) langsung ke `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   Jangan ditempel ke chat, issue, atau commit. `.env.local` tidak ikut git.
6. Hentikan lalu jalankan ulang `npm run dev`.
7. Untuk deploy Vercel: Project > Settings > Environment Variables > `ANTHROPIC_API_KEY` (Preview memakai key dev; Production memakai key `bpa-prod`, diisi saat rilis).

Bila key bocor: hapus key itu di Console, buat yang baru, ganti di `.env.local`/Vercel.

## Model dan biaya

| Peran | Default | Env var | Harga (USD per 1 juta token, input / output) |
|---|---|---|---|
| Analisis visual, pemilihan font | `claude-opus-5-5` | `CLAUDE_MODEL_MAIN` | 4 / 20 |
| Tugas ringan (nanti: terjemahan dll.) | `claude-haiku-5-5` | `CLAUDE_MODEL_LIGHT` | 0,10 / 0,50 |

Harga diverifikasi 2026-11-13 (tabel di `lib/ai/claude.ts`; cek ulang sebelum mengganti model). Model paling mampu saat ini, `claude-fable-5-2`, berharga 8 / 40 (dua kali Opus 5.5); bisa dipilih lewat `CLAUDE_MODEL_MAIN` bila pemilik menghendaki.

- Bila model utama menolak permintaan (filter keamanan), API otomatis menjawab dengan model cadangan (`fallbacks: "default"`); Lab menandainya "model cadangan".
- Jawaban Claude dibatasi schema JSON (structured outputs) dan divalidasi lagi di server; kode font yang tidak dikenal diganti otomatis dan dicatat.
- Nama perusahaan dan bidang usaha dibungkus `<data_user>` dan diperlakukan sebagai data, bukan instruksi (SPEC bagian 12).

## 3d · Pemilihan font (Lab)

Dua panggilan per percobaan, ±US$0,10-0,30, 30-90 detik:

1. **Analisis logo** (effort `medium`): logo -> karakter visual (huruf, bentuk, ketebalan, formalitas, energi) dan kriteria font (tag karakter Google Fonts yang dicari/dihindari, klasifikasi gaya, kategori untuk heading dan teks isi).
2. **Shortlist** (tanpa Claude, `lib/brand/font-shortlist.ts`): skor tiap font katalog dari tag karakter, gaya, dan sedikit popularitas; kumpulan maks. 30 kandidat dengan jatah min. 3 per kategori heading dan min. 14 kandidat teks isi (Regular + Bold, sans/serif).
3. **Spesimen** (`lib/brand/font-specimen.ts`): tiap kandidat dirender dengan file font katalog (nama perusahaan + teks contoh), 10 per lembar PNG.
4. **Pemilihan** (effort `high`): Claude melihat logo dan lembar spesimen, memilih heading + teks isi untuk Paket A (paling selaras) dan Paket B (alternatif berbeda), dengan alasan.
