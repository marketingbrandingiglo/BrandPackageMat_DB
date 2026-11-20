"use client";

import { useTransition } from "react";
import { setLang } from "@/app/lang-actions";
import type { Lang } from "@/lib/i18n/dict";
import styles from "./app-header.module.css";

/** Tombol bahasa Indonesia/Inggris di header (SPEC bagian 4). */
export default function LangToggle({ lang, label }: { lang: Lang; label: string }) {
  const [pending, start] = useTransition();
  return (
    <div className={styles.lang} role="group" aria-label={label}>
      {(["id", "en"] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} disabled={pending} onClick={() => start(() => setLang(l))}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
