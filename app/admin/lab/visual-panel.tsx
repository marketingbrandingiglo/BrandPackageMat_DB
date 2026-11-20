"use client";

import { useEffect, useState, useTransition } from "react";
import type { VisualTask } from "@/lib/brand/visual-types";
import { requestVisual } from "./actions";
import styles from "./lab.module.css";

const STATUS = { queued: "Menunggu pekerja Claude", working: "Sedang dikerjakan", done: "Selesai", failed: "Gagal" } as const;

/** Lab Tahap 5: minta dan pantau visual dekoratif Paket A dan B (dipakai di materi bila dicentang). */
export default function VisualPanel({ jobId, initial, onChange }: { jobId: string; initial?: VisualTask; onChange?: (t?: VisualTask) => void }) {
  const [task, setTask] = useState<VisualTask | undefined>(initial);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const busy = task?.status === "queued" || task?.status === "working";

  useEffect(() => {
    if (!busy) return;
    let stop = false;
    const t = setInterval(async () => {
      const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" }).catch(() => null);
      if (!res?.ok || stop) return;
      const j = (await res.json()) as { visual?: VisualTask };
      setTask(j.visual);
    }, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [busy, jobId]);
  useEffect(() => onChange?.(task), [task, onChange]);

  const ask = (fresh: boolean) =>
    start(async () => {
      setError(undefined);
      const r = await requestVisual(jobId, fresh);
      if (r.error) return setError(r.error);
      const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
      if (res.ok) setTask(((await res.json()) as { visual?: VisualTask }).visual);
    });

  const v = `?v=${encodeURIComponent(task?.finishedAt ?? task?.requestedAt ?? "")}`;
  return (
    <div className={styles.group}>
      <h4>Visual dekoratif (Tahap 5, opsional)</h4>
      <p className={styles.muted}>Satu aset SVG per paket dari Claude, dipakai di sampul PPT, belakang kartu nama, belakang ID card, dan sampul guideline.</p>
      {task && (
        <p className={styles.jobStatus} role="status">
          {busy && <span className={styles.spinner} aria-hidden="true" />}
          <strong>{STATUS[task.status]}</strong>
          {busy && task.step ? ` · ${task.step}` : ""}
        </p>
      )}
      {task?.status === "failed" && <p className="alert alert-error">{task.error}</p>}
      {task?.status === "queued" && !task.belled && <p className="alert alert-warn">Bel belum diatur; minta Claude memproses visual job <code>{jobId}</code> secara manual.</p>}
      {task?.notes?.map((n) => <p key={n} className="alert alert-warn">{n}</p>)}
      {task?.status === "done" && (
        <div className={styles.packages}>
          {(["A", "B"] as const).map((k) => {
            const a = task.result?.[k];
            return (
              <div key={k} className={styles.materialCard}>
                <p className="eyebrow">Paket {k}{a?.cached ? " · dari cache" : ""}</p>
                {a ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/jobs/${jobId}/file/${a.preview}${v}`} alt={`Visual Paket ${k}`} className={styles.visualPreview} />
                    <p className={styles.muted}>{a.concept.id}</p>
                    <p className={styles.downloads}><a className="btn btn-secondary" href={`/api/jobs/${jobId}/file/${a.file}?download=1`}>SVG</a></p>
                  </>
                ) : (
                  <p className="alert alert-warn">Tanpa visual (ditolak validator).</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="alert alert-error">{error}</p>}
      <p className={styles.downloads}>
        {!task || task.status === "failed" ? (
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => ask(false)}>{pending ? "Mengirim…" : "Buat visual dekoratif"}</button>
        ) : task.status === "done" ? (
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => ask(true)}>{pending ? "Mengirim…" : "Buat ulang (aset baru)"}</button>
        ) : null}
      </p>
    </div>
  );
}
