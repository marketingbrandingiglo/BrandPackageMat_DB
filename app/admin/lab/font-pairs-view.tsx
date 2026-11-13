"use client";

import { useEffect, useState } from "react";
import { EXPRESSIVE_LABEL } from "@/lib/brand/fonts";
import type { LabFontRef, LabFontResult } from "./actions";
import { loadCatalogFont } from "./font/load-font";
import styles from "./lab.module.css";

const LETTERFORM: Record<string, string> = { sans: "Sans serif", serif: "Serif", slab: "Slab serif", script: "Script", display: "Display", mixed: "Campuran", none: "Tanpa huruf" };
const GEOMETRY: Record<string, string> = { geometric: "Geometris", organic: "Organik", mixed: "Campuran" };
const WEIGHT: Record<string, string> = { light: "Tipis", regular: "Sedang", bold: "Tebal", heavy: "Sangat tebal" };

function useFamily(f: LabFontRef) {
  const [fam, setFam] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    loadCatalogFont(f.regular, f.bold).then((n) => !off && setFam(n)).catch(() => {});
    return () => {
      off = true;
    };
  }, [f.regular, f.bold]);
  return fam ? `"${fam}", system-ui` : "system-ui";
}

function PairCard({ k, p, name }: { k: "A" | "B"; p: NonNullable<LabFontResult["packages"]>["A"]; name: string }) {
  const hf = useFamily(p.heading);
  const bf = useFamily(p.body);
  return (
    <div className={styles.pairCard}>
      <p className="eyebrow">Paket {k}</p>
      <p className={styles.pairHeading} style={{ fontFamily: hf, fontWeight: p.heading.bold ? 700 : 400 }}>{name}</p>
      <p className={styles.pairSub} style={{ fontFamily: bf, fontWeight: 700 }}>Profil perusahaan</p>
      <p className={styles.pairBody} style={{ fontFamily: bf }}>
        Kami membantu usaha Anda tumbuh lewat layanan yang jujur, cepat, dan tepat. Tim kami siap mendampingi dari perencanaan sampai hasil akhir.
      </p>
      <dl className={styles.pairMeta}>
        <div><dt>Heading</dt><dd><a href={p.heading.specimen} target="_blank" rel="noreferrer">{p.heading.family}</a> · {p.heading.category}</dd></div>
        <div><dt>Teks isi</dt><dd><a href={p.body.specimen} target="_blank" rel="noreferrer">{p.body.family}</a> · {p.body.category}</dd></div>
      </dl>
      <p className={styles.muted}>{p.reason.id}</p>
    </div>
  );
}

export default function FontPairsView({ r }: { r: LabFontResult }) {
  const t = r.traits!;
  return (
    <div className={styles.palette}>
      <div>
        <p className="eyebrow">3d · Analisis logo dan pasangan font</p>
        <h3 className={styles.h3}>Pasangan font untuk {r.companyName}</h3>
        <p className={styles.muted}>
          {r.industry ? `Bidang usaha: ${r.industry}. ` : ""}Biaya Claude ±US${r.totalUsd!.toFixed(3)} ·{" "}
          {r.calls!.map((c) => `${c.label}: ${c.model}, ${c.inputTokens.toLocaleString("id")} token masuk, ${c.outputTokens.toLocaleString("id")} token keluar, ${(c.ms / 1000).toFixed(1)} dtk${c.fellBack ? " (model cadangan)" : ""}`).join(" · ")}
        </p>
      </div>

      {r.corrections!.map((c) => <p key={c} className="alert alert-warn">{c}</p>)}

      <div className={styles.packages}>
        <PairCard k="A" p={r.packages!.A} name={r.companyName!} />
        <PairCard k="B" p={r.packages!.B} name={r.companyName!} />
      </div>
      <p className="alert alert-info">{r.notes!.id}</p>

      <div className={styles.group}>
        <h4>Karakter logo menurut Claude</h4>
        <p>{t.impression.id}</p>
        <dl className={styles.facts}>
          <div><dt>Huruf di logo</dt><dd>{t.hasText ? LETTERFORM[t.letterform] : "Tanpa huruf"}</dd></div>
          <div><dt>Bentuk</dt><dd>{GEOMETRY[t.geometry]}</dd></div>
          <div><dt>Ketebalan</dt><dd>{WEIGHT[t.weight]}</dd></div>
          <div><dt>Formalitas</dt><dd>{t.formality} / 5</dd></div>
          <div><dt>Energi</dt><dd>{t.energy} / 5</dd></div>
        </dl>
        <p className={styles.muted}>
          Dicari: {t.wantTags.map((x) => `${EXPRESSIVE_LABEL[x.tag]?.id ?? x.tag} (${x.weight})`).join(", ")}
          {t.avoidTags.length ? ` · Dihindari: ${t.avoidTags.map((x) => EXPRESSIVE_LABEL[x]?.id ?? x).join(", ")}` : ""}
          {` · Gaya: ${t.styles.join(", ")} · Heading: ${t.headingCategories.join(", ")} · Teks isi: ${t.bodyCategories.join(", ")}`}
        </p>
      </div>

      <details className={styles.group}>
        <summary><strong>Shortlist {r.shortlist!.length} kandidat dan lembar spesimen yang dilihat Claude</strong></summary>
        <table className={styles.pairs}>
          <thead><tr><th>Kode</th><th>Font</th><th>Kategori</th><th>Skor</th><th>Peran</th></tr></thead>
          <tbody>
            {r.shortlist!.map((x) => (
              <tr key={x.code}>
                <td>{x.code}</td><td>{x.family}</td><td>{x.category}</td><td>{x.score.toFixed(2)}</td>
                <td>{[x.heading && "heading", x.body && "teks isi"].filter(Boolean).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {r.sheets!.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={s} alt={`Lembar spesimen ${i + 1}`} className={styles.sheet} />
        ))}
      </details>
    </div>
  );
}
