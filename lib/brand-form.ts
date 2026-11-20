import { INDUSTRIES } from "@/lib/brand/industries";
import { DICT } from "@/lib/i18n/dict";
import type { CompanyData, Social } from "@/lib/materials/types";

/** Validasi form brand package user (Tahap 6a, SPEC bagian 3). Aman dipakai klien dan server. */
export const SOCIAL_PLATFORMS = ["instagram", "linkedin", "facebook", "x", "tiktok", "youtube", "whatsapp"] as const;

const clean = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

/** Validasi seluruh isi form (dipakai juga untuk tes). */
export function parseBrandForm(form: FormData, lang: "id" | "en") {
  const E = DICT[lang].err;
  const companyName = clean(form.get("companyName"), 80);
  const industryId = clean(form.get("industry"), 40);
  const industryOther = clean(form.get("industryOther"), 60);
  const email = clean(form.get("email"), 120);
  const pick = (name: string, max: number) => form.getAll(name).map((v) => clean(v, max));
  const addresses = pick("address", 160);
  const phones = pick("phone", 30);
  const ai = Number(form.get("addressPrimary") ?? 0);
  const pi = Number(form.get("phonePrimary") ?? 0);
  const known = INDUSTRIES.find((x) => x.id === industryId);
  if (!companyName) return { error: E.company, field: "companyName" };
  if (!known) return { error: E.industry, field: "industry" };
  if (known.freeText && !industryOther) return { error: E.industryOther, field: "industryOther" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: E.email, field: "email" };
  const addrList = addresses.map((v, i) => ({ v, primary: i === ai })).filter((x) => x.v);
  const phoneList = phones.map((v, i) => ({ v, primary: i === pi })).filter((x) => x.v);
  if (!addrList.length) return { error: E.address, field: "address" };
  if (!phoneList.length || phoneList.some((p) => p.v.replace(/\D/g, "").length < 7)) return { error: E.phone, field: "phone" };
  // Tepat satu utama: bila yang ditandai kosong, pakai yang pertama.
  const mainA = addrList.find((x) => x.primary) ?? addrList[0];
  const mainP = phoneList.find((x) => x.primary) ?? phoneList[0];
  const socials: Social[] = SOCIAL_PLATFORMS.map((p) => ({ platform: p, handle: clean(form.get(`social_${p}`), 60).replace(/^https?:\/\/\S+\//, "") })).filter((s) => s.handle);
  const company: CompanyData = {
    name: companyName,
    email,
    phone: mainP.v,
    address: mainA.v,
    socials,
    extraAddresses: addrList.filter((x) => x !== mainA).map((x) => x.v).slice(0, 2),
    extraPhones: phoneList.filter((x) => x !== mainP).map((x) => x.v).slice(0, 2),
  };
  return { companyName, industryId, industryOther, company, wantVisual: form.get("wantVisual") === "on" };
}

