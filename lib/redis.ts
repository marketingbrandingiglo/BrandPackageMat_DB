import "server-only";
import { Redis } from "@upstash/redis";
import { appEnv, requireEnv } from "./env";

let client: Redis | undefined;

/**
 * Klien Upstash Redis. Nama env var mengikuti integrasi Upstash di Vercel
 * (KV_REST_API_*); nama UPSTASH_REDIS_REST_* diterima sebagai cadangan.
 */
export function redis(): Redis {
  client ??= new Redis({
    url: requireEnv("KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"),
    token: requireEnv("KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"),
  });
  return client;
}

/** Awalan aplikasi, agar tidak bentrok dengan kunci project lain di database yang sama. */
export const APP_KEY_PREFIX = "bpa";

/** Awalan kunci per environment, mis. "bpa:dev:user:1" atau "bpa:prod:user:1" (SPEC bagian 13). */
export function keyPrefix(): string {
  return `${APP_KEY_PREFIX}:${appEnv() === "production" ? "prod" : "dev"}`;
}

export function key(...parts: string[]): string {
  return [keyPrefix(), ...parts].join(":");
}
