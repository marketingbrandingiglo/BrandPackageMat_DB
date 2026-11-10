// Cek koneksi Upstash untuk environment yang aktif (.env.local atau env var).
// Pemakaian: npm run check:redis
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN belum diatur.");
  process.exit(1);
}
const prefix = process.env.APP_ENV === "production" ? "prod" : "dev";
const r = new Redis({ url, token });
const k = `${prefix}:healthcheck`;
await r.set(k, "ok", { ex: 30 });
const v = await r.get(k);
console.log(v === "ok" ? `Upstash OK (prefiks ${prefix}:)` : "Upstash GAGAL: nilai tidak cocok");
process.exit(v === "ok" ? 0 : 1);
