import { describe, expect, it } from "vitest";
import { bumpVersion, formatVersion, APP_VERSION } from "@/lib/version";

describe("versi", () => {
  it("membuang angka patch", () => expect(formatVersion("1.0.0")).toBe("1.0"));
  it("menolak format salah", () => expect(() => formatVersion("abc")).toThrow());
  it("minor adalah default", () => expect(bumpVersion("1.0")).toBe("1.1"));
  it("major mereset minor", () => expect(bumpVersion("1.7", "major")).toBe("2.0"));
  it("versi aplikasi berformat MAJOR.MINOR", () => expect(APP_VERSION).toMatch(/^\d+\.\d+$/));
});
