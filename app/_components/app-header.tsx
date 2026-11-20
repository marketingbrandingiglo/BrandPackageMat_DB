import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { PublicUser } from "@/lib/auth/users";
import { DICT, type Lang } from "@/lib/i18n/dict";
import LangToggle from "./lang-toggle";
import styles from "./app-header.module.css";

export default function AppHeader({ user, lang = "id" }: { user: PublicUser; lang?: Lang }) {
  const t = DICT[lang].header;
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        <Image src="/LOGO-IGLO.png" alt="IGLO" width={1000} height={844} className={styles.logo} />
        <span>
          Automation Brand <span className={styles.accent}>Package</span>
        </span>
      </Link>
      <nav className={styles.nav}>
        <LangToggle lang={lang} label={t.lang} />
        <Link href="/" className={styles.link}>{t.newBrand}</Link>
        <Link href="/riwayat" className={styles.link}>{t.history}</Link>
        {user.role === "superadmin" && (
          <>
            <Link href="/admin/lab" className={styles.link}>Lab</Link>
            <Link href="/admin" className={styles.link}>Admin</Link>
          </>
        )}
        <span className={styles.email}>{user.email}</span>
        <form action={logout}>
          <button type="submit" className={`btn btn-secondary ${styles.logout}`}>{t.logout}</button>
        </form>
      </nav>
    </header>
  );
}
