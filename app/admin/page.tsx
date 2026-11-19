import AppHeader from "@/app/_components/app-header";
import { requireSuperAdmin, users } from "@/lib/auth/server";
import { toPublic } from "@/lib/auth/users";
import { driveStatus } from "@/lib/drive/drive";
import { bellConfigured } from "@/lib/jobs/bell";
import { currentEnv, queued } from "@/lib/jobs/jobs";
import { CreateUserForm, UserRow } from "./forms";
import styles from "./admin.module.css";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
}

const DRIVE_MSG: Record<string, [string, string]> = {
  ok: ["alert-ok", "Google Drive terhubung."],
  denied: ["alert-warn", "Izin Google Drive tidak diberikan."],
  state: ["alert-error", "Sesi penghubungan kedaluwarsa atau tidak cocok. Coba lagi."],
  error: ["alert-error", "Gagal menghubungkan Google Drive. Coba lagi; bila berulang, periksa GOOGLE_CLIENT_ID/SECRET dan redirect URI."],
  config: ["alert-error", "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, atau DRIVE_TOKEN_SECRET belum diisi."],
};

function gb(n?: number) {
  return n === undefined ? "?" : `${(n / 1024 ** 3).toFixed(1)} GB`;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ dihapus?: string; drive?: string }> }) {
  const { user: me } = await requireSuperAdmin();
  const { dihapus, drive: driveMsg } = await searchParams;
  const [drive, queue] = await Promise.all([driveStatus(), queued(currentEnv()).catch(() => [])]);
  const list = (await users().list()).map(toPublic);
  return (
    <>
      <AppHeader user={me} />
      <main className={styles.main}>
        <p className="eyebrow">Super admin</p>
        <h1 className={styles.h1}>Admin</h1>
        {dihapus && <p className={`alert alert-ok ${styles.banner}`} role="status">{dihapus} dihapus.</p>}
        {driveMsg && DRIVE_MSG[driveMsg] && <p className={`alert ${DRIVE_MSG[driveMsg][0]} ${styles.banner}`} role="status">{DRIVE_MSG[driveMsg][1]}</p>}

        <section className={styles.section}>
          <p className="eyebrow">Penyimpanan dan pekerja</p>
          <h2>Google Drive dan sesi pekerja Claude</h2>
          {drive.connected ? (
            <p className="alert alert-ok">
              Google Drive terhubung{drive.email ? ` (${drive.email})` : ""}. Terpakai {gb(drive.usage)} dari {gb(drive.limit)}. File disimpan di folder &ldquo;Brand Package Automation&rdquo;.
            </p>
          ) : (
            <p className="alert alert-warn">Google Drive belum terhubung{drive.error ? `: ${drive.error}` : "."} Logo dan hasil generate disimpan di Drive, jadi hubungkan dulu.</p>
          )}
          <p>
            <a href="/api/drive/connect" className={drive.connected ? "btn btn-secondary" : "btn btn-primary"}>
              {drive.connected ? "Hubungkan ulang Google Drive" : "Hubungkan Google Drive"}
            </a>
          </p>
          <p className={styles.muted}>
            Bel pekerja: {bellConfigured() ? "aktif (PR saluran kontrol)" : "belum diatur (GITHUB_TOKEN/CONTROL_PR kosong)"} · Antrean saat ini: {queue.length} job.
          </p>
        </section>

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
          <h2>Pemakaian</h2>
          <div className="alert alert-info">Rekap jumlah generate per user dan per sesi dibuat di Tahap 7.</div>
        </section>
      </main>
    </>
  );
}
