import AppHeader from "@/app/_components/app-header";
import { requireSuperAdmin, users } from "@/lib/auth/server";
import { toPublic } from "@/lib/auth/users";
import { CreateUserForm, UserRow } from "./forms";
import styles from "./admin.module.css";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ dihapus?: string }> }) {
  const { user: me } = await requireSuperAdmin();
  const { dihapus } = await searchParams;
  const list = (await users().list()).map(toPublic);
  return (
    <>
      <AppHeader user={me} />
      <main className={styles.main}>
        <p className="eyebrow">Super admin</p>
        <h1 className={styles.h1}>Admin</h1>
        {dihapus && <p className={`alert alert-ok ${styles.banner}`} role="status">{dihapus} dihapus.</p>}

        <section className={styles.section}>
          <p className="eyebrow">Akses</p>
          <h2>Tambah user</h2>
          <CreateUserForm />
        </section>

        <section className={styles.section}>
          <p className="eyebrow">Daftar</p>
          <h2>User ({list.length})</h2>
          <div className={styles.list}>
            {list.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isSelf={u.id === me.id}
                created={fmt(u.createdAt)}
                lastLogin={fmt(u.lastLoginAt)}
              />
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <p className="eyebrow">Pemantauan</p>
          <h2>Pemakaian dan biaya</h2>
          <div className="alert alert-info">Rekap token, kredit, dan estimasi biaya (USD/IDR) per user dan per sesi dibuat di Tahap 7.</div>
        </section>
      </main>
    </>
  );
}
