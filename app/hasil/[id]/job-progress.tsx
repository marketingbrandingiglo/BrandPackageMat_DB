"use client";

import { useEffect, useState } from "react";
import type { VisualTask } from "@/lib/brand/visual-types";
import { DICT, type Lang } from "@/lib/i18n/dict";
import styles from "./result.module.css";

interface JobView {
  status: "queued" | "working" | "done" | "failed";
  createdAt: string;
  error?: string;
  visual?: VisualTask;
  wantVisual?: boolean;
}
const STUCK_MS = 6 * 60 * 1000;

/** Status pekerja Claude (font, tone, visual) untuk user; diperbarui tiap 5 detik. */
export default function JobProgress({ jobId, lang }: { jobId: string; lang: Lang }) {
  const t = DICT[lang].job;
  const [job, setJob] = useState<JobView>();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" }).catch(() => null);
      if (stop) return;
      if (res?.ok) {
        const j = (await res.json()) as JobView;
        setJob(j);
        setNow(Date.now());
        const visualPending = j.wantVisual && (!j.visual || j.visual.status === "queued" || j.visual.status === "working");
        if (j.status === "failed" || (j.status === "done" && !visualPending)) return;
      }
      timer = setTimeout(tick, 5000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  if (!job) return <p className={styles.status}><span className={styles.spinner} aria-hidden="true" /></p>;
  const waited = now - Date.parse(job.createdAt);
  const busy = job.status === "queued" || job.status === "working";
  const vis = job.visual;
  return (
    <div className={styles.progress} role="status">
      <p className={styles.status}>
        {busy && <span className={styles.spinner} aria-hidden="true" />}
        <strong>{t[job.status]}</strong>
        {busy ? ` · ${t.elapsed(Math.floor(waited / 60000), Math.floor((waited % 60000) / 1000))}` : ""}
      </p>
      {job.status === "failed" && <p className="alert alert-error">{job.error}</p>}
      {job.wantVisual && job.status === "done" && (
        <p className={styles.status}>
          {(!vis || vis.status === "queued" || vis.status === "working") && <span className={styles.spinner} aria-hidden="true" />}
          {t.visual}: <strong>{vis ? t[vis.status] : t.queued}</strong>
        </p>
      )}
      {busy && waited > STUCK_MS && <p className="alert alert-warn">{t.stuck}</p>}
      {job.status === "done" && <p className="alert alert-info">{t.nextStage}</p>}
    </div>
  );
}
