import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Ratelimit } from "@upstash/ratelimit";
import { appEnv, requireEnv } from "@/lib/env";
import { key, redis } from "@/lib/redis";
import { SessionStore, SESSION_TTL_SECONDS, type Session } from "./sessions";
import { UserStore, toPublic, type PublicUser } from "./users";

/** Nama cookie. Production memakai awalan __Host- (wajib Secure, path=/, tanpa domain). */
export function sessionCookieName(): string {
  return appEnv() === "production" ? "__Host-bpa_session" : "bpa_session";
}

export function users(): UserStore {
  return new UserStore(redis(), key);
}

export function sessions(): SessionStore {
  return new SessionStore(redis(), key, requireEnv("SESSION_SECRET"));
}

let limiters: { ip: Ratelimit; email: Ratelimit } | undefined;

/** Pembatasan percobaan login (SPEC bagian 2): per email 5x / 15 menit, per IP 30x / 15 menit. */
export function loginLimiters() {
  limiters ??= {
    email: new Ratelimit({ redis: redis(), limiter: Ratelimit.slidingWindow(5, "15 m"), prefix: key("ratelimit", "login_email") }),
    ip: new Ratelimit({ redis: redis(), limiter: Ratelimit.slidingWindow(30, "15 m"), prefix: key("ratelimit", "login_ip") }),
  };
  return limiters;
}

export async function clientMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent") };
}

export async function setSessionCookie(value: string): Promise<void> {
  (await cookies()).set(sessionCookieName(), value, {
    httpOnly: true,
    secure: appEnv() === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(sessionCookieName());
}

export interface CurrentUser {
  user: PublicUser;
  session: Session;
}

/** Sesi + user aktif untuk request ini, atau null. Di-cache per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookie = (await cookies()).get(sessionCookieName())?.value;
  const session = await sessions().resolve(cookie);
  if (!session) return null;
  const user = await users().byId(session.userId);
  if (!user || !user.active) return null;
  return { user: toPublic(user), session };
});

export async function requireUser(): Promise<CurrentUser> {
  const cu = await getCurrentUser();
  if (!cu) redirect("/login");
  return cu;
}

export async function requireSuperAdmin(): Promise<CurrentUser> {
  const cu = await requireUser();
  if (cu.user.role !== "superadmin") redirect("/");
  return cu;
}
