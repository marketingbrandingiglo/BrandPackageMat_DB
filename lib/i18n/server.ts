import "server-only";
import { cookies } from "next/headers";
import { DICT, LANG_COOKIE, type Lang } from "./dict";

/** Bahasa antarmuka dari cookie (bawaan Indonesia). */
export async function getLang(): Promise<Lang> {
  return (await cookies()).get(LANG_COOKIE)?.value === "en" ? "en" : "id";
}

export async function getDict() {
  return DICT[await getLang()];
}
