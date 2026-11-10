import AppHeader from "@/app/_components/app-header";
import { requireUser } from "@/lib/auth/server";
import styles from "./home.module.css";

export default async function Home() {
  const { user } = await requireUser();
  return (
    <>
      <AppHeader user={user} />
      <main className={styles.main}>
        <p className="eyebrow">Beranda</p>
        <h1 className={styles.h1}>Halo, {user.name || user.email}</h1>
        <div className="alert alert-info">Form pembuatan brand package akan tersedia di tahap berikutnya.</div>
      </main>
    </>
  );
}
