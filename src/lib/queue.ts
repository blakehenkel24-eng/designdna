import { Redis } from "@upstash/redis";

import { getServerEnv } from "@/lib/env";
import type { ExtractionJobPayload } from "@/lib/types";

const QUEUE_KEY = "designdna:extraction_jobs";

let redis: Redis | null = null;
function isExtractionJobPayload(value: unknown): value is ExtractionJobPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const job = value as Partial<ExtractionJobPayload>;
  return (
    typeof job.extractionId === "string" &&
    typeof job.userId === "string" &&
    typeof job.url === "string"
  );
}

function parseQueuePayload(payload: unknown): ExtractionJobPayload | null {
  if (isExtractionJobPayload(payload)) {
    return payload;
  }

  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload) as unknown;
      return isExtractionJobPayload(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}

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
  const payload = await client.lpop<unknown>(QUEUE_KEY);
  if (!payload) {
    return null;
  }

  const parsed = parseQueuePayload(payload);
  if (!parsed) {
    console.warn("Skipping malformed queue payload");
    return null;
  }

  return parsed;
}
