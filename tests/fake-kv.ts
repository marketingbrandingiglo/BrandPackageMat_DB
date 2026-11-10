import type { Kv } from "@/lib/auth/kv";

/** Redis di memori untuk tes (TTL dihitung dengan waktu nyata). */
export class FakeKv implements Kv {
  data = new Map<string, { v: unknown; exp?: number }>();
  private live(k: string) {
    const e = this.data.get(k);
    if (e?.exp && e.exp <= Date.now()) {
      this.data.delete(k);
      return undefined;
    }
    return e;
  }
  async get<T>(k: string) {
    const v = this.live(k)?.v;
    return (v === undefined ? null : structuredClone(v)) as T | null;
  }
  async set(k: string, v: unknown, o?: { ex?: number }) {
    this.data.set(k, { v: structuredClone(v), exp: o?.ex ? Date.now() + o.ex * 1000 : undefined });
    return "OK";
  }
  async del(...ks: string[]) {
    let n = 0;
    for (const k of ks) if (this.data.delete(k)) n++;
    return n;
  }
  private setOf(k: string) {
    const v = this.live(k)?.v;
    return v instanceof Set ? (v as Set<string>) : new Set<string>();
  }
  async sadd(k: string, ...m: string[]) {
    const s = this.setOf(k);
    const before = s.size;
    m.forEach((x) => s.add(x));
    this.data.set(k, { v: s, exp: this.data.get(k)?.exp });
    return s.size - before;
  }
  async srem(k: string, ...m: string[]) {
    const s = this.setOf(k);
    let n = 0;
    m.forEach((x) => s.delete(x) && n++);
    return n;
  }
  async smembers(k: string) {
    return [...this.setOf(k)];
  }
  async expire(k: string, sec: number) {
    const e = this.data.get(k);
    if (e) e.exp = Date.now() + sec * 1000;
    return 1;
  }
}

export const k = (...p: string[]) => ["t", ...p].join(":");
