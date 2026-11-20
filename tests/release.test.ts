import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const calls: { op: string; args: unknown[] }[] = [];
vi.mock("@/lib/redis", () => ({
  APP_KEY_PREFIX: "bpa",
  redis: () => {
    const p = new Proxy({} as Record<string, unknown>, {
      get: (_t, op: string) => (op === "exec" ? async () => [] : (...args: unknown[]) => calls.push({ op, args })),
    });
    return { pipeline: () => p };
  },
}));

const { jobExpiry, JOB_TTL_SECONDS } = await import("@/lib/jobs/jobs");
const { avgWorkerSeconds, num, track } = await import("@/lib/usage");

describe("penghapusan 90 hari", () => {
  it("job kedaluwarsa tepat 90 hari sejak dibuat, tidak bergeser saat disimpan ulang", () => {
    const createdAt = "2026-11-20T03:00:00.000Z";
    expect(JOB_TTL_SECONDS).toBe(90 * 24 * 3600);
    expect(jobExpiry({ createdAt }) * 1000).toBe(Date.parse("2027-02-18T03:00:00.000Z"));
  });
});

describe("pemakaian", () => {
  it("mencatat ke total, user, bulan, dan sesi sekaligus", async () => {
    calls.length = 0;
    await track({ env: "prod", userId: "u1", sessionId: "s1" }, "downloads", 2);
    const incr = calls.filter((c) => c.op === "hincrby").map((c) => c.args[0]);
    expect(incr).toEqual(expect.arrayContaining(["bpa:prod:usage:total", "bpa:prod:usage:user:u1", "bpa:prod:usage:session:s1"]));
    expect(incr.some((k) => /^bpa:prod:usage:month:\d{4}-\d{2}$/.test(String(k)))).toBe(true);
    expect(calls.find((c) => c.op === "hincrby")?.args.slice(1)).toEqual(["downloads", 2]);
    expect(calls.some((c) => c.op === "zadd")).toBe(true);
  });
  it("tanpa sesi: tidak menulis data sesi; rata-rata durasi pekerja", async () => {
    calls.length = 0;
    await track({ env: "dev", userId: "u2" }, "jobs");
    expect(calls.some((c) => String(c.args[0]).includes(":session:"))).toBe(false);
    const u = num({ done: "4", workerMs: "200000" });
    expect(u.jobs).toBe(0);
    expect(avgWorkerSeconds(u)).toBe(50);
    expect(avgWorkerSeconds(num(null))).toBeNull();
  });
});

describe("aturan versi", () => {
  const run = (version: string, kind?: string) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "bpa-versi-"));
    mkdirSync(path.join(dir, "scripts"));
    copyFileSync("scripts/bump-version.mjs", path.join(dir, "scripts/bump-version.mjs"));
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "x", version }));
    execFileSync("node", [path.join(dir, "scripts/bump-version.mjs"), ...(kind ? [kind] : [])], { stdio: "pipe" });
    return JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).version;
  };
  it("minor bawaan, major mereset minor", () => {
    expect(run("1.0.0")).toBe("1.1.0");
    expect(run("1.9.0", "minor")).toBe("1.10.0");
    expect(run("1.4.0", "major")).toBe("2.0.0");
  });
});
