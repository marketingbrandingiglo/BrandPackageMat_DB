"use client";

import { useActionState, useState } from "react";
import type { Materials } from "@/lib/materials/generate";
import { makeMaterials, type LabMaterialsResult } from "./actions";
import styles from "./lab.module.css";

const SOCIALS = [
  ["instagram", "Instagram"],
  ["linkedin", "LinkedIn"],
] as const;

/** Lab Tahap 4: data perusahaan contoh -> kartu nama Paket A dan B (SVG + PDF), pratinjau, unduh. */
export default function MaterialsPanel({ jobId, initial }: { jobId: string; initial?: Materials }) {
  const [state, action, pending] = useActionState<LabMaterialsResult, FormData>(makeMaterials, { materials: initial });
  const [lang, setLang] = useState<"id" | "en">(initial?.lang ?? "id");
  const m = state.materials;
  const c = m?.company;
  const file = (name: string, dl = false) => `/api/jobs/${jobId}/file/${name}${dl ? "?download=1" : ""}`;

  return (
    <div className={styles.group}>
      <h4>Materi (Tahap 4) · 4a kartu nama</h4>
      <form action={action} className={styles.materialsForm}>
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="lang" value={lang} />
        <label><span>Email perusahaan</span><input className="input" name="email" type="email" defaultValue={c?.email ?? ""} placeholder="halo@perusahaan.co.id" /></label>
        <label><span>Telepon utama</span><input className="input" name="phone" defaultValue={c?.phone ?? ""} placeholder="0812 3456 7890" /></label>
        <label className={styles.wide}><span>Alamat utama</span><input className="input" name="address" defaultValue={c?.address ?? ""} maxLength={160} placeholder="Jl. ..., Kota" /></label>
        {SOCIALS.map(([k, label]) => (
          <label key={k}><span>{label} (opsional)</span><input className="input" name={k} defaultValue={c?.socials.find((s) => s.platform === k)?.handle ?? ""} placeholder="handle" /></label>
        ))}
        <div className={styles.materialsActions}>
          <div className={styles.langToggle} role="group" aria-label="Bahasa materi">
            {(["id", "en"] as const).map((x) => (
              <button key={x} type="button" aria-pressed={lang === x} onClick={() => setLang(x)}>{x === "id" ? "Indonesia" : "English"}</button>
            ))}
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Membuat…" : m?.businessCard ? "Buat ulang kartu nama" : "Buat kartu nama"}</button>
        </div>
      </form>
      {state.error && <p className="alert alert-error">{state.error}</p>}
      {m?.businessCard && (
        <div className={styles.packages}>
          {(["A", "B"] as const).map((k) => {
            const p = m.businessCard![k];
            return (
              <div key={k} className={styles.materialCard}>
                <p className="eyebrow">Paket {k}</p>
                {p.previews.map((n) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={`${n}-${m.generatedAt}`} src={`${file(n)}?v=${encodeURIComponent(m.generatedAt)}`} alt={n} className={styles.cardPreview} />
                ))}
                {p.issues.length ? (
                  p.issues.map((i) => <p key={i} className="alert alert-warn">{i}</p>)
                ) : (
                  <p className={styles.muted}>Pengecekan otomatis: area aman, tabrakan teks, kontras, dan font lolos.</p>
                )}
                <p className={styles.downloads}>
                  {p.files.map((n) => (
                    <a key={n} href={file(n, true)} className="btn btn-secondary">{n.endsWith(".pdf") ? "PDF (2 halaman)" : n.includes("depan") ? "SVG depan" : "SVG belakang"}</a>
                  ))}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
