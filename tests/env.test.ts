import { afterEach, describe, expect, it, vi } from "vitest";
import { appEnv } from "@/lib/env";

vi.mock("server-only", () => ({}));
const { key } = await import("@/lib/redis");

afterEach(() => vi.unstubAllEnvs());

describe("environment dan prefiks kunci", () => {
  it("lokal default development", () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("APP_ENV", "");
    expect(appEnv()).toBe("development");
    expect(key("user", "1")).toBe("bpa:dev:user:1");
  });
  it("Vercel production memakai prefiks prod", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(key("user", "1")).toBe("bpa:prod:user:1");
  });
  it("Vercel preview diperlakukan development", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(appEnv()).toBe("development");
  });
});
