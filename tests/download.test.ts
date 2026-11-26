import { describe, expect, it } from "vitest";
import { ref } from "@/lib/brand/font-select";
import { FONTS } from "@/lib/brand/fonts";
import { GROUPS, groupFolder, safeName, zipName } from "@/lib/materials/groups";
import { readme, readmeName } from "@/lib/materials/readme";

const f = (n: string) => ref(FONTS.find((x) => x.family === n)!);

describe("unduhan", () => {
  it("nama ZIP: semua, satu materi, pilihan; nama perusahaan dibersihkan", () => {
    expect(safeName("PT Sari & Roti / Indonesia, Tbk.")).toBe("PT-Sari-Roti-Indonesia-Tbk");
    expect(zipName("PT Sari Roti", "A", "id", [...GROUPS])).toBe("PT-Sari-Roti_BrandPackage_A.zip");
    expect(zipName("PT Sari Roti", "B", "id", ["businessCard", "stamp"])).toBe("PT-Sari-Roti_BrandPackage_B_Pilihan.zip");
    expect(zipName("PT Sari Roti", "B", "en", ["businessCard", "stamp"])).toBe("PT-Sari-Roti_BrandPackage_B_Selection.zip");
    expect(zipName("PT Sari Roti", "A", "id", ["businessCard"])).toBe("PT-Sari-Roti_BrandPackage_A_Kartu-Nama.zip");
    expect(groupFolder("id", "idCard")).toBe("05_ID-Card");
    expect(groupFolder("en", "stamp")).toBe("08_Stamp");
  });
  it("BACA-SAYA: tautan font, isi sesuai kelompok, catatan CMYK, catatan logo PNG", () => {
    const t = readme({ lang: "id", company: "PT Uji", pkg: "A", fonts: { heading: f("Playfair Display"), body: f("Lato") }, groups: ["guideline", "stamp"], availableUntil: "18 Februari 2027", pngLogo: true });
    expect(readmeName("id")).toBe("BACA-SAYA.txt");
    expect(t).toContain("https://fonts.google.com/specimen/Playfair+Display");
    expect(t).toContain("https://fonts.google.com/specimen/Lato");
    expect(t).toContain("01_Guideline");
    expect(t).toContain("08_Cap");
    expect(t).not.toContain("02_Kartu-Nama");
    expect(t).toContain("CMYK");
    expect(t).toContain("versi vektor");
    expect(t).toContain("18 Februari 2027");
    expect(t).toContain("pilih Range");
    const en = readme({ lang: "en", company: "PT Uji", pkg: "B", fonts: { heading: f("Lato"), body: f("Lato") }, groups: [...GROUPS], availableUntil: "18 February 2027", pngLogo: false });
    expect(readmeName("en")).toBe("README.txt");
    expect(en.match(/fonts\.google\.com/g)).toHaveLength(1);
    expect(en).not.toContain("vector version");
    expect(en).toContain("choose Range");
  });
});
