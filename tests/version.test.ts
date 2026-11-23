import { describe, expect, it } from "vitest";
import { bumpVersion, formatVersion, APP_VERSION, versionLabel } from "@/lib/version";

describe("versi", () => {
  it("membuang angka patch", () => expect(formatVersion("1.0.0")).toBe("1.0"));
  it("menolak format salah", () => expect(() => formatVersion("abc")).toThrow());
  it("minor adalah default", () => expect(bumpVersion("1.0")).toBe("1.1"));
  it("major mereset minor", () => expect(bumpVersion("1.7", "major")).toBe("2.0"));
  it("versi aplikasi berformat MAJOR.MINOR", () => expect(APP_VERSION).toMatch(/^\d+\.\d+$/));
});

describe("label versi", () => {
  it("production tanpa label, lokal/dev dengan (lokal)", () => {
    expect(versionLabel("production")).toBe(APP_VERSION);
    expect(versionLabel("development")).toBe(`${APP_VERSION} (lokal)`);
  });
});
