import { hash, verify } from "@node-rs/argon2";

// argon2id dengan parameter default @node-rs/argon2 (m=19 MiB, t=2, p=1; rekomendasi OWASP).
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

// Hash acak untuk menyamakan waktu respons saat email tidak terdaftar.
let dummy: Promise<string> | undefined;

/** Verifikasi password. Bila hash kosong (user tidak ada), tetap menghitung agar waktunya sama. */
export async function verifyPassword(passwordHash: string | undefined, password: string): Promise<boolean> {
  if (!passwordHash) {
    dummy ??= hash("dummy-password-untuk-waktu-konstan");
    await verify(await dummy, password).catch(() => false);
    return false;
  }
  return verify(passwordHash, password).catch(() => false);
}
