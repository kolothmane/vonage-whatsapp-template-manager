import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

export function hasKvConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export function getKv() {
  if (!hasKvConfig()) {
    throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN are required.");
  }

  if (!redis) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
  }

  return redis;
}
