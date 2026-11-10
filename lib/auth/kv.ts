/**
 * Subset perintah Redis yang dipakai modul auth. Upstash Redis memenuhinya;
 * tes memakai implementasi di memori.
 */
export interface Kv {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  sadd(key: string, ...members: [string, ...string[]]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  expire(key: string, seconds: number): Promise<unknown>;
}
