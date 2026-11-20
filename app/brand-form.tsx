"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import LogoDropzone from "@/app/_components/logo-dropzone";
import { checkUserLogo, submitBrand, type LogoCheck } from "./actions";
import { parseBrandForm, SOCIAL_PLATFORMS } from "@/lib/brand-form";
import { DICT, type Lang } from "@/lib/i18n/dict";
import styles from "./brand-form.module.css";

export interface FormIndustry {
  id: string;
  label: string;
  freeText?: boolean;
}

const SOCIAL_LABEL: Record<(typeof SOCIAL_PLATFORMS)[number], string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
};
const STEP_FIELDS = [["logo", "companyName", "industry", "industryOther"], ["email", "address", "phone"]];
const MAX_ROWS = 3;
const LEVEL = { hard: "alert-error", warn: "alert-warn", info: "alert-info" } as const;

/** Daftar isian berulang (alamat/telepon) dengan tepat satu "utama". */
function MultiField({ name, label, ph, t, rows, setRows, primary, setPrimary, type = "text" }: {
  name: string;
  label: string;
  ph: string;
  t: (typeof DICT)["id"];
  rows: number[];
  setRows: (r: number[]) => void;
  primary: number;
  setPrimary: (i: number) => void;
  type?: string;
}) {
  return (
    <fieldset className={styles.multi}>
      <legend>{label}</legend>
      {rows.map((key, i) => (
        <div key={key} className={styles.row}>
          <input className="input" name={name} type={type} placeholder={ph} maxLength={name === "address" ? 160 : 30} aria-label={`${label} ${i + 1}`} />
          <label className={styles.primary}>
            <input type="radio" name={`${name}Primary`} value={i} checked={primary === i} onChange={() => setPrimary(i)} /> {t.f.primary}
          </label>
          {rows.length > 1 && (
            <button type="button" className={styles.remove} onClick={() => { setRows(rows.filter((_, j) => j !== i)); if (primary >= i && primary > 0) setPrimary(primary - 1); }}>
              {t.f.remove}
            </button>
          )}
        </div>
      ))}
      {rows.length < MAX_ROWS && (
        <button type="button" className={styles.add} onClick={() => setRows([...rows, Math.max(...rows) + 1])}>+ {t.f.add}</button>
      )}
    </fieldset>
  );
}

export default function BrandForm({ lang, industries, maxBytes }: { lang: Lang; industries: FormIndustry[]; maxBytes: number }) {
  const t = DICT[lang];
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>();
  const [check, setCheck] = useState<LogoCheck>();
  const [checkedFile, setCheckedFile] = useState<File | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [industry, setIndustry] = useState("");
  const [addr, setAddr] = useState([0]);
  const [phones, setPhones] = useState([0]);
  const [addrMain, setAddrMain] = useState(0);
  const [phoneMain, setPhoneMain] = useState(0);
  const [summary, setSummary] = useState<[string, string][]>([]);
  const [pending, start] = useTransition();
  const ind = industries.find((x) => x.id === industry);

  const focus = (field?: string) => field && (formRef.current?.querySelector(`[name="${field}"]`) as HTMLElement | null)?.focus();

  const validate = (s: number): boolean => {
    const fd = new FormData(formRef.current!);
    if (s === 0 && !file) {
      setError(t.err.logo);
      return false;
    }
    const p = parseBrandForm(fd, lang);
    if ("error" in p && p.field && STEP_FIELDS.slice(0, s + 1).flat().includes(p.field)) {
      setError(p.error);
      focus(p.field);
      return false;
    }
    setError(undefined);
    if (s === 1 && !("error" in p)) {
      const c = p.company;
      setSummary([
        [t.f.company, c.name],
        [t.f.industry, ind?.freeText ? `${ind.label}: ${p.industryOther}` : (ind?.label ?? "")],
        [t.f.email, c.email],
        [t.f.addresses, [`${c.address} (${t.f.primary.toLowerCase()})`, ...(c.extraAddresses ?? [])].join(" | ")],
        [t.f.phones, [`${c.phone} (${t.f.primary.toLowerCase()})`, ...(c.extraPhones ?? [])].join(" | ")],
        [t.f.socials, c.socials.map((x) => `${SOCIAL_LABEL[x.platform]} ${x.handle}`).join(", ") || t.summary.none],
      ]);
    }
    return true;
  };

  const next = () => {
    if (!validate(step)) return;
    if (step === 0 && file && file !== checkedFile) {
      // Cek logo di server sebelum lanjut; peringatan tidak menghalangi.
      const fd = new FormData();
      fd.set("logo", file);
      start(async () => {
        const r = await checkUserLogo(fd);
        if (r.error) {
          setError(r.error);
          return;
        }
        setCheck(r);
        setCheckedFile(file);
      });
      return;
    }
    setStep(step + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = () =>
    start(async () => {
      setError(undefined);
      const r = await submitBrand(new FormData(formRef.current!));
      if (r.error) {
        setError(r.error);
        const s = STEP_FIELDS.findIndex((f) => r.field && f.includes(r.field));
        if (s >= 0) setStep(s);
        return;
      }
      router.push(`/hasil/${r.jobId}`);
    });

  return (
    <form ref={formRef} className={styles.form} onSubmit={(e) => e.preventDefault()} onInput={() => error && setError(undefined)} noValidate>
      <ol className={styles.steps}>
        {t.steps.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} data-done={i < step || undefined}>
            <span>{i + 1}</span> {s}
          </li>
        ))}
      </ol>
      <p className="eyebrow">{t.stepOf(step + 1, 3)}</p>

      <section hidden={step !== 0} className={styles.card}>
        <label className={styles.field}>
          <span>{t.f.logo}</span>
          <LogoDropzone name="logo" lang={lang} maxBytes={maxBytes} disabled={pending} onChange={(f) => { setFile(f); setCheck(undefined); setCheckedFile(null); }} />
        </label>
        {check && (
          <div className={styles.check}>
            <p className={styles.checkTitle}>{t.check.title}</p>
            <div className={styles.checkBody}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {check.preview && <img src={check.preview} alt="" className={styles.checkLogo} />}
              <div>
                {check.warnings?.length ? check.warnings.map((w) => <p key={w.message} className={`alert ${LEVEL[w.level]}`}>{w.message}</p>) : <p className="alert alert-success">{t.check.ok}</p>}
                {check.warnings?.some((w) => w.level !== "info") && <p className={styles.muted}>{t.check.continueAnyway}</p>}
              </div>
            </div>
          </div>
        )}
        <label className={styles.field}>
          <span>{t.f.company}</span>
          <input className="input" name="companyName" maxLength={80} placeholder={t.f.companyPh} autoComplete="organization" />
        </label>
        <label className={styles.field}>
          <span>{t.f.industry}</span>
          <select className="input" name="industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="">{t.f.industryPick}</option>
            {industries.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
        {ind?.freeText && (
          <label className={styles.field}>
            <span>{t.f.industryOther}</span>
            <input className="input" name="industryOther" maxLength={60} placeholder={t.f.industryOtherPh} />
          </label>
        )}
      </section>

      <section hidden={step !== 1} className={styles.card}>
        <label className={styles.field}>
          <span>{t.f.email}</span>
          <input className="input" name="email" type="email" maxLength={120} placeholder={t.f.emailPh} autoComplete="email" />
        </label>
        <MultiField name="address" label={t.f.addresses} ph={t.f.addressPh} t={t} rows={addr} setRows={setAddr} primary={addrMain} setPrimary={setAddrMain} />
        <MultiField name="phone" label={t.f.phones} ph={t.f.phonePh} t={t} rows={phones} setRows={setPhones} primary={phoneMain} setPrimary={setPhoneMain} type="tel" />
        <p className={styles.muted}>{t.f.extraNote}</p>
        <fieldset className={styles.multi}>
          <legend>{t.f.socials}</legend>
          <p className={styles.muted}>{t.f.socialsNote}</p>
          <div className={styles.socials}>
            {SOCIAL_PLATFORMS.map((p) => (
              <label key={p} className={styles.field}>
                <span>{SOCIAL_LABEL[p]}</span>
                <input className="input" name={`social_${p}`} maxLength={60} placeholder={p === "whatsapp" ? "0812..." : "handle"} />
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section hidden={step !== 2} className={styles.card}>
        <p className={styles.checkTitle}>{t.summary.title}</p>
        <dl className={styles.summary}>
          {check?.preview && (
            <div>
              <dt>{t.f.logo}</dt>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <dd><img src={check.preview} alt="" className={styles.summaryLogo} /></dd>
            </div>
          )}
          {summary.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          <div><dt>{t.f.langOut}</dt><dd>{lang === "en" ? "English" : "Indonesia"}</dd></div>
        </dl>
        <label className={styles.visual}>
          <input type="checkbox" name="wantVisual" />
          <span>
            <strong>{t.f.visual}</strong>
            <small>{t.f.visualNote}</small>
          </span>
        </label>
      </section>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <div className={styles.actions}>
        {step > 0 ? <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setStep(step - 1)}>{t.btn.back}</button> : <span />}
        {step < 2 ? (
          <button type="button" className="btn btn-primary" disabled={pending} onClick={next}>
            {pending ? t.btn.checking : step === 0 && file && file !== checkedFile ? t.btn.checkLogo : t.btn.next}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>{pending ? t.btn.sending : t.btn.submit}</button>
        )}
      </div>
    </form>
  );
}
