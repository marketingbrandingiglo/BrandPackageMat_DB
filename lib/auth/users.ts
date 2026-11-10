import { randomUUID } from "node:crypto";
import type { Kv } from "./kv";
import { hashPassword } from "./password";
import { normalizeEmail } from "./validate";

export type Role = "superadmin" | "user";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  passwordHash: string;
  createdAt: string;
  createdBy: string | null;
  lastLoginAt: string | null;
}

/** User tanpa hash password, aman untuk ditampilkan. */
export type PublicUser = Omit<User, "passwordHash">;

export function toPublic(u: User): PublicUser {
  const { passwordHash: _omit, ...rest } = u;
  void _omit;
  return rest;
}

/** Penyimpanan user di Redis: user:{id}, user_email:{email} -> id, users (set id). */
export class UserStore {
  constructor(
    private kv: Kv,
    private k: (...parts: string[]) => string,
  ) {}

  async byId(id: string): Promise<User | null> {
    return this.kv.get<User>(this.k("user", id));
  }

  async byEmail(email: string): Promise<User | null> {
    const id = await this.kv.get<string>(this.k("user_email", normalizeEmail(email)));
    return id ? this.byId(id) : null;
  }

  async list(): Promise<User[]> {
    const ids = await this.kv.smembers(this.k("users"));
    const users = await Promise.all(ids.map((id) => this.byId(id)));
    return users
      .filter((u): u is User => u !== null)
      .sort((a, b) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === "superadmin" ? -1 : 1));
  }

  private async save(u: User): Promise<void> {
    await this.kv.set(this.k("user", u.id), u);
  }

  async create(input: { email: string; name: string; password: string; role: Role; createdBy: string | null }): Promise<User> {
    const email = normalizeEmail(input.email);
    if (await this.byEmail(email)) throw new Error("EMAIL_TAKEN");
    const user: User = {
      id: randomUUID(),
      email,
      name: input.name.trim(),
      role: input.role,
      active: true,
      passwordHash: await hashPassword(input.password),
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
      lastLoginAt: null,
    };
    await this.save(user);
    await this.kv.set(this.k("user_email", email), user.id);
    await this.kv.sadd(this.k("users"), user.id);
    return user;
  }

  async update(id: string, patch: Partial<Pick<User, "name" | "role" | "active" | "lastLoginAt">>): Promise<User | null> {
    const u = await this.byId(id);
    if (!u) return null;
    const next = { ...u, ...patch };
    await this.save(next);
    return next;
  }

  async setPassword(id: string, password: string): Promise<boolean> {
    const u = await this.byId(id);
    if (!u) return false;
    await this.save({ ...u, passwordHash: await hashPassword(password) });
    return true;
  }

  async remove(id: string): Promise<boolean> {
    const u = await this.byId(id);
    if (!u) return false;
    await this.kv.del(this.k("user", id), this.k("user_email", u.email));
    await this.kv.srem(this.k("users"), id);
    return true;
  }

  /** Dipakai skrip admin:set-password: buat atau perbarui super admin. */
  async upsertSuperAdmin(email: string, name: string, password: string): Promise<{ user: User; created: boolean }> {
    const existing = await this.byEmail(email);
    if (!existing) {
      return { user: await this.create({ email, name, password, role: "superadmin", createdBy: null }), created: true };
    }
    await this.setPassword(existing.id, password);
    const user = (await this.update(existing.id, { role: "superadmin", active: true, name: name || existing.name }))!;
    return { user, created: false };
  }
}
