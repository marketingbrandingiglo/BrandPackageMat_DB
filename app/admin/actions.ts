"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin, sessions, users } from "@/lib/auth/server";
import { NAME_MAX, isValidEmail, normalizeEmail, passwordProblem } from "@/lib/auth/validate";

export interface FormState {
  error?: string;
  ok?: string;
}

export async function createUser(_prev: FormState, form: FormData): Promise<FormState> {
  const { user: admin } = await requireSuperAdmin();
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const name = String(form.get("name") ?? "").trim().slice(0, NAME_MAX);
  const password = String(form.get("password") ?? "");
  if (!isValidEmail(email)) return { error: "Format email tidak valid." };
  if (!name) return { error: "Nama wajib diisi." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  try {
    await users().create({ email, name, password, role: "user", createdBy: admin.id });
  } catch (e) {
    if (e instanceof Error && e.message === "EMAIL_TAKEN") return { error: "Email sudah terdaftar." };
    throw e;
  }
  revalidatePath("/admin");
  return { ok: `User ${email} dibuat.` };
}

/** Aksi pada user lain. Super admin tidak bisa menonaktifkan atau menghapus dirinya sendiri. */
async function target(form: FormData) {
  const { user: admin } = await requireSuperAdmin();
  const id = String(form.get("id") ?? "");
  const u = await users().byId(id);
  if (!u) return { error: "User tidak ditemukan." } as const;
  if (u.id === admin.id) return { error: "Tidak bisa mengubah akun super admin sendiri dari sini." } as const;
  return { u } as const;
}

export async function setActive(_prev: FormState, form: FormData): Promise<FormState> {
  const t = await target(form);
  if ("error" in t) return { error: t.error };
  const active = form.get("active") === "1";
  await users().update(t.u.id, { active });
  if (!active) await sessions().destroyAllForUser(t.u.id);
  revalidatePath("/admin");
  return { ok: `${t.u.email} ${active ? "diaktifkan" : "dinonaktifkan"}.` };
}

export async function resetPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const t = await target(form);
  if ("error" in t) return { error: t.error };
  const password = String(form.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  await users().setPassword(t.u.id, password);
  await sessions().destroyAllForUser(t.u.id);
  revalidatePath("/admin");
  return { ok: `Password ${t.u.email} diganti. Sesi lamanya dihentikan.` };
}

export async function deleteUser(_prev: FormState, form: FormData): Promise<FormState> {
  const t = await target(form);
  if ("error" in t) return { error: t.error };
  if (form.get("confirm") !== t.u.email) return { error: "Ketik email user untuk konfirmasi penghapusan." };
  await sessions().destroyAllForUser(t.u.id);
  await users().remove(t.u.id);
  revalidatePath("/admin");
  // Baris user hilang setelah dihapus, jadi pesan ditampilkan di atas halaman.
  redirect(`/admin?dihapus=${encodeURIComponent(t.u.email)}`);
}
