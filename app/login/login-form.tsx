"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "./actions";
import styles from "./login.module.css";

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);
  return (
    <form action={action} className={styles.form} noValidate>
      {state.error && (
        <div className="alert alert-error" role="alert">
          {state.error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="field-label">Email kantor</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" defaultValue={state.email} />
      </div>
      <div>
        <label htmlFor="password" className="field-label">Password</label>
        <div className={styles.passwordWrap}>
          <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="input" />
          <button
            type="button"
            className={styles.eye}
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
            aria-pressed={show}
          >
            <EyeIcon off={show} />
          </button>
        </div>
      </div>
      <button type="submit" className={`btn btn-primary btn-block ${styles.submit}`} disabled={pending}>
        {pending ? "Memproses…" : "Masuk"}
      </button>
    </form>
  );
}
