/**
 * Konfigurasi environment. Rahasia hanya dibaca di server dari environment
 * variable; tidak pernah dikirim ke klien. Lihat .env.example.
 */
export type AppEnv = "development" | "production";

export function appEnv(): AppEnv {
  const v = process.env.APP_ENV ?? "development";
  if (v !== "development" && v !== "production") {
    throw new Error(`APP_ENV harus 'development' atau 'production', bukan '${v}'`);
  }
  return v;
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Environment variable ${name} belum diatur`);
  return v;
}
