"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VisualTask } from "@/lib/brand/visual-types";
import { DICT, type Lang } from "@/lib/i18n/dict";
import { MATERIAL_KEYS, type CompanyData, type Materials } from "@/lib/materials/types";
import { startMaterials } from "./actions";
import MaterialsView from "./materials-view";
import styles from "./result.module.css";

type TaskState = "pending" | "running" | "done" | "error";
interface JobView {
  status: "queued" | "working" | "done" | "failed";
  createdAt: string;
  error?: string;
  visual?: VisualTask;
  wantVisual?: boolean;
  materials?: Materials;
  tasks?: Record<string, { state: "pending" | "done" | "error"; error?: string }>;
  chosen?: { pkg: "A" | "B" };
  company?: CompanyData;
}
const STUCK_MS = 6 * 60 * 1000;
const CONCURRENCY = 4;
const PKGS = ["A", "B"] as const;
const ALL_TASKS = MATERIAL_KEYS.flatMap((key) => PKGS.map((pkg) => ({ key, pkg, id: `${key}:${pkg}` })));
const tasksFor = (j?: JobView) => (j?.chosen ? ALL_TASKS.filter((x) => x.pkg === j.chosen!.pkg) : ALL_TASKS);

const fetchJob = async (id: string): Promise<JobView | null> => {
  const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" }).catch(() => null);
  return res?.ok ? ((await res.json()) as JobView) : null;
};

/** Halaman hasil: status pekerja Claude, lalu materi dibuat paralel per materi per paket (Tahap 6b). */
export default function JobProgress({ jobId, lang }: { jobId: string; lang: Lang }) {
  const T = DICT[lang];
  const t = T.job;
  const [job, setJob] = useState<JobView>();
  const [now, setNow] = useState(() => Date.now());
  const [tasks, setTasks] = useState<Record<string, TaskState>>({});
  const [error, setError] = useState<string>();
  const running = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});

  const workerDone = (j?: JobView) => j?.status === "done" && !(j.wantVisual && (!j.visual || j.visual.status === "queued" || j.visual.status === "working"));

  // 1. Pantau pekerja sampai selesai.
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const j = await fetchJob(jobId);
      if (stop) return;
      if (j) {
        setJob(j);
        setNow(Date.now());
        if (j.status === "failed" || workerDone(j)) return;
      }
      timer = setTimeout(tick, 5000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  // 2. Jalankan tugas materi yang belum selesai, maks. CONCURRENCY sekaligus.
  const runTasks = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setIsRunning(true);
    setError(undefined);
    try {
      const s = await startMaterials(jobId);
      if (s.error) {
        setError(s.error);
        return;
      }
      const j = await fetchJob(jobId);
      if (!j) return;
      const TASKS = tasksFor(j);
      const state: Record<string, TaskState> = {};
      for (const x of TASKS) state[x.id] = j.tasks?.[x.id]?.state === "done" ? "done" : "pending";
      setTaskErrors({});
      setTasks({ ...state });
      const queue = TASKS.filter((x) => state[x.id] !== "done");
      const worker = async () => {
        for (let x = queue.shift(); x; x = queue.shift()) {
          const task = x;
          setTasks((p) => ({ ...p, [task.id]: "running" }));
          const res = await fetch(`/api/jobs/${jobId}/materials`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: task.key, pkg: task.pkg }) }).catch(() => null);
          const ok = Boolean(res?.ok);
          if (!ok) {
            const msg = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}` : "network";
            setTaskErrors((p) => ({ ...p, [task.id]: msg }));
          }
          setTasks((p) => ({ ...p, [task.id]: ok ? "done" : "error" }));
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      const done = await fetchJob(jobId);
      if (done) setJob(done);
    } finally {
      running.current = false;
      setIsRunning(false);
    }
  }, [jobId]);

  const ready = workerDone(job);
  const TASKS = tasksFor(job);
  const hasMaterials = job?.materials?.run && TASKS.every((x) => job.tasks?.[x.id]?.state === "done");
  useEffect(() => {
    if (ready && !hasMaterials) runTasks();
  }, [ready, hasMaterials, runTasks]);

  if (!job) return <p className={styles.status}><span className={styles.spinner} aria-hidden="true" /></p>;
  const waited = now - Date.parse(job.createdAt);
  const busy = job.status === "queued" || job.status === "working";
  const vis = job.visual;

  const reload = async () => {
    const j = await fetchJob(jobId);
    if (j) setJob(j);
  };
  if (hasMaterials && job.materials)
    return (
      <MaterialsView
        jobId={jobId}
        m={job.materials}
        lang={lang}
        chosen={job.chosen?.pkg}
        company={job.company}
        missingVisual={job.wantVisual ? PKGS.filter((p) => (!job.chosen || job.chosen.pkg === p) && !job.materials!.visual?.[p]) : []}
        onRebuild={reload}
        onChosen={reload}
      />
    );

  const doneCount = TASKS.filter((x) => tasks[x.id] === "done").length;
  const failed = TASKS.some((x) => tasks[x.id] === "error");
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
      {ready && (
        <>
          <p className={styles.status}>
            {!failed && <span className={styles.spinner} aria-hidden="true" />}
            <strong>{T.mat.title}</strong> · {T.mat.progress(doneCount, TASKS.length)}
          </p>
          <div className={styles.bar}><span style={{ width: `${(doneCount / TASKS.length) * 100}%` }} /></div>
          <table className={styles.tasks}>
            <thead><tr><th /><th>{T.mat.pkg} A</th><th>{T.mat.pkg} B</th></tr></thead>
            <tbody>
              {MATERIAL_KEYS.map((key) => (
                <tr key={key}>
                  <td>{T.mat.labels[key]}</td>
                  {PKGS.filter((p) => !job.chosen || job.chosen.pkg === p).map((p) => {
                    const st = tasks[`${key}:${p}`] ?? "pending";
                    return <td key={p} data-state={st}>{T.mat[st]}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {failed && (
            <>
              <ul className={styles.errors}>
                {TASKS.filter((x) => tasks[x.id] === "error").map((x) => (
                  <li key={x.id}>{T.mat.labels[x.key]} {x.pkg}: {taskErrors[x.id] ?? "-"}</li>
                ))}
              </ul>
              <button type="button" className="btn btn-secondary" disabled={isRunning} onClick={runTasks}>{T.mat.retry}</button>
            </>
          )}
        </>
      )}
      {error && <p className="alert alert-error">{error}</p>}
    </div>
  );
}
