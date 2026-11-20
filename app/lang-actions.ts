"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANG_COOKIE } from "@/lib/i18n/dict";

/** Tombol bahasa di header (SPEC bagian 4). */
export async function setLang(lang: string) {
  (await cookies()).set(LANG_COOKIE, lang === "en" ? "en" : "id", { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax", httpOnly: false, secure: process.env.NODE_ENV === "production" });
  revalidatePath("/", "layout");
}
