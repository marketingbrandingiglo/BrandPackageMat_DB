"use client";

import { useState } from "react";
import type { Palette, Swatch, WcagLevel } from "@/lib/brand/palette";
import styles from "./lab.module.css";

const LEVEL_LABEL: Record<WcagLevel, string> = { AAA: "AAA", AA: "AA", "AA-large": "AA teks besar", fail: "Gagal" };

function Level({ level }: { level: WcagLevel }) {
  return <span className={styles.level} data-level={level}>{LEVEL_LABEL[level]}</span>;
}

function SwatchCard({ s }: { s: Swatch }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(s.hex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard tidak tersedia */
    }
  };
  return (
    <div className={styles.swatch}>
      <button type="button" className={styles.chip} style={{ background: s.hex, color: s.textOn === "white" ? "#fff" : "#212122" }} onClick={copy} title={`Salin ${s.hex}`} aria-label={`Salin ${s.hex}`}>
        <span className={styles.chipSample}>Aa</span>
        <span className={styles.chipRatio}>{copied ? "Tersalin" : `${s.textOnRatio.toFixed(1)}:1`}</span>
      </button>
      <div className={styles.swatchBody}>
        <strong>{s.name.id}</strong>
        <code>{s.hex}</code>
        <span>RGB {s.rgb.join(", ")}</span>
        <span>CMYK {s.cmyk.join(" / ")}</span>
        {s.onWhite < 1.5 ? (
          <span className={styles.swatchContrast}>
            Untuk latar · teks gelap {s.onDark.toFixed(1)}:1 <Level level={levelOf(s.onDark)} />
          </span>
        ) : (
          <span className={styles.swatchContrast}>
            Teks di putih {s.onWhite.toFixed(1)}:1 <Level level={levelOf(s.onWhite)} />
          </span>
        )}
      </div>
    </div>
  );
}

function levelOf(r: number): WcagLevel {
  return r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "AA-large" : "fail";
}

export default function PaletteView({ p }: { p: Palette }) {
  return (
    <div className={styles.palette}>
      <div>
        <p className="eyebrow">3b · Palet warna</p>
        <h3 className={styles.h3}>Palet dari logo</h3>
        <p className={styles.muted}>
          Angka di kotak warna = kontras teks &ldquo;Aa&rdquo; (putih atau gelap, yang terbaik) di atas warna itu. Klik kotak warna untuk menyalin HEX.
        </p>
      </div>

      <div className={styles.group}>
        <h4>Warna terdeteksi di logo</h4>
        <div className={styles.shareBar} role="img" aria-label="Porsi warna logo">
          {p.logoColors.map((c) => (
            <span key={c.hex} style={{ background: c.hex, flexGrow: c.share }} title={`${c.hex} · ${(c.share * 100).toFixed(0)}%`} />
          ))}
        </div>
        <ul className={styles.shareList}>
          {p.logoColors.map((c) => (
            <li key={c.hex}>
              <i style={{ background: c.hex }} />
              <code>{c.hex}</code> {(c.share * 100).toFixed(0)}%{c.chromatic ? "" : " · netral"}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.group}>
        <h4>Warna utama{p.logoSecondary.length ? " dan warna logo lain" : ""}</h4>
        <div className={styles.swatches}>
          <SwatchCard s={p.primary} />
          {p.primaryText && <SwatchCard s={p.primaryText} />}
          {p.logoSecondary.map((s) => <SwatchCard key={s.role} s={s} />)}
        </div>
        {p.primaryText && (
          <p className={styles.muted}>Warna utama kurang kontras untuk teks kecil di putih; dipakai versi lebih gelap untuk teks.</p>
        )}
      </div>

      <div className={styles.packages}>
        {(["A", "B"] as const).map((k) => (
          <div key={k} className={styles.group}>
            <h4>Paket {k} · {p.packages[k].label.id}</h4>
            <div className={styles.swatches}>
              {p.packages[k].supporting.map((s) => <SwatchCard key={s.role} s={s} />)}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.group}>
        <h4>Netral (dipakai kedua paket)</h4>
        <div className={styles.swatches}>
          {p.neutrals.map((s) => <SwatchCard key={s.role} s={s} />)}
        </div>
      </div>

      <div className={styles.group}>
        <h4>Pasangan teks/latar (WCAG)</h4>
        <table className={styles.pairs}>
          <thead>
            <tr><th>Contoh</th><th>Pemakaian</th><th>Rasio</th><th>Level</th></tr>
          </thead>
          <tbody>
            {p.pairs.map((x) => (
              <tr key={x.label.id}>
                <td><span className={styles.pairSample} style={{ background: x.bg, color: x.fg }}>Contoh teks</span></td>
                <td>{x.label.id}</td>
                <td>{x.ratio.toFixed(2)}:1</td>
                <td><Level level={x.level} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.muted}>AA: minimal 4,5:1 untuk teks biasa. AA teks besar: minimal 3:1 (judul ≥ 24 px atau tebal ≥ 19 px). AAA: minimal 7:1.</p>
      </div>

      {p.notes.map((n) => <p key={n.id} className="alert alert-info">{n.id}</p>)}
    </div>
  );
}
