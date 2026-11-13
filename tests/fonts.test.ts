import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import * as fontkit from "fontkit";
import { describe, expect, it } from "vitest";
import { FONTS, isCatalogFile } from "@/lib/brand/fonts";

const LIB = path.join(process.cwd(), "fonts/lib");
const listed = readFileSync("data/fonts/families.txt", "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

describe("katalog font", () => {
  it("sama dengan daftar families.txt dan berjumlah sekitar 300", () => {
    expect(FONTS.map((f) => f.family)).toEqual(listed);
    expect(FONTS.length).toBeGreaterThanOrEqual(250);
    expect(FONTS.length).toBeLessThanOrEqual(350);
  });

  it("tiap family punya file dan lisensi; font teks isi punya Bold", () => {
    for (const f of FONTS) {
      expect(existsSync(path.join(LIB, f.files.regular)), f.family).toBe(true);
      expect(existsSync(path.join(LIB, f.dir, f.licenseFile)), f.family).toBe(true);
      if (f.files.bold) expect(existsSync(path.join(LIB, f.files.bold)), f.family).toBe(true);
      if (!f.headingOnly) expect(f.files.bold, f.family).toBeTruthy();
      expect(["OFL", "Apache-2.0"]).toContain(f.license);
    }
  });

  it("file statis (bukan variable) dan memuat huruf Latin dasar", () => {
    for (const f of FONTS) {
      for (const rel of [f.files.regular, f.files.bold].filter(Boolean) as string[]) {
        const font = fontkit.create(readFileSync(path.join(LIB, rel))) as unknown as fontkit.Font & { directory: { tables: Record<string, unknown> } };
        expect(font.directory.tables.fvar, rel).toBeUndefined();
        for (const ch of "AZaz09.,!?") expect(font.hasGlyphForCodePoint(ch.codePointAt(0)!), `${rel} ${ch}`).toBe(true);
      }
    }
  });

  it("validasi path file hanya menerima file katalog", () => {
    expect(isCatalogFile(FONTS[0].files.regular)).toBe(true);
    expect(isCatalogFile("../../.env.local")).toBe(false);
    expect(isCatalogFile(`${FONTS[0].dir}/${FONTS[0].licenseFile}`)).toBe(false);
  });
});
