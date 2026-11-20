import { describe, expect, it } from "vitest";
import { parseBrandForm } from "@/lib/brand-form";

const base = (over: Record<string, string | string[]> = {}) => {
  const fd = new FormData();
  const v: Record<string, string | string[]> = {
    companyName: "  PT Uji   Jaya ",
    industry: "it",
    email: "halo@uji.co.id",
    address: ["Jl. Satu", "Jl. Dua", "Jl. Tiga"],
    addressPrimary: "1",
    phone: ["0812 1111 2222", "021 555 1234"],
    phonePrimary: "0",
    social_instagram: "uji.id",
    social_linkedin: "https://www.linkedin.com/company/uji",
    ...over,
  };
  for (const [k, x] of Object.entries(v)) (Array.isArray(x) ? x : [x]).forEach((y) => fd.append(k, y));
  return fd;
};

describe("form brand package", () => {
  it("data lengkap: alamat/telepon utama sesuai pilihan, sisanya tambahan, handle dibersihkan", () => {
    const p = parseBrandForm(base(), "id");
    if ("error" in p) throw new Error(p.error);
    expect(p.companyName).toBe("PT Uji Jaya");
    expect(p.company.address).toBe("Jl. Dua");
    expect(p.company.extraAddresses).toEqual(["Jl. Satu", "Jl. Tiga"]);
    expect(p.company.phone).toBe("0812 1111 2222");
    expect(p.company.extraPhones).toEqual(["021 555 1234"]);
    expect(p.company.socials).toEqual([{ platform: "instagram", handle: "uji.id" }, { platform: "linkedin", handle: "uji" }]);
    expect(p.wantVisual).toBe(false);
  });
  it("utama yang dipilih kosong: pakai baris pertama yang terisi", () => {
    const p = parseBrandForm(base({ address: ["", "Jl. Dua"], addressPrimary: "0" }), "id");
    if ("error" in p) throw new Error(p.error);
    expect(p.company.address).toBe("Jl. Dua");
    expect(p.company.extraAddresses).toEqual([]);
  });
  it("menolak isian wajib yang kosong atau salah, dengan nama field", () => {
    expect(parseBrandForm(base({ companyName: "" }), "id")).toMatchObject({ field: "companyName" });
    expect(parseBrandForm(base({ industry: "" }), "en")).toMatchObject({ field: "industry", error: "Choose an industry." });
    expect(parseBrandForm(base({ industry: "other" }), "id")).toMatchObject({ field: "industryOther" });
    expect(parseBrandForm(base({ email: "bukan-email" }), "id")).toMatchObject({ field: "email" });
    expect(parseBrandForm(base({ address: ["", " "] }), "id")).toMatchObject({ field: "address" });
    expect(parseBrandForm(base({ phone: ["12"] }), "id")).toMatchObject({ field: "phone" });
  });
});
