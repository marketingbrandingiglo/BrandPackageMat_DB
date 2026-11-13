import Link from "next/link";
import AppHeader from "@/app/_components/app-header";
import industries from "@/data/industries.json";
import { claudeConfigured } from "@/lib/ai/claude";
import { requireSuperAdmin } from "@/lib/auth/server";
import { FONT_CATALOG } from "@/lib/brand/fonts";
import { SPECS } from "@/lib/brand/specs";
import LogoLab from "./logo-lab";
import styles from "./lab.module.css";

export default async function LabPage() {
  const { user } = await requireSuperAdmin();
  return (
    <>
      <AppHeader user={user} />
      <main className={styles.main}>
        <p className="eyebrow">Lab mesin brand · Tahap 3</p>
        <h1 className={styles.h1}>Lab</h1>
        <p className={styles.lead}>
          Halaman uji untuk super admin. Hasil tidak disimpan. Bagian yang tersedia akan bertambah per tahap (3a sampai 3e).
        </p>
        <section className={styles.section}>
          <p className="eyebrow">3a · Pengecekan logo · 3b · Palet warna · 3d · Pasangan font</p>
          <h2>Periksa logo, susun palet, pilih font</h2>
          <p className={styles.muted}>
            SVG atau PNG, maks {Math.round(SPECS.logo.maxFileBytes / 1024 / 1024)} MB. PNG: peringatan bila sisi terpanjang &lt; {SPECS.logo.pngWarnBelowPx} px, peringatan keras &lt; {SPECS.logo.pngHardWarnBelowPx} px. Palet warna disusun dari logo yang sama. Pemilihan font (3d) memakai Claude dan berbayar, jadi dijalankan dengan tombol terpisah.
          </p>
          <LogoLab
            maxBytes={SPECS.logo.maxFileBytes}
            industries={industries.industries.map((x) => ({ id: x.id, label: x.id_label }))}
            claudeReady={claudeConfigured()}
          />
        </section>
        <section className={styles.section}>
          <p className="eyebrow">3c · Daftar font terkurasi</p>
          <h2>Tinjau daftar font</h2>
          <p className={styles.muted}>
            {FONT_CATALOG.count} family Google Fonts yang akan dipilih mesin brand. Tandai font yang ingin dibuang, lalu kirim daftarnya.
          </p>
          <p>
            <Link href="/admin/lab/font" className="btn btn-secondary">Buka daftar font</Link>
          </p>
        </section>
      </main>
    </>
  );
}
