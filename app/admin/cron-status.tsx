import { CRON_HISTORY, CRON_LATE_HOURS, cronState, type CleanupRun } from "@/lib/cron";
import styles from "./admin.module.css";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
}

const CRON_MSG = {
  none: ["alert-neutral", "Pembersihan otomatis belum pernah tercatat. Cron hanya berjalan di production (sekali sehari, sekitar 02.30 WIB); di lokal status ini wajar sampai cron production pertama tercatat."],
  ok: ["alert-ok", "Pembersihan otomatis berjalan normal."],
  failed: ["alert-error", "Pembersihan otomatis terakhir gagal."],
  late: ["alert-warn", `Pembersihan otomatis terlambat: run terakhir lebih dari ${CRON_LATE_HOURS} jam lalu. Cek Settings > Cron Jobs dan Logs di Vercel.`],
} as const;

/** Status cron pembersihan harian dan riwayat run terakhir (versi 1.1, lib/cron.ts). */
export function CronStatus({ runs }: { runs: CleanupRun[] | null }) {
  if (!runs) return <p className="alert alert-warn">Status pembersihan otomatis belum bisa dibaca.</p>;
  const state = cronState(runs);
  const [cls, msg] = CRON_MSG[state];
  const last = runs[0];
  return (
    <>
      <h3 className={styles.h3}>Pembersihan otomatis (file &gt; 90 hari)</h3>
      <p className={`alert ${cls}`} data-cron={state}>
        {msg}
        {last && ` Run terakhir: ${fmt(last.at)}, ${last.ok ? "berhasil" : "gagal"}, ${last.deleted.dev + last.deleted.prod} folder dihapus.`}
        {last?.error && ` Galat: ${last.error}`}
      </p>
      {runs.length > 0 && (
        <div className={`${styles.usageWrap} ${styles.cronWrap}`}>
          <table className={`${styles.usage} ${styles.cron}`}>
            <caption className={styles.caption}>{CRON_HISTORY} run terakhir</caption>
            <thead>
              <tr><th>Waktu (WIB)</th><th>Status</th><th>Folder dihapus (dev / prod)</th><th>Sesi dirapikan (dev / prod)</th><th>Durasi</th><th>Galat</th></tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.at}>
                  <td>{fmt(r.at)}</td>
                  <td data-ok={r.ok || undefined}>{r.ok ? "Berhasil" : "Gagal"}</td>
                  <td>{r.deleted.dev} / {r.deleted.prod}</td>
                  <td>{r.sessions.dev} / {r.sessions.prod}</td>
                  <td>{(r.durationMs / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} dtk</td>
                  <td>{r.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
