"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_LABEL, EXPRESSIVE_LABEL, type FontCategory } from "@/lib/brand/fonts";
import styles from "./font.module.css";

export interface FontCard {
  family: string;
  category: FontCategory;
  styles: string[];
  expressive: Record<string, number>;
  headingOnly: boolean;
  popularity: number;
  license: string;
  regular: string;
  bold?: string;
  missingNice: string;
  specimen: string;
}

const CATS = Object.keys(CATEGORY_LABEL) as FontCategory[];
const TAGS = Object.keys(EXPRESSIVE_LABEL);
const BODY = "Kami membantu usaha Anda tumbuh lewat layanan yang jujur, cepat, dan tepat. Hubungi kami: 0812 3456 7890.";

const faceName = (f: FontCard) => `bpa-${f.regular.split("/")[0]}`;
const fileUrl = (rel: string) => `/admin/lab/font/file/${rel}`;

/** Muat font hanya saat kartunya terlihat. */
function useLazyFont(f: FontCard) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const name = faceName(f);
        const faces = [new FontFace(name, `url(${fileUrl(f.regular)})`, { weight: "400" })];
        if (f.bold) faces.push(new FontFace(name, `url(${fileUrl(f.bold)})`, { weight: "700" }));
        Promise.all(faces.map((x) => x.load()))
          .then((loaded) => {
            loaded.forEach((x) => document.fonts.add(x));
            if (!cancelled) setReady(true);
          })
          .catch(() => {});
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [f]);
  return { ref, ready };
}

function topTags(e: Record<string, number>, n = 3) {
  return Object.entries(e)
    .filter(([k]) => EXPRESSIVE_LABEL[k])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function Card({ f, sample, marked, onMark }: { f: FontCard; sample: string; marked: boolean; onMark: () => void }) {
  const { ref, ready } = useLazyFont(f);
  const ff = ready ? `"${faceName(f)}", system-ui` : "system-ui";
  return (
    <div ref={ref} className={styles.card} data-marked={marked || undefined}>
      <div className={styles.cardHead}>
        <div>
          <strong className={styles.name}>{f.family}</strong>
          <div className={styles.badges}>
            <span>{CATEGORY_LABEL[f.category].id}</span>
            {f.headingOnly && <span data-tone="warn">Heading saja</span>}
            <span>{f.bold ? "Regular + Bold" : "Satu bobot"}</span>
            <span>{f.license}</span>
          </div>
        </div>
        <button type="button" className={styles.mark} aria-pressed={marked} onClick={onMark} title="Tandai untuk dibuang dari daftar">
          {marked ? "Ditandai" : "Tandai"}
        </button>
      </div>
      <div className={styles.sample} style={{ fontFamily: ff, opacity: ready ? 1 : 0.25 }}>
        <p className={styles.heading} style={{ fontWeight: f.bold ? 700 : 400 }}>{sample || f.family}</p>
        {!f.headingOnly && <p className={styles.body}>{BODY}</p>}
        {f.headingOnly && <p className={styles.headingRegular}>AaBbCc 0123 · {sample || f.family}</p>}
      </div>
      <div className={styles.meta}>
        <span>
          {topTags(f.expressive).map(([k, v]) => (
            <i key={k}>{EXPRESSIVE_LABEL[k].id} {v}</i>
          ))}
        </span>
        <span>{f.styles.map((s) => s.split("/")[1]).join(", ")}</span>
        <span>
          Populer #{f.popularity} · <a href={f.specimen} target="_blank" rel="noreferrer">Google Fonts</a>
          {f.missingNice && <> · tanpa {f.missingNice}</>}
        </span>
      </div>
    </div>
  );
}

export default function FontBrowser({ fonts }: { fonts: FontCard[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<FontCategory | "all">("all");
  const [tag, setTag] = useState("");
  const [bodyOnly, setBodyOnly] = useState(false);
  const [sample, setSample] = useState("Sejahtera Bersama");
  const [marked, setMarked] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: fonts.length };
    for (const f of fonts) c[f.category] = (c[f.category] ?? 0) + 1;
    return c;
  }, [fonts]);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const xs = fonts.filter(
      (f) => (cat === "all" || f.category === cat) && (!bodyOnly || !f.headingOnly) && (!ql || f.family.toLowerCase().includes(ql)),
    );
    return tag ? [...xs].sort((a, b) => (b.expressive[tag] ?? 0) - (a.expressive[tag] ?? 0)) : xs;
  }, [fonts, q, cat, tag, bodyOnly]);

  const toggle = (name: string) => setMarked((m) => (m.includes(name) ? m.filter((x) => x !== name) : [...m, name]));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(marked.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard tidak tersedia */
    }
  };

  return (
    <div className={styles.browser}>
      <div className={styles.controls}>
        <div className={styles.cats} role="group" aria-label="Kategori">
          {(["all", ...CATS] as const).map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c === "all" ? "Semua" : CATEGORY_LABEL[c].id} <small>{counts[c] ?? 0}</small>
            </button>
          ))}
        </div>
        <div className={styles.row}>
          <label>
            <span>Cari nama</span>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="mis. Inter" />
          </label>
          <label>
            <span>Teks contoh</span>
            <input className="input" value={sample} onChange={(e) => setSample(e.target.value)} maxLength={60} />
          </label>
          <label>
            <span>Urutkan menurut karakter</span>
            <select className="input" value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">Popularitas (bawaan)</option>
              {TAGS.map((t) => (
                <option key={t} value={t}>{EXPRESSIVE_LABEL[t].id} ({t})</option>
              ))}
            </select>
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={bodyOnly} onChange={(e) => setBodyOnly(e.target.checked)} />
            <span>Hanya yang bisa untuk teks isi</span>
          </label>
        </div>
        <p className={styles.count}>
          Menampilkan {list.length} dari {fonts.length}. Angka karakter = skor tag Google Fonts (0-100).
        </p>
      </div>

      <div className={styles.grid}>
        {list.map((f) => (
          <Card key={f.family} f={f} sample={sample} marked={marked.includes(f.family)} onMark={() => toggle(f.family)} />
        ))}
      </div>

      {marked.length > 0 && (
        <div className={styles.tray} role="status">
          <span>
            <strong>{marked.length} font ditandai</strong> untuk dibuang. Salin daftarnya lalu kirim ke Claude Code.
          </span>
          <span className={styles.trayActions}>
            <button type="button" className="btn btn-ghost" onClick={() => setMarked([])}>Batal</button>
            <button type="button" className="btn btn-primary" onClick={copy}>{copied ? "Tersalin" : "Salin nama"}</button>
          </span>
        </div>
      )}
    </div>
  );
}
