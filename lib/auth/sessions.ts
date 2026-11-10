import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Kv } from "./kv";

/** Sesi login berlaku 12 jam sejak login (absolut, tidak diperpanjang). SPEC bagian 2. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface Session {
  /** ID sesi publik, dipakai untuk pencatatan pemakaian per sesi (Tahap 7). */
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  ip: string | null;
  userAgent: string | null;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Cookie berisi token acak + tanda tangan HMAC (SESSION_SECRET). Redis hanya
 * menyimpan hash token, jadi isi database saja tidak cukup untuk membajak sesi.
 */
export class SessionStore {
  constructor(
    private kv: Kv,
    private k: (...parts: string[]) => string,
    private secret: string,
  ) {
    if (secret.length < 32) throw new Error("SESSION_SECRET minimal 32 karakter");
  }

  private sign(token: string): string {
    return createHmac("sha256", this.secret).update(token).digest("base64url");
  }

  /** Mengembalikan token mentah bila tanda tangan cookie valid. */
  private unsign(cookie: string): string | null {
    const dot = cookie.lastIndexOf(".");
    if (dot <= 0) return null;
    const token = cookie.slice(0, dot);
    const given = Buffer.from(cookie.slice(dot + 1));
    const expected = Buffer.from(this.sign(token));
    return given.length === expected.length && timingSafeEqual(given, expected) ? token : null;
  }

  async create(userId: string, meta: { ip: string | null; userAgent: string | null }): Promise<{ cookie: string; session: Session }> {
    const token = randomBytes(32).toString("base64url");
    const now = Date.now();
    const session: Session = {
      id: randomUUID(),
      userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_SECONDS * 1000).toISOString(),
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    };
    const h = sha256(token);
    await this.kv.set(this.k("session", h), session, { ex: SESSION_TTL_SECONDS });
    await this.kv.sadd(this.k("user_sessions", userId), h);
    await this.kv.expire(this.k("user_sessions", userId), SESSION_TTL_SECONDS);
    return { cookie: `${token}.${this.sign(token)}`, session };
  }

  async resolve(cookie: string | undefined): Promise<Session | null> {
    if (!cookie) return null;
    const token = this.unsign(cookie);
    if (!token) return null;
    const s = await this.kv.get<Session>(this.k("session", sha256(token)));
    if (!s || Date.parse(s.expiresAt) <= Date.now()) return null;
    return s;
  }

  async destroy(cookie: string | undefined): Promise<void> {
    const token = cookie ? this.unsign(cookie) : null;
    if (!token) return;
    const h = sha256(token);
    const s = await this.kv.get<Session>(this.k("session", h));
    await this.kv.del(this.k("session", h));
    if (s) await this.kv.srem(this.k("user_sessions", s.userId), h);
  }

  /** Hapus semua sesi user (dipakai saat user dinonaktifkan, dihapus, atau password diganti). */
  async destroyAllForUser(userId: string): Promise<void> {
    const hashes = await this.kv.smembers(this.k("user_sessions", userId));
    const keys = hashes.map((h) => this.k("session", h));
    await this.kv.del(...keys, this.k("user_sessions", userId));
  }
}
