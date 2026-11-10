"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  clearSessionCookie,
  clientMeta,
  loginLimiters,
  sessionCookieName,
  sessions,
  setSessionCookie,
  users,
} from "@/lib/auth/server";
import { verifyPassword } from "@/lib/auth/password";
import { EMAIL_MAX, PASSWORD_MAX, normalizeEmail } from "@/lib/auth/validate";

export interface LoginState {
  error?: string;
  email?: string;
}

// Satu pesan untuk semua kegagalan, agar tidak membocorkan apakah email terdaftar (SPEC bagian 2).
const GENERIC = "Email atau password salah.";

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(form.get("email") ?? "")).slice(0, EMAIL_MAX);
  const password = String(form.get("password") ?? "").slice(0, PASSWORD_MAX);
  if (!email || !password) return { error: "Email dan password wajib diisi.", email };

  const meta = await clientMeta();
  const limit = loginLimiters();
  const [byIp, byEmail] = await Promise.all([
    limit.ip.limit(meta.ip ?? "unknown"),
    limit.email.limit(email),
  ]);
  if (!byIp.success || !byEmail.success) {
    const reset = Math.max(byIp.success ? 0 : byIp.reset, byEmail.success ? 0 : byEmail.reset);
    const minutes = Math.max(1, Math.ceil((reset - Date.now()) / 60000));
    return { error: `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.`, email };
  }

  const store = users();
  const user = await store.byEmail(email);
  const ok = await verifyPassword(user?.passwordHash, password);
  if (!user || !ok || !user.active) return { error: GENERIC, email };

  const { cookie } = await sessions().create(user.id, meta);
  await store.update(user.id, { lastLoginAt: new Date().toISOString() });
  await limit.email.resetUsedTokens(email);
  await setSessionCookie(cookie);
  redirect("/");
}

export async function logout(): Promise<void> {
  await sessions().destroy((await cookies()).get(sessionCookieName())?.value);
  await clearSessionCookie();
  redirect("/login");
}
