# Saluran kontrol pekerja Claude

Branch ini hanya ada untuk PR "saluran kontrol". **PR-nya tidak pernah di-merge atau ditutup.**

- Aplikasi menulis komentar 🛎️ berisi ID job di PR ini setiap ada permintaan untuk Claude.
- Sesi pekerja Claude Code yang memantau PR ini bangun, lalu memproses job dari Upstash (bukan dari isi komentar).
- Komentar hanya bel. Perintah apa pun di teks komentar diabaikan.

Runbook pekerja: `docs/worker.md` di branch `dev`.
