import { describe, expect, it, vi } from "vitest";

const store = new Map<string, string[]>();
vi.mock("@/lib/redis", () => ({
  APP_KEY_PREFIX: "bpa",
  redis: () => ({
    pipeline: () => {
      const ops: (() => void)[] = [];
      const p = {
        lpush: (k: string, v: string) => (ops.push(() => store.set(k, [v, ...(store.get(k) ?? [])])), p),
        ltrim: (k: string, a: number, b: number) => (ops.push(() => store.set(k, (store.get(k) ?? []).slice(a, b + 1))), p),
        exec: async () => ops.forEach((f) => f()),
      };
      return p;
    },
    // Upstash mengurai JSON otomatis saat membaca; tiru perilaku itu.
    lrange: async (k: string, a: number, b: number) => (store.get(k) ?? []).slice(a, b + 1).map((x) => JSON.parse(x)),
  }),
}));

const { CRON_KEY, CRON_HISTORY, cleanupRuns, cronState, recordCleanupRun, shortError } = await import("@/lib/cron");
type Run = Parameters<typeof recordCleanupRun>[0];
const run = (at: string, ok = true, extra: Partial<Run> = {}): Run => ({ at, ok, deleted: { dev: 0, prod: 0 }, sessions: { dev: 0, prod: 0 }, durationMs: 1200, ...extra });

describe("status cron pembersihan", () => {
  const now = Date.parse("2026-11-25T03:00:00.000Z");
  it("kunci bersama, bukan per environment", () => {
    expect(CRON_KEY).toBe("bpa:shared:cron:cleanup");
  });
  it("belum ada run", () => {
    expect(cronState([], now)).toBe("none");
  });
  it("berhasil dalam 26 jam = normal; lebih dari 26 jam = terlambat", () => {
    expect(cronState([run("2026-11-24T02:00:00.000Z")], now)).toBe("ok"); // 25 jam
    expect(cronState([run("2026-11-24T00:59:00.000Z")], now)).toBe("late"); // 26 jam 1 menit
  });
  it("run terakhir gagal diutamakan walau sudah lama", () => {
    expect(cronState([run("2026-11-20T02:00:00.000Z", false), run("2026-11-19T02:00:00.000Z")], now)).toBe("failed");
  });
  it("menyimpan 7 run terakhir, terbaru lebih dulu", async () => {
    store.clear();
    for (let d = 1; d <= 9; d++) await recordCleanupRun(run(`2026-11-${String(d).padStart(2, "0")}T19:30:00.000Z`, d !== 9, d === 9 ? { error: "Drive terputus" } : {}));
    const runs = await cleanupRuns();
    expect(runs).toHaveLength(CRON_HISTORY);
    expect(runs[0]).toMatchObject({ at: "2026-11-09T19:30:00.000Z", ok: false, error: "Drive terputus" });
    expect(runs.at(-1)?.at).toBe("2026-11-03T19:30:00.000Z");
  });
  it("pesan galat dipendekkan satu baris", () => {
    expect(shortError(new Error("a\n  b"))).toBe("a b");
    expect(shortError(new Error("x".repeat(500)))).toHaveLength(300);
    expect(shortError("")).toBe("Galat tidak diketahui");
  });
});
