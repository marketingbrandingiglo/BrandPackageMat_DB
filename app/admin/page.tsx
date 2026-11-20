import AppHeader from "@/app/_components/app-header";
import { getLang } from "@/lib/i18n/server";
import { requireSuperAdmin, users } from "@/lib/auth/server";
import { toPublic } from "@/lib/auth/users";
import { driveStatus } from "@/lib/drive/drive";
import { bellConfigured } from "@/lib/jobs/bell";
import { currentEnv, queued } from "@/lib/jobs/jobs";
import { usageReport, type Usage } from "@/lib/usage";
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
  const usage = await usageReport(list.map((u) => u.id)).catch(() => null);
  const emailOf = (id: string) => list.find((u) => u.id === id)?.email ?? "(user dihapus)";
  return (
    <>
      <AppHeader user={me} lang={await getLang()} />
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
          <p className={styles.muted}>
            Engine Claude memakai sesi pekerja berlangganan, jadi tidak ada biaya per token. Yang dihitung: job dibuat, selesai, gagal, rata-rata waktu pekerja (kirim form sampai font dan tone selesai), visual dekoratif, putaran materi, paket dipilih, dan unduhan ZIP. Environment: {currentEnv()}.
          </p>
          {!usage ? (
            <p className="alert alert-warn">Data pemakaian belum bisa dibaca.</p>
          ) : (
            <>
              <h3 className={styles.h3}>Per user</h3>
              <UsageTable rows={[...list.map((u) => ({ label: u.email, u: usage.users[u.id] })), { label: "Total semua pengguna", u: usage.total, total: true }]} />
              <h3 className={styles.h3}>Per bulan (WIB)</h3>
              <UsageTable rows={usage.months.map((m) => ({ label: m.month, u: m.usage }))} />
              <h3 className={styles.h3}>Sesi login terbaru</h3>
              {usage.sessions.length ? (
                <UsageTable rows={usage.sessions.map((x) => ({ label: `${emailOf(x.userId)} · ${fmt(x.firstAt)}`, u: x.usage }))} />
              ) : (
                <p className={styles.muted}>Belum ada sesi dengan aktivitas.</p>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}

function dur(u: Usage) {
  if (!u.done) return "—";
  const s = Math.round(u.workerMs / u.done / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} mnt ${s % 60} dtk` : `${s} dtk`;
}

/** Tabel pemakaian (Tahap 7). */
function UsageTable({ rows }: { rows: { label: string; u: Usage; total?: boolean }[] }) {
  return (
    <div className={styles.usageWrap}>
      <table className={styles.usage}>
        <thead>
          <tr><th /><th>Job</th><th>Selesai</th><th>Gagal</th><th>Rata-rata pekerja</th><th>Visual</th><th>Putaran materi</th><th>Paket dipilih</th><th>Unduhan</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} data-total={r.total || undefined}>
              <td>{r.label}</td><td>{r.u.jobs}</td><td>{r.u.done}</td><td>{r.u.failed}</td><td>{dur(r.u)}</td><td>{r.u.visual}</td><td>{r.u.materials}</td><td>{r.u.chosen}</td><td>{r.u.downloads}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
