/**
 * Konfigurasi environment. Rahasia hanya dibaca di server dari environment
 * variable; tidak pernah dikirim ke klien. Lihat .env.example.
 */
export type AppEnv = "development" | "production";

/**
 * Di Vercel, VERCEL_ENV diisi otomatis ("production" | "preview" | "development").
 * Di lokal, pakai APP_ENV (default "development"). Hanya production Vercel yang
 * dianggap production; preview diperlakukan sebagai development.
 */
export function appEnv(): AppEnv {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === "production" ? "production" : "development";
  }
  const v = process.env.APP_ENV || "development";
  if (v !== "development" && v !== "production") {
    throw new Error(`APP_ENV harus 'development' atau 'production', bukan '${v}'`);
  }
  return v;
}

/** Ambil env var pertama yang terisi dari beberapa nama alternatif. */
export function requireEnv(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  throw new Error(`Environment variable belum diatur: ${names.join(" / ")}`);
}
