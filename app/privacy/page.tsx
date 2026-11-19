import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kebijakan privasi · Brand Package Automation" };

/** Halaman publik (tanpa login), dirujuk dari layar izin Google. */
export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: "0 20px", lineHeight: 1.65 }}>
      <p className="eyebrow">Brand Package Automation</p>
      <h1 style={{ fontSize: 30, margin: "0 0 16px" }}>Kebijakan privasi</h1>
      <p>Aplikasi internal ini dipakai oleh pemilik dan anggota tim yang diberi akses untuk membuat paket identitas merek (brand package) dari logo dan data perusahaan.</p>
      <h2 style={{ fontSize: 20 }}>Data yang diproses</h2>
      <ul>
        <li>Logo, nama perusahaan, dan data kontak perusahaan yang diisi pengguna.</li>
        <li>Akun pengguna aplikasi (email, nama) untuk login.</li>
      </ul>
      <h2 style={{ fontSize: 20 }}>Google Drive</h2>
      <p>
        Aplikasi meminta izin <code>drive.file</code>, yaitu hanya akses ke file yang dibuat aplikasi ini sendiri, di Google Drive pemilik aplikasi.
        Aplikasi tidak membaca, mengubah, atau menghapus file lain di Drive. Logo dan hasil generate disimpan di folder &ldquo;Brand Package Automation&rdquo; dan dihapus
        otomatis setelah 90 hari. Izin bisa dicabut kapan saja lewat pengaturan akun Google (Keamanan, Aplikasi pihak ketiga).
      </p>
      <h2 style={{ fontSize: 20 }}>Pemrosesan dan pembagian data</h2>
      <p>
        Logo dan data perusahaan diolah oleh aplikasi dan oleh Claude (Anthropic) untuk analisis visual dan penyusunan materi. Data tidak dijual dan tidak dibagikan ke pihak
        lain di luar layanan yang dipakai untuk menjalankan aplikasi (Vercel, Upstash, Google Drive, Anthropic).
      </p>
      <h2 style={{ fontSize: 20 }}>Kontak</h2>
      <p>Pertanyaan tentang data: hubungi pemilik aplikasi lewat email yang tercantum di layar izin Google.</p>
    </main>
  );
}
