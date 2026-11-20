import { appEnv } from "@/lib/env";
import { APP_KEY_PREFIX, redis } from "@/lib/redis";

/**
 * Tahap 7 (SPEC bagian 11): penghitung pemakaian. Selama engine Claude memakai sesi pekerja
 * (tanpa API key) tidak ada biaya per token, jadi yang dicatat adalah jumlah kejadian dan durasi.
 * Hitungan atomik (HINCRBY) di Upstash: total, per user, per sesi login, per bulan.
 */
export const USAGE_FIELDS = ["jobs", "done", "failed", "workerMs", "visual", "materials", "chosen", "downloads"] as const;
export type UsageField = (typeof USAGE_FIELDS)[number];
export type Usage = Record<UsageField, number>;

type Env = "dev" | "prod";
const SESSION_TTL = 90 * 24 * 60 * 60;
const key = (env: Env, ...p: string[]) => [APP_KEY_PREFIX, env, "usage", ...p].join(":");
const month = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }).slice(0, 7);

export interface UsageRef {
  env: Env;
  userId: string;
  sessionId?: string;
}

/** Catat satu kejadian (best effort: gagal mencatat tidak menggagalkan proses utama). */
export async function track(ref: UsageRef, field: UsageField, by = 1): Promise<void> {
  try {
    const p = redis().pipeline();
    for (const k of [key(ref.env, "total"), key(ref.env, "user", ref.userId), key(ref.env, "month", month())]) p.hincrby(k, field, by);
    if (ref.sessionId) {
      const sk = key(ref.env, "session", ref.sessionId);
      p.hincrby(sk, field, by);
      p.hsetnx(sk, "userId", ref.userId);
      p.hsetnx(sk, "firstAt", new Date().toISOString());
      p.expire(sk, SESSION_TTL);
      p.zadd(key(ref.env, "sessions"), { score: Date.now(), member: ref.sessionId });
    }
    await p.exec();
  } catch (e) {
    console.error("[pemakaian] gagal mencatat", field, e);
  }
}

/** Rata-rata durasi pekerja per job selesai, dalam detik (null bila belum ada). */
export function avgWorkerSeconds(u: Usage): number | null {
  return u.done ? Math.round(u.workerMs / u.done / 1000) : null;
}

export const num = (h: Record<string, unknown> | null): Usage => Object.fromEntries(USAGE_FIELDS.map((f) => [f, Number(h?.[f] ?? 0)])) as Usage;

export interface UsageReport {
  total: Usage;
  users: Record<string, Usage>;
  months: { month: string; usage: Usage }[];
  sessions: { id: string; userId: string; firstAt: string; usage: Usage }[];
}

/** Rekap untuk halaman Admin. */
export async function usageReport(userIds: string[], env: Env = appEnv() === "production" ? "prod" : "dev"): Promise<UsageReport> {
  const r = redis();
  const months: string[] = [];
  const d = new Date();
  for (let i = 0; i < 6; i++) months.push(month(new Date(d.getFullYear(), d.getMonth() - i, 15)));
  const sessionIds = await r.zrange<string[]>(key(env, "sessions"), 0, 29, { rev: true });
  const p = r.pipeline();
  p.hgetall(key(env, "total"));
  userIds.forEach((u) => p.hgetall(key(env, "user", u)));
  months.forEach((m) => p.hgetall(key(env, "month", m)));
  sessionIds.forEach((s) => p.hgetall(key(env, "session", s)));
  const out = (await p.exec()) as (Record<string, unknown> | null)[];
  let i = 0;
  const total = num(out[i++]);
  const users: Record<string, Usage> = {};
  for (const u of userIds) users[u] = num(out[i++]);
  const ms = months.map((m) => ({ month: m, usage: num(out[i++]) }));
  const sessions = sessionIds
    .map((id) => {
      const h = out[i++];
      return h ? { id, userId: String(h.userId ?? ""), firstAt: String(h.firstAt ?? ""), usage: num(h) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  return { total, users, months: ms, sessions };
}

/** Pembersihan: indeks sesi yang lebih tua dari 90 hari (data sesi sendiri habis lewat TTL). */
export async function pruneSessions(env: Env): Promise<number> {
  return redis().zremrangebyscore(key(env, "sessions"), 0, Date.now() - SESSION_TTL * 1000);
}
