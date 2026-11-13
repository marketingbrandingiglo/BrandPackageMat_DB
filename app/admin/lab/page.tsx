import Link from "next/link";
import AppHeader from "@/app/_components/app-header";
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
          <p className="eyebrow">3a · Pengecekan logo · 3b · Palet warna</p>
          <h2>Periksa logo dan susun palet</h2>
          <p className={styles.muted}>
            SVG atau PNG, maks {Math.round(SPECS.logo.maxFileBytes / 1024 / 1024)} MB. PNG: peringatan bila sisi terpanjang &lt; {SPECS.logo.pngWarnBelowPx} px, peringatan keras &lt; {SPECS.logo.pngHardWarnBelowPx} px. Palet warna disusun dari logo yang sama.
          </p>
          <LogoLab maxBytes={SPECS.logo.maxFileBytes} />
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
