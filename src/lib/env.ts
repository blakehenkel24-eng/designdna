import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  EXTRACTION_DAILY_CAP: z.coerce.number().int().positive().default(10),
  ARTIFACT_TTL_HOURS: z.coerce.number().int().positive().default(24),
  CRON_CLEANUP_SECRET: z.string().min(1),
});

let cachedServerEnv: z.infer<typeof serverEnvSchema> | null = null;

function buildIssueString(
  error: z.ZodError<z.infer<typeof publicEnvSchema> | z.infer<typeof serverEnvSchema>>,
) {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

export function getPublicEnv() {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid public environment configuration: ${buildIssueString(parsed.error)}`,
    );
  }

  return parsed.data;
}

export function getServerEnv() {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    EXTRACTION_DAILY_CAP: process.env.EXTRACTION_DAILY_CAP,
    ARTIFACT_TTL_HOURS: process.env.ARTIFACT_TTL_HOURS,
    CRON_CLEANUP_SECRET: process.env.CRON_CLEANUP_SECRET,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment configuration: ${buildIssueString(parsed.error)}`,
    );
  }

  cachedServerEnv = parsed.data;
  return parsed.data;
}
