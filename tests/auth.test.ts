import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SessionStore, SESSION_TTL_SECONDS } from "@/lib/auth/sessions";
import { UserStore, toPublic } from "@/lib/auth/users";
import { isValidEmail, normalizeEmail, passwordProblem } from "@/lib/auth/validate";
import { FakeKv, k } from "./fake-kv";

const SECRET = "s".repeat(40);

describe("validasi", () => {
  it("email", () => {
    expect(normalizeEmail("  Adi@Contoh.CO.id ")).toBe("adi@contoh.co.id");
    expect(isValidEmail("adi@contoh.co.id")).toBe(true);
    expect(isValidEmail("adi@contoh")).toBe(false);
    expect(isValidEmail("a b@c.id")).toBe(false);
  });
  it("password minimal 10 karakter", () => {
    expect(passwordProblem("pendek")).toMatch(/minimal/);
    expect(passwordProblem("cukup-panjang")).toBeNull();
  });
});

describe("password", () => {
  it("argon2id: benar lolos, salah gagal, hash bukan teks asli", async () => {
    const h = await hashPassword("rahasia-sekali");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(h).not.toContain("rahasia-sekali");
    expect(await verifyPassword(h, "rahasia-sekali")).toBe(true);
    expect(await verifyPassword(h, "salah-password")).toBe(false);
    expect(await verifyPassword(undefined, "apa-saja-1234")).toBe(false);
  });
});

describe("user", () => {
  it("buat, cari per email (case-insensitive), tolak email ganda", async () => {
    const s = new UserStore(new FakeKv(), k);
    const u = await s.create({ email: "Adi@X.id", name: "Adi", password: "password-123", role: "user", createdBy: null });
    expect((await s.byEmail("adi@x.id"))?.id).toBe(u.id);
    await expect(s.create({ email: "adi@x.id", name: "B", password: "password-123", role: "user", createdBy: null })).rejects.toThrow("EMAIL_TAKEN");
    expect(toPublic(u)).not.toHaveProperty("passwordHash");
  });

  it("hapus membersihkan indeks email", async () => {
    const s = new UserStore(new FakeKv(), k);
    const u = await s.create({ email: "a@x.id", name: "A", password: "password-123", role: "user", createdBy: null });
    await s.remove(u.id);
    expect(await s.byEmail("a@x.id")).toBeNull();
    expect(await s.list()).toEqual([]);
  });

  it("upsert super admin: buat lalu ganti password", async () => {
    const s = new UserStore(new FakeKv(), k);
    const first = await s.upsertSuperAdmin("owner@x.id", "Owner", "password-lama-1");
    expect(first.created).toBe(true);
    const second = await s.upsertSuperAdmin("owner@x.id", "", "password-baru-1");
    expect(second.created).toBe(false);
    expect(second.user.role).toBe("superadmin");
    expect(await verifyPassword(second.user.passwordHash, "password-baru-1")).toBe(true);
  });
});

describe("sesi", () => {
  it("cookie bertanda tangan, berlaku 12 jam", async () => {
    const kv = new FakeKv();
    const s = new SessionStore(kv, k, SECRET);
    const { cookie, session } = await s.create("u1", { ip: "1.2.3.4", userAgent: "tes" });
    expect(SESSION_TTL_SECONDS).toBe(43200);
    expect(Date.parse(session.expiresAt) - Date.parse(session.createdAt)).toBe(43200 * 1000);
    expect((await s.resolve(cookie))?.userId).toBe("u1");
    // Redis tidak menyimpan token mentah.
    expect([...kv.data.keys()].some((key) => key.includes(cookie.split(".")[0]))).toBe(false);
  });

  it("cookie diubah atau secret lain ditolak", async () => {
    const s = new SessionStore(new FakeKv(), k, SECRET);
    const { cookie } = await s.create("u1", { ip: null, userAgent: null });
    expect(await s.resolve(cookie.slice(0, -2) + "xx")).toBeNull();
    expect(await s.resolve("token-palsu.tanda")).toBeNull();
    expect(await new SessionStore(new FakeKv(), k, "z".repeat(40)).resolve(cookie)).toBeNull();
  });

  it("logout dan hapus semua sesi user", async () => {
    const s = new SessionStore(new FakeKv(), k, SECRET);
    const a = await s.create("u1", { ip: null, userAgent: null });
    const b = await s.create("u1", { ip: null, userAgent: null });
    await s.destroy(a.cookie);
    expect(await s.resolve(a.cookie)).toBeNull();
    expect(await s.resolve(b.cookie)).not.toBeNull();
    await s.destroyAllForUser("u1");
    expect(await s.resolve(b.cookie)).toBeNull();
  });

  it("menolak secret pendek", () => {
    expect(() => new SessionStore(new FakeKv(), k, "pendek")).toThrow();
  });
});
