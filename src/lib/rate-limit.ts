import { Redis } from "@upstash/redis";

import { getServerEnv } from "@/lib/env";

let redisClient: Redis | null = null;

function getRedis() {
  if (redisClient) return redisClient;

  try {
    const env = getServerEnv();
    redisClient = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redisClient;
  } catch {
    return null;
  }
}

export async function checkAnalysisRateLimit(identifier: string) {
  const redis = getRedis();
  if (!redis) {
    return { allowed: true, remaining: 999 };
  }

  const windowSeconds = 60;
  const maxPerWindow = 8;
  const key = `designdna:ratelimit:${identifier}`;

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }

  return {
    allowed: current <= maxPerWindow,
    remaining: Math.max(0, maxPerWindow - current),
  };
}
