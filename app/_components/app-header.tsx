import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { PublicUser } from "@/lib/auth/users";
import styles from "./app-header.module.css";

export default function AppHeader({ user }: { user: PublicUser }) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        <Image src="/logo-iglo.png" alt="iglo" width={41} height={33} />
        <span>Automation Brand Package</span>
      </Link>
      <nav className={styles.nav}>
        {user.role === "superadmin" && <Link href="/admin">Admin</Link>}
        <span className={styles.email}>{user.email}</span>
        <form action={logout}>
          <button type="submit" className={styles.logout}>Keluar</button>
        </form>
      </nav>
    </header>
  );
}
