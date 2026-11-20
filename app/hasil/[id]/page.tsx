import AppHeader from "@/app/_components/app-header";
import { requireUser } from "@/lib/auth/server";
import { getDict, getLang } from "@/lib/i18n/server";
import { currentEnv, getJob, JOB_TTL_SECONDS } from "@/lib/jobs/jobs";
import styles from "@/app/home.module.css";
import JobProgress from "./job-progress";

/** Halaman hasil job milik user: status pekerja, pembuatan materi (6b), perbandingan paket. */
export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser();
  const lang = await getLang();
  const t = await getDict();
  const job = await getJob(currentEnv(), (await params).id);
  const allowed = job && (job.userId === user.id || user.role === "superadmin");
  const until = job ? new Date(Date.parse(job.createdAt) + JOB_TTL_SECONDS * 1000).toLocaleDateString(lang === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) : "";
  return (
    <>
      <AppHeader user={user} lang={lang} />
      <main className={styles.main}>
        {!allowed ? (
          <p className="alert alert-error">{t.job.notFound}</p>
        ) : (
          <>
            <p className="eyebrow">{t.job.eyebrow}</p>
            <h1 className={styles.h1}>{job.input.companyName}</h1>
            <p className={styles.lead}>{t.job.availableUntil(until)}</p>
            <JobProgress jobId={job.id} lang={lang} />
          </>
        )}
      </main>
    </>
  );
}
