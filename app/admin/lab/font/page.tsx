import Link from "next/link";
import AppHeader from "@/app/_components/app-header";
import { requireSuperAdmin } from "@/lib/auth/server";
import { FONT_CATALOG } from "@/lib/brand/fonts";
import FontBrowser, { type FontCard } from "./font-browser";
import styles from "../lab.module.css";

export default async function FontReviewPage() {
  const { user } = await requireSuperAdmin();
  const fonts: FontCard[] = FONT_CATALOG.fonts.map((f) => ({
    family: f.family,
    category: f.category,
    styles: f.styles,
    expressive: f.expressive,
    headingOnly: f.headingOnly,
    popularity: f.popularity,
    license: f.license,
    regular: f.files.regular,
    bold: f.files.bold,
    missingNice: f.missingNice,
    specimen: f.specimen,
  }));
  return (
    <>
      <AppHeader user={user} />
      <main className={styles.main}>
        <p className="eyebrow">Lab mesin brand · 3c</p>
        <h1 className={styles.h1}>Daftar font terkurasi</h1>
        <p className={styles.lead}>
          {FONT_CATALOG.count} family Google Fonts, dipangkas ke aksara Latin ({(FONT_CATALOG.totalBytes / 1024 / 1024).toFixed(1)} MB),
          diperbarui {FONT_CATALOG.generatedAt}. Contoh di bawah memakai file font yang benar-benar dipakai mesin render.{" "}
          <Link href="/admin/lab">Kembali ke Lab</Link>
        </p>
        <FontBrowser fonts={fonts} />
      </main>
    </>
  );
}
