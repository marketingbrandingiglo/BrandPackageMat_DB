// Cek koneksi Upstash untuk environment yang aktif (.env.local atau env var).
// Hanya menulis satu kunci sementara (TTL 30 detik) di bawah prefiks aplikasi.
// Pemakaian: npm run check:redis
import { Redis } from "@upstash/redis";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error("KV_REST_API_URL / KV_REST_API_TOKEN belum diatur (lihat .env.example).");
  process.exit(1);
}
const isProd = process.env.VERCEL_ENV
  ? process.env.VERCEL_ENV === "production"
  : process.env.APP_ENV === "production";
const prefix = `bpa:${isProd ? "prod" : "dev"}`;
const r = new Redis({ url, token });
const k = `${prefix}:healthcheck`;
await r.set(k, "ok", { ex: 30 });
const v = await r.get(k);
console.log(v === "ok" ? `Upstash OK (prefiks ${prefix}:)` : "Upstash GAGAL: nilai tidak cocok");
process.exit(v === "ok" ? 0 : 1);
