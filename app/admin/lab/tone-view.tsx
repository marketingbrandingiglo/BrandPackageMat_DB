"use client";

import { useState } from "react";
import { FORMALITY_LABEL } from "@/lib/brand/industries";
import type { PackageTone, Tone } from "@/lib/brand/tone";
import styles from "./lab.module.css";

type Lang = "id" | "en";

const L = {
  id: { personality: "Kepribadian", voice: "Cara bicara", address: "Sapaan", formality: "Formalitas", sentences: "Kalimat", do: "Lakukan", dont: "Hindari", examples: "Contoh", taglines: "Usulan tagline", email: "Pembuka email", cta: "Ajakan (CTA)", about: "Tentang kami" },
  en: { personality: "Personality", voice: "Voice", address: "Address", formality: "Formality", sentences: "Sentences", do: "Do", dont: "Don't", examples: "Examples", taglines: "Tagline ideas", email: "Email opening", cta: "Call to action", about: "About us" },
};

function PackageTone({ k, p, lang }: { k: "A" | "B"; p: PackageTone; lang: Lang }) {
  const t = L[lang];
  return (
    <div className={styles.toneCard}>
      <p className="eyebrow">Paket {k}</p>
      <p className={styles.toneSummary}>{p.summary[lang]}</p>
      <h5>{t.personality}</h5>
      <ul>
        {p.personality.map((x) => (
          <li key={x.trait.id}><strong>{x.trait[lang]}</strong>: {x.desc[lang]}</li>
        ))}
      </ul>
      <h5>{t.voice}</h5>
      <dl className={styles.pairMeta}>
        <div><dt>{t.address}</dt><dd>{p.voice.address[lang]}</dd></div>
        <div><dt>{t.formality}</dt><dd>{FORMALITY_LABEL[p.voice.formality][lang]}</dd></div>
        <div><dt>{t.sentences}</dt><dd>{p.voice.sentences[lang]}</dd></div>
      </dl>
      <div className={styles.doDont}>
        <div><h5>{t.do}</h5><ul>{p.do.map((x) => <li key={x.id}>{x[lang]}</li>)}</ul></div>
        <div><h5>{t.dont}</h5><ul>{p.dont.map((x) => <li key={x.id}>{x[lang]}</li>)}</ul></div>
      </div>
      <h5>{t.examples}</h5>
      <p className={styles.muted}>{t.taglines}</p>
      <ul>{p.examples.taglines.map((x) => <li key={x.id}>&ldquo;{x[lang]}&rdquo;</li>)}</ul>
      <p className={styles.muted}>{t.email}</p>
      <p>{p.examples.emailOpening[lang]}</p>
      <p className={styles.muted}>{t.cta}</p>
      <p>{p.examples.cta[lang]}</p>
      <p className={styles.muted}>{t.about}</p>
      <p>{p.examples.about[lang]}</p>
    </div>
  );
}

export default function ToneView({ tone }: { tone: Tone }) {
  const [lang, setLang] = useState<Lang>("id");
  return (
    <div className={styles.group}>
      <div className={styles.toneHead}>
        <h4>Tone of voice (3e)</h4>
        <div className={styles.langToggle} role="group" aria-label="Bahasa">
          {(["id", "en"] as const).map((x) => (
            <button key={x} type="button" aria-pressed={lang === x} onClick={() => setLang(x)}>{x === "id" ? "Indonesia" : "English"}</button>
          ))}
        </div>
      </div>
      <p className="alert alert-info">{lang === "id" ? "Hipotesis, bukan keputusan akhir. " : "A hypothesis, not a final decision. "}{tone.basis[lang]}</p>
      <div className={styles.packages}>
        <PackageTone k="A" p={tone.A} lang={lang} />
        <PackageTone k="B" p={tone.B} lang={lang} />
      </div>
    </div>
  );
}
