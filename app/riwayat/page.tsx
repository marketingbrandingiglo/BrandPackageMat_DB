import Link from "next/link";
import AppHeader from "@/app/_components/app-header";
import { requireUser } from "@/lib/auth/server";
import { getDict, getLang } from "@/lib/i18n/server";
import { currentEnv, JOB_TTL_SECONDS, listJobs } from "@/lib/jobs/jobs";
import home from "@/app/home.module.css";
import styles from "./history.module.css";

/** Tahap 6d: Riwayat (SPEC bagian 10). User melihat miliknya; super admin melihat semua. */
export default async function HistoryPage() {
  const { user } = await requireUser();
  const lang = await getLang();
  const t = (await getDict()).history;
  const admin = user.role === "superadmin";
  const jobs = await listJobs(currentEnv(), admin ? undefined : user.id, 100);
  const fmt = (ms: number) => new Date(ms).toLocaleDateString(lang === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
  return (
    <>
      <AppHeader user={user} lang={lang} />
      <main className={home.main}>
        <p className="eyebrow">{t.title}</p>
        <h1 className={home.h1}>{t.title}</h1>
        <p className={home.lead}>{admin ? t.leadAdmin : t.lead}</p>
        {jobs.length === 0 ? (
          <p className="alert alert-info">{t.empty}</p>
        ) : (
          <div className={styles.wrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t.company}</th>
                  {admin && <th>{t.owner}</th>}
                  <th>{t.created}</th>
                  <th>{t.status}</th>
                  <th>{t.until}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const st = j.status === "failed" ? t.s.failed : j.status !== "done" ? t.s.working : j.chosen ? t.s.chosen(j.chosen.pkg) : t.s.choose;
                  const kind = j.status === "failed" ? "failed" : j.chosen ? "chosen" : j.status === "done" ? "choose" : "working";
                  const created = Date.parse(j.createdAt);
                  return (
                    <tr key={j.id}>
                      <td><Link href={`/hasil/${j.id}`} className={styles.name}>{j.input.companyName}</Link></td>
                      {admin && <td className={styles.muted}>{j.userEmail}</td>}
                      <td>{fmt(created)}</td>
                      <td><span className={styles.badge} data-kind={kind}>{st}</span></td>
                      <td>{fmt(created + JOB_TTL_SECONDS * 1000)}</td>
                      <td><Link href={`/hasil/${j.id}`} className="btn btn-secondary">{t.open}</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
