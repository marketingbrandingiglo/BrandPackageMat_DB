"use client";

import { useActionState, useState } from "react";
import { checkLogo, type LabLogoResult } from "./actions";
import LogoDropzone from "@/app/_components/logo-dropzone";
import PaletteView from "./palette-view";
import styles from "./lab.module.css";

const LEVEL_CLASS = { hard: "alert-error", warn: "alert-warn", info: "alert-info" } as const;
const LEVEL_LABEL = { hard: "Peringatan keras", warn: "Peringatan", info: "Info" } as const;
const STRATEGY_LABEL = {
  original: "Logo asli",
  mono: "Versi satu warna",
  plate: "Di atas bidang terang",
  unavailable: "Tampil berkotak (latar tidak transparan)",
} as const;

function fmtBytes(n: number) {
  if (n < 1024) return `${n} byte`;
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function LogoLab({ maxBytes }: { maxBytes: number }) {
  const [state, action, pending] = useActionState<LabLogoResult, FormData>(checkLogo, {});
  const [fileName, setFileName] = useState<string>("");
  const r = state.report;

  return (
    <div className={styles.lab}>
      <form action={action} className={styles.upload}>
        <LogoDropzone name="logo" maxBytes={maxBytes} onChange={(f) => setFileName(f?.name ?? "")} disabled={pending} />
        <button type="submit" className="btn btn-primary" disabled={pending || !fileName}>
          {pending ? "Memeriksa…" : "Periksa logo dan palet"}
        </button>
      </form>

      {state.error && <p className="alert alert-error" role="alert">{state.error}</p>}

      {r && (
        <div className={styles.result}>
          <dl className={styles.facts}>
            <div><dt>File</dt><dd>{state.fileName}</dd></div>
            <div><dt>Format</dt><dd>{r.kind.toUpperCase()}</dd></div>
            <div><dt>Ukuran file</dt><dd>{fmtBytes(r.bytes)}</dd></div>
            <div><dt>Dimensi</dt><dd>{r.width && r.height ? `${r.width} × ${r.height}${r.kind === "png" ? " px" : ""}` : "—"}</dd></div>
            <div><dt>Latar transparan</dt><dd>{r.transparentBackground ? "Ya" : "Tidak"}</dd></div>
            <div><dt>Satu warna</dt><dd>{r.monochrome ? "Ya" : "Tidak"}</dd></div>
          </dl>

          <div className={styles.warnings}>
            {r.warnings.length === 0 && <p className="alert alert-ok">Tidak ada peringatan.</p>}
            {r.warnings.map((w) => (
              <p key={w.code} className={`alert ${LEVEL_CLASS[w.level]}`}>
                <strong>{LEVEL_LABEL[w.level]}:</strong> {w.message}
              </p>
            ))}
          </div>

          <div className={styles.previews}>
            <figure>
              <div className={styles.tile} data-bg="light">
                {r.onLight.strategy === "mono" && r.previews.monoDark ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.previews.monoDark} alt="Logo di latar putih" />
                ) : r.onLight.strategy === "plate" ? (
                  <span className={styles.plate} data-tone="dark">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.previews.original} alt="Logo di latar putih" />
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.previews.original} alt="Logo di latar putih" />
                )}
              </div>
              <figcaption>
                Latar putih · <strong>{STRATEGY_LABEL[r.onLight.strategy]}</strong>
                <span className={styles.muted}> · {(r.onLight.lowContrastShare * 100).toFixed(0)}% piksel kurang kontras</span>
              </figcaption>
            </figure>
            <figure>
              <div className={styles.tile} data-bg="dark">
                {r.onDark.strategy === "mono" && r.previews.monoWhite ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.previews.monoWhite} alt="Logo di latar gelap" />
                ) : r.onDark.strategy === "plate" ? (
                  <span className={styles.plate} data-tone="light">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.previews.original} alt="Logo di latar gelap" />
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.previews.original} alt="Logo di latar gelap" />
                )}
              </div>
              <figcaption>
                Latar gelap · <strong>{STRATEGY_LABEL[r.onDark.strategy]}</strong>
                <span className={styles.muted}> · {(r.onDark.lowContrastShare * 100).toFixed(0)}% piksel kurang kontras</span>
              </figcaption>
            </figure>
            <figure>
              <div className={styles.tile} data-bg="checker">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.previews.original} alt="Logo asli" />
              </div>
              <figcaption>Logo asli (pola kotak = transparan)</figcaption>
            </figure>
          </div>
          {r.kind === "svg" && (
            <p className={styles.muted}>
              SVG disanitasi{r.removed.length ? ` (${r.removed.length} bagian dibuang)` : " (tidak ada yang dibuang)"}.
              {r.hasMonoSvg ? " Versi SVG satu warna (putih/gelap) juga tersedia untuk materi." : ""}
            </p>
          )}
          {state.palette && <PaletteView p={state.palette} />}
        </div>
      )}
    </div>
  );
}
