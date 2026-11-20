"use client";

import { useEffect, useState } from "react";
import type { FontSelectResult } from "@/lib/brand/font-select";
import type { Materials } from "@/lib/materials/types";
import FontPairsView from "./font-pairs-view";
import styles from "./lab.module.css";

interface JobView {
  id: string;
  status: "queued" | "working" | "done" | "failed";
  step?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  belled: boolean;
  companyName: string;
  industry?: string;
  result?: FontSelectResult;
  materials?: Materials;
}

const STATUS_LABEL = { queued: "Menunggu pekerja Claude", working: "Sedang dikerjakan", done: "Selesai", failed: "Gagal" } as const;
const STUCK_MS = 6 * 60 * 1000;

/** Pantau job 3d tiap 5 detik sampai selesai atau gagal. */
export default function FontJob({ jobId, belled }: { jobId: string; belled: boolean }) {
  const [job, setJob] = useState<JobView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as JobView;
        if (stop) return;
        setJob(j);
        setErr(null);
        setNow(Date.now());
        if (j.status === "done" || j.status === "failed") return;
      } catch (e) {
        if (!stop) setErr(`Status belum bisa dibaca (${(e as Error).message}); mencoba lagi.`);
      }
      if (!stop) timer = setTimeout(tick, 5000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  if (job?.status === "done" && job.result) return <FontPairsView r={job.result} jobId={job.id} companyName={job.companyName} industry={job.industry} took={job.finishedAt ? Date.parse(job.finishedAt) - Date.parse(job.createdAt) : undefined} materials={job.materials} />;

  const waited = job ? now - Date.parse(job.createdAt) : 0;
  return (
    <div className={styles.jobBox} role="status">
      <p className="eyebrow">3d · Job {jobId}</p>
      <p className={styles.jobStatus}>
        {job?.status !== "failed" && <span className={styles.spinner} aria-hidden="true" />}
        <strong>{job ? STATUS_LABEL[job.status] : "Mengirim permintaan"}</strong>
        {job?.step && job.status === "working" ? ` · ${job.step}` : ""}
        {job && job.status !== "failed" ? ` · ${Math.floor(waited / 60000)} menit ${Math.floor((waited % 60000) / 1000)} detik` : ""}
      </p>
      {job?.status === "failed" && <p className="alert alert-error">{job.error}</p>}
      {job?.status === "queued" && !job.belled && !belled && (
        <p className="alert alert-warn">Bel belum diatur, jadi pekerja tidak dibangunkan otomatis. Minta Claude memproses job <code>{jobId}</code> secara manual.</p>
      )}
      {job?.status === "queued" && (job.belled || belled) && waited > STUCK_MS && (
        <p className="alert alert-warn">Pekerja belum merespons lebih dari 6 menit. Pastikan sesi pekerja Claude masih aktif dan memantau PR saluran kontrol.</p>
      )}
      {err && <p className={styles.muted}>{err}</p>}
    </div>
  );
}
