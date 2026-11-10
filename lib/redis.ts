import "server-only";
import { Redis } from "@upstash/redis";
import { appEnv, requireEnv } from "./env";

let client: Redis | undefined;

/** Klien Upstash Redis. Dev dan production memakai database berbeda (kredensial berbeda). */
export function redis(): Redis {
  client ??= new Redis({
    url: requireEnv("UPSTASH_REDIS_REST_URL"),
    token: requireEnv("UPSTASH_REDIS_REST_TOKEN"),
  });
  return client;
}

/** Awalan kunci per environment, mis. "dev:user:1" atau "prod:user:1" (SPEC bagian 13). */
export function key(...parts: string[]): string {
  const prefix = appEnv() === "production" ? "prod" : "dev";
  return [prefix, ...parts].join(":");
}
