# Login dan super admin (Tahap 2)

## Ringkasan
- Login email + password, tanpa registrasi. User dibuat oleh super admin di `/admin`.
- Password: hash **argon2id** (`@node-rs/argon2`), minimal 10 karakter. Teks asli tidak pernah disimpan.
- Sesi: **12 jam** sejak login (tidak diperpanjang). Cookie berisi token acak + tanda tangan HMAC (`SESSION_SECRET`); Redis hanya menyimpan hash token.
- Cookie: `httpOnly`, `sameSite=lax`, `secure` + nama `__Host-bpa_session` di production (`bpa_session` di lokal).
- CSRF: semua perubahan data lewat Server Actions (hanya POST, Next.js membandingkan `Origin` dengan `Host`), ditambah cookie `sameSite`.
- Pembatasan login (Upstash Ratelimit): per email 5x / 15 menit, per IP 30x / 15 menit. Berhasil login mereset hitungan email.
- Pesan gagal selalu "Email atau password salah." (termasuk email tak terdaftar dan user nonaktif); waktu respons disamakan.
- Menonaktifkan, menghapus, atau mengganti password user menghentikan semua sesinya.
- Super admin tidak bisa menonaktifkan/menghapus dirinya sendiri dari halaman admin.
- `/api/render-test` hanya untuk user yang login.

## Data di Redis (prefiks `bpa:dev:` / `bpa:prod:`)
| Kunci | Isi |
|---|---|
| `user:{id}` | data user (termasuk hash password) |
| `user_email:{email}` | id user |
| `users` | set id user |
| `session:{sha256(token)}` | data sesi, TTL 12 jam |
| `user_sessions:{userId}` | set hash sesi milik user |
| `ratelimit:login_email:*`, `ratelimit:login_ip:*` | penghitung percobaan login |

## Super admin
```bash
npm run admin:set-password -- dev     # lokal (bpa:dev:)
npm run admin:set-password -- prod    # production (bpa:prod:), minta konfirmasi
```
Email, nama, dan password diminta lewat prompt (password tidak tampil). Menjalankan ulang dengan email yang sama = ganti password dan menghentikan sesi lama.

## Environment
- `SESSION_SECRET`: minimal 32 karakter acak; **berbeda** untuk lokal (`.env.local`) dan production (env var Vercel).

## Diuji (2026-11-10, Redis lokal + emulator REST Upstash, Playwright)
401/redirect tanpa login, pesan umum untuk password salah dan email tak terdaftar, login (email tidak peka huruf besar), cookie httpOnly/Lax/12 jam, buat user + password acak, tolak email ganda, user biasa tidak bisa buka /admin, nonaktifkan menghentikan sesi, user nonaktif tidak bisa login, pembatasan percobaan per email, hapus user dengan konfirmasi, logout, tampilan HP tanpa scroll horizontal.

## Tampilan
- Mengikuti IGLO Brand Center (https://brandasset-iglo.vercel.app/): Plus Jakarta Sans; Red Iglo `#E82827`, Darker Red `#BB2027` (hover), IGLO White `#FDFCFA` (latar), IGLO Black `#212122` (teks), netral 10-100; field radius 8, button radius 12; alert gaya "Accent". Token di `app/globals.css`.
- Halaman login mengikuti desain referensi pemilik (ukuran lebih besar).
- Logo: `public/LOGO-IGLO.png` (logo mark merah, untuk latar terang). Warna dan proporsi tidak diubah.
