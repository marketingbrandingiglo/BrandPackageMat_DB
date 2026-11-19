import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { requireEnv } from "@/lib/env";

/**
 * Enkripsi token Google Drive di Upstash (AES-256-GCM). Kunci diturunkan dari
 * DRIVE_TOKEN_SECRET, yang nilainya sama di lokal, Vercel, dan sesi pekerja.
 */
function key(secret?: string): Buffer {
  const s = secret ?? requireEnv("DRIVE_TOKEN_SECRET");
  if (s.length < 32) throw new Error("DRIVE_TOKEN_SECRET minimal 32 karakter.");
  return createHash("sha256").update(`bpa-drive:${s}`).digest();
}

export function seal(plain: string, secret?: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function open(sealed: string, secret?: string): string {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !body) throw new Error("Format token terenkripsi tidak dikenal.");
  const d = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
}
