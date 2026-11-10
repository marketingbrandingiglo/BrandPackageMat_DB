import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { PublicUser } from "@/lib/auth/users";
import styles from "./app-header.module.css";

export default function AppHeader({ user }: { user: PublicUser }) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        <Image src="/LOGO-IGLO.png" alt="IGLO" width={1000} height={844} className={styles.logo} />
        <span>
          Automation Brand <span className={styles.accent}>Package</span>
        </span>
      </Link>
      <nav className={styles.nav}>
        {user.role === "superadmin" && (
          <Link href="/admin" className={styles.link}>Admin</Link>
        )}
        <span className={styles.email}>{user.email}</span>
        <form action={logout}>
          <button type="submit" className={`btn btn-secondary ${styles.logout}`}>Keluar</button>
        </form>
      </nav>
    </header>
  );
}
