"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MultiField, SOCIAL_LABEL } from "@/app/brand-form";
import { SOCIAL_PLATFORMS } from "@/lib/brand-form";
import { DICT, type Lang } from "@/lib/i18n/dict";
import { MATERIAL_KEYS, SIGNATURE_LOGO_FILE, type CompanyData, type MaterialKey, type Materials, type PackageKey } from "@/lib/materials/types";
import { chooseFinal, updateContact } from "./actions";
import { GROUP_KEYS, GROUPS, type GroupKey } from "@/lib/materials/groups";
import formStyles from "@/app/brand-form.module.css";
import styles from "./result.module.css";

type Tab = MaterialKey | "overview";
const PKGS: PackageKey[] = ["A", "B"];

/** Pratinjau email signature: HTML dari Drive, logo diarahkan ke file job. */
function SignaturePreview({ htmlUrl, logoUrl }: { htmlUrl: string; logoUrl: string }) {
  const [doc, setDoc] = useState("");
  useEffect(() => {
    let live = true;
    fetch(htmlUrl)
      .then((r) => r.text())
      .then((html) => {
        const sig = /<!-- signature: mulai -->([\s\S]*)<!-- signature: selesai -->/.exec(html)?.[1] ?? "";
        if (live) setDoc(`<!DOCTYPE html><html><body style="margin:0;padding:20px;background:#fff">${sig.split(`src="${SIGNATURE_LOGO_FILE}"`).join(`src="${logoUrl}"`)}</body></html>`);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [htmlUrl, logoUrl]);
  return <iframe title="Email signature" sandbox="allow-same-origin" srcDoc={doc} className={styles.signature} />;
}

/** Ringkasan satu paket: font, warna, tone. */
function Overview({ m, p, lang }: { m: Materials; p: PackageKey; lang: Lang }) {
  const T = DICT[lang].mat;
  const o = m.overview?.[p];
  if (!o) return null;
  return (
    <div className={styles.overview}>
      <div>
        <p className={styles.label}>{T.fonts}</p>
        <p>{T.headingFont}: <strong>{o.heading.family}</strong> <span className={styles.muted}>· {o.heading.category}</span></p>
        <p>{T.bodyFont}: <strong>{o.body.family}</strong> <span className={styles.muted}>· {o.body.category}</span></p>
      </div>
      <div>
        <p className={styles.label}>{T.colors}</p>
        <div className={styles.swatches}>
          {o.colors.map((c) => (
            <span key={c.hex + c.name.id} title={`${c.name[lang]} ${c.hex}`}>
              <i style={{ background: c.hex }} />
              {c.hex.toUpperCase()}
            </span>
          ))}
        </div>
      </div>
      {o.tone && (
        <div>
          <p className={styles.label}>{T.tone}</p>
          <p>{o.tone.summary[lang]}</p>
          <p className={styles.muted}>{o.tone.traits.map((x) => x[lang]).join(" · ")}</p>
          <p className={styles.tagline}>“{o.tone.tagline[lang]}”</p>
        </div>
      )}
    </div>
  );
}

/** Ubah data kontak sebelum memilih paket. */
function ContactEditor({ jobId, company, lang, onSaved, onCancel }: { jobId: string; company: CompanyData; lang: Lang; onSaved: () => void; onCancel: () => void }) {
  const t = DICT[lang];
  const ref = useRef<HTMLFormElement>(null);
  const addrs = [company.address, ...(company.extraAddresses ?? [])];
  const phones = [company.phone, ...(company.extraPhones ?? [])];
  const [aRows, setARows] = useState(addrs.map((_, i) => i));
  const [pRows, setPRows] = useState(phones.map((_, i) => i));
  const [aMain, setAMain] = useState(0);
  const [pMain, setPMain] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await updateContact(jobId, new FormData(ref.current!));
      if (r.error) return setError(r.error);
      onSaved();
    });
  return (
    <form ref={ref} className={`${formStyles.card} ${styles.editor}`} onSubmit={(e) => e.preventDefault()} noValidate>
      <p className={formStyles.checkTitle}>{t.mat.editContact}</p>
      <p className={formStyles.muted}>{t.mat.editLead}</p>
      <label className={formStyles.field}>
        <span>{t.f.email}</span>
        <input className="input" name="email" type="email" maxLength={120} defaultValue={company.email} />
      </label>
      <MultiField name="address" label={t.f.addresses} ph={t.f.addressPh} t={t} rows={aRows} setRows={setARows} primary={aMain} setPrimary={setAMain} defaults={addrs} />
      <MultiField name="phone" label={t.f.phones} ph={t.f.phonePh} t={t} rows={pRows} setRows={setPRows} primary={pMain} setPrimary={setPMain} type="tel" defaults={phones} />
      <div className={formStyles.socials}>
        {SOCIAL_PLATFORMS.map((p) => (
          <label key={p} className={formStyles.field}>
            <span>{SOCIAL_LABEL[p]}</span>
            <input className="input" name={`social_${p}`} maxLength={60} defaultValue={company.socials.find((s) => s.platform === p)?.handle ?? ""} />
          </label>
        ))}
      </div>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <div className={formStyles.actions}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={pending}>{t.mat.cancel}</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>{pending ? t.mat.saving : t.mat.save}</button>
      </div>
    </form>
  );
}

const groupOf = (k: MaterialKey): GroupKey => GROUPS.find((g) => GROUP_KEYS[g].includes(k))!;

/** Tahap 6d: unduh semua dan checklist (2 sampai 7 materi) untuk paket terpilih. */
function Downloads({ jobId, lang }: { jobId: string; lang: Lang }) {
  const T = DICT[lang].mat;
  const [pick, setPick] = useState<GroupKey[]>([]);
  const ok = pick.length >= 2 && pick.length < GROUPS.length;
  return (
    <div className={styles.downloads}>
      <div className={styles.dlRow}>
        <a className="btn btn-primary" href={`/api/jobs/${jobId}/zip`}>{T.dlAll}</a>
        <p className={styles.muted}>{T.fontNote}</p>
      </div>
      <details className={styles.pick}>
        <summary>{T.pickTitle}</summary>
        <p className={styles.muted}>{T.pickHint}</p>
        <div className={styles.pickList}>
          {GROUPS.map((g) => (
            <label key={g}>
              <input type="checkbox" checked={pick.includes(g)} onChange={(e) => setPick(e.target.checked ? [...pick, g] : pick.filter((x) => x !== g))} /> {T.groups[g]}
            </label>
          ))}
        </div>
        {ok ? (
          <a className="btn btn-secondary" href={`/api/jobs/${jobId}/zip?g=${GROUPS.filter((g) => pick.includes(g)).join(",")}`}>{T.dlPick}</a>
        ) : (
          <button type="button" className="btn btn-secondary" disabled>{T.dlPick}</button>
        )}
      </details>
    </div>
  );
}

/** Tahap 6c: perbandingan Paket A dan B, ubah kontak, pilih paket. */
export default function MaterialsView({ jobId, m, lang, missingVisual, chosen, company, onRebuild, onChosen }: {
  jobId: string;
  m: Materials;
  lang: Lang;
  missingVisual: string[];
  chosen?: PackageKey;
  company?: CompanyData;
  onRebuild: () => void;
  onChosen: () => void;
}) {
  const T = DICT[lang].mat;
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<PackageKey>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const v = `?v=${encodeURIComponent(m.generatedAt)}`;
  const file = (n: string) => `/api/jobs/${jobId}/file/${n}${v}`;
  const tabs: Tab[] = ["overview", "guideline", ...MATERIAL_KEYS.filter((x) => x !== "guideline")];
  const shown = chosen ? [chosen] : PKGS;

  const choose = (p: PackageKey) =>
    start(async () => {
      setError(undefined);
      const r = await chooseFinal(jobId, p);
      if (r.error) return setError(r.error);
      setConfirm(undefined);
      onChosen();
    });

  return (
    <div className={styles.result}>
      {chosen ? (
        <div className="alert alert-ok">
          <strong>{T.chosen(chosen)}</strong>
          <br />
          {T.chosenLead}
        </div>
      ) : (
        <div className={styles.head}>
          <div>
            <h2 className={styles.h2}>{T.ready}</h2>
            <p className={styles.muted}>{T.compareLead}</p>
          </div>
          {company && !editing && <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>{T.editContact}</button>}
        </div>
      )}
      {chosen && <Downloads jobId={jobId} lang={lang} />}
      {editing && company && <ContactEditor jobId={jobId} company={company} lang={lang} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onRebuild(); }} />}
      {missingVisual.length > 0 && <p className="alert alert-warn">{T.noVisual(missingVisual.map((p) => `${T.pkg} ${p}`).join(lang === "en" ? " and " : " dan "))}</p>}

      {confirm && (
        <div className={styles.confirm} role="alertdialog" aria-labelledby="konfirmasi-pilih">
          <p id="konfirmasi-pilih"><strong>{T.confirmTitle(confirm)}</strong></p>
          <p>{T.confirmBody(confirm, confirm === "A" ? "B" : "A")}</p>
          {error && <p className="alert alert-error">{error}</p>}
          <div className={styles.confirmActions}>
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setConfirm(undefined)}>{T.cancel}</button>
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => choose(confirm)}>{pending ? T.saving : T.confirmYes}</button>
          </div>
        </div>
      )}

      <div className={styles.tabs} role="tablist">
        {tabs.map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{key === "overview" ? T.overview : T.labels[key]}</button>
        ))}
      </div>
      <div className={styles.compare} data-kind={tab} data-single={chosen ? "" : undefined}>
        {shown.map((p) => {
          const pk = tab === "overview" ? undefined : m.items[tab]?.[p];
          return (
            <section key={p} className={styles.pkgCol}>
              <div className={styles.colHead}>
                <p className="eyebrow">{T.pkg} {p}</p>
                {!chosen && !editing && <button type="button" className="btn btn-primary" onClick={() => setConfirm(p)}>{T.choose(p)}</button>}
                {chosen && tab !== "overview" && (
                  <a className="btn btn-secondary" href={`/api/jobs/${jobId}/zip?g=${groupOf(tab)}`}>{T.dlOne(T.groups[groupOf(tab)])}</a>
                )}
              </div>
              {tab === "overview" ? (
                <Overview m={m} p={p} lang={lang} />
              ) : (
                <>
                  {tab === "emailSignature" && pk && <SignaturePreview htmlUrl={file(pk.files[0])} logoUrl={file(pk.files[1])} />}
                  <div className={styles.previews}>
                    {pk?.previews.map((n) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={n} src={file(n)} alt={`${T.labels[tab]} ${p}`} loading="lazy" />
                    ))}
                  </div>
                  {pk?.issues.length ? pk.issues.map((i, n) => <p key={`${n}-${i}`} className="alert alert-warn">{i}</p>) : <p className={styles.muted}>{T.checksOk}</p>}
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
