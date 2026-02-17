import { Redis } from "@upstash/redis";

import { getServerEnv } from "@/lib/env";
import type { ExtractionJobPayload } from "@/lib/types";

const QUEUE_KEY = "designdna:extraction_jobs";

let redis: Redis | null = null;

function getRedis() {
  if (redis) {
    return redis;
  }

  const env = getServerEnv();
  redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  return redis;
}

export async function enqueueExtractionJob(job: ExtractionJobPayload) {
  const client = getRedis();
  await client.rpush(QUEUE_KEY, JSON.stringify(job));
}

export async function dequeueExtractionJob() {
  const client = getRedis();
  const payload = await client.lpop<string>(QUEUE_KEY);
  if (!payload) {
    return null;
  }

  return JSON.parse(payload) as ExtractionJobPayload;
}
