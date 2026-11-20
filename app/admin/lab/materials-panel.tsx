"use client";

import { useActionState, useState } from "react";
import { MATERIAL_KEYS, MATERIAL_LABEL, type MaterialKey, type Materials } from "@/lib/materials/types";
import { makeMaterials, type LabMaterialsResult } from "./actions";
import styles from "./lab.module.css";

const SOCIALS = [
  ["instagram", "Instagram"],
  ["linkedin", "LinkedIn"],
] as const;

/** Lab Tahap 4: data perusahaan contoh -> materi Paket A dan B (SVG + PDF), pratinjau, unduh. */
export default function MaterialsPanel({ jobId, initial }: { jobId: string; initial?: Materials }) {
  const [state, action, pending] = useActionState<LabMaterialsResult, FormData>(makeMaterials, { materials: initial });
  const [lang, setLang] = useState<"id" | "en">(initial?.lang ?? "id");
  const [tab, setTab] = useState<MaterialKey>("businessCard");
  const m = state.materials;
  const c = m?.company;
  const file = (name: string, dl = false) => `/api/jobs/${jobId}/file/${name}${dl ? "?download=1" : ""}`;

  return (
    <div className={styles.group}>
      <h4>Materi (Tahap 4) · kartu nama, ID card, amplop, cap, kop surat, template PPT</h4>
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
          <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Membuat materi… (±30 detik)" : m?.items ? "Buat ulang materi" : "Buat materi"}</button>
        </div>
      </form>
      {state.error && <p className="alert alert-error">{state.error}</p>}
      {m?.items && (
        <>
          <div className={styles.cats} role="group" aria-label="Materi">
            {MATERIAL_KEYS.filter((key) => m.items[key]).map((key) => (
              <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>{MATERIAL_LABEL[key]}</button>
            ))}
          </div>
          {m.items[tab] && (
            <div className={styles.packages}>
              {(["A", "B"] as const).map((k) => {
                const p = m.items[tab]![k];
                return (
                  <div key={k} className={styles.materialCard} data-kind={tab}>
                    <p className="eyebrow">Paket {k}</p>
                    <div className={styles.previewRow}>
                      {p.previews.map((n) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={`${n}-${m.generatedAt}`} src={`${file(n)}?v=${encodeURIComponent(m.generatedAt)}`} alt={n} className={styles.cardPreview} />
                      ))}
                    </div>
                    {p.issues.length ? (
                      p.issues.map((i) => <p key={i} className="alert alert-warn">{i}</p>)
                    ) : (
                      <p className={styles.muted}>Pengecekan otomatis: area aman, tabrakan teks, kontras, dan font lolos.</p>
                    )}
                    <p className={styles.downloads}>
                      {p.files.map((n) => (
                        <a key={n} href={file(n, true)} className="btn btn-secondary">
                          {n.endsWith(".pptx") ? "PPTX (PowerPoint)" : n.endsWith(".docx") ? "DOCX (Word)" : n.endsWith(".pdf") ? (p.previews.length > 1 ? "PDF (2 halaman)" : n.startsWith("kop-surat") ? "PDF (kertas kop)" : "PDF") : n.includes("-depan") ? "SVG depan" : n.includes("-belakang") ? "SVG belakang" : "SVG"}
                        </a>
                      ))}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
