"use client";

import { useActionState, useState } from "react";
import type { PublicUser } from "@/lib/auth/users";
import { PASSWORD_MIN } from "@/lib/auth/validate";
import { createUser, deleteUser, resetPassword, setActive, type FormState } from "./actions";
import styles from "./admin.module.css";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p className="alert alert-error" role="alert">{state.error}</p>;
  if (state.ok) return <p className="alert alert-ok" role="status">{state.ok}</p>;
  return null;
}

/** Password acak 16 karakter tanpa karakter yang mirip (0/O, 1/l). */
function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function PasswordInput({ id }: { id: string }) {
  const [value, setValue] = useState("");
  return (
    <div className={styles.pwRow}>
      <input id={id} name="password" type="text" className="input" minLength={PASSWORD_MIN} required autoComplete="new-password" value={value} onChange={(e) => setValue(e.target.value)} placeholder={`Minimal ${PASSWORD_MIN} karakter`} />
      <button type="button" className={`btn btn-tonal ${styles.nowrap}`} onClick={() => setValue(randomPassword())}>Buat acak</button>
    </div>
  );
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createUser, {});
  return (
    <form action={action} className={styles.createForm}>
      <Message state={state} />
      <div className={styles.grid}>
        <div>
          <label className="field-label" htmlFor="new-name">Nama</label>
          <input id="new-name" name="name" className="input" required maxLength={100} />
        </div>
        <div>
          <label className="field-label" htmlFor="new-email">Email kantor</label>
          <input id="new-email" name="email" type="email" className="input" required />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="new-password">Password</label>
        <PasswordInput id="new-password" />
        <p className={styles.hint}>Salin password ini dan berikan langsung ke user. Password tidak bisa dilihat lagi setelah disimpan.</p>
      </div>
      <button type="submit" className={`btn btn-primary ${styles.submitInline}`} disabled={pending}>{pending ? "Menyimpan…" : "Tambah user"}</button>
    </form>
  );
}

export function UserRow({ user, isSelf, created, lastLogin }: { user: PublicUser; isSelf: boolean; created: string; lastLogin: string }) {
  const [activeState, activeAction] = useActionState<FormState, FormData>(setActive, {});
  const [pwState, pwAction] = useActionState<FormState, FormData>(resetPassword, {});
  const [delState, delAction] = useActionState<FormState, FormData>(deleteUser, {});
  const [open, setOpen] = useState<"none" | "password" | "delete">("none");
  return (
    <div className={styles.row}>
      <div className={styles.rowHead}>
        <div>
          <strong>{user.name || "—"}</strong>{" "}
          <span className={styles.badge} data-role={user.role}>{user.role === "superadmin" ? "Super admin" : "User"}</span>{" "}
          {!user.active && <span className={styles.badge} data-off>Nonaktif</span>}
          <div className={styles.muted}>{user.email}</div>
          <div className={styles.meta}>Dibuat {created} · Login terakhir {lastLogin}</div>
        </div>
        {!isSelf && (
          <div className={styles.actions}>
            <form action={activeAction}>
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="active" value={user.active ? "0" : "1"} />
              <button type="submit" className={styles.neutral}>{user.active ? "Nonaktifkan" : "Aktifkan"}</button>
            </form>
            <button type="button" className={styles.neutral} onClick={() => setOpen(open === "password" ? "none" : "password")}>Ganti password</button>
            <button type="button" className={styles.dangerOutline} onClick={() => setOpen(open === "delete" ? "none" : "delete")}>Hapus</button>
          </div>
        )}
      </div>
      <Message state={activeState} />
      <Message state={pwState} />
      <Message state={delState} />
      {open === "password" && (
        <form action={pwAction} className={styles.inline}>
          <input type="hidden" name="id" value={user.id} />
          <PasswordInput id={`pw-${user.id}`} />
          <button type="submit" className={`btn btn-primary ${styles.submitInline}`}>Simpan password</button>
        </form>
      )}
      {open === "delete" && (
        <form action={delAction} className={styles.inline}>
          <input type="hidden" name="id" value={user.id} />
          <label className="field-label" htmlFor={`del-${user.id}`}>Ketik <strong>{user.email}</strong> untuk menghapus permanen</label>
          <div className={styles.pwRow}>
            <input id={`del-${user.id}`} name="confirm" className="input" autoComplete="off" />
            <button type="submit" className={`btn btn-primary ${styles.nowrap}`}>Hapus permanen</button>
          </div>
        </form>
      )}
    </div>
  );
}
