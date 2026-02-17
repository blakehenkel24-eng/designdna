import { NextResponse } from "next/server";

import { cleanupExpiredArtifacts } from "@/lib/cleanup";
import { getServerEnv } from "@/lib/env";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  const validSecret = getServerEnv().CRON_CLEANUP_SECRET;
  if (secret !== validSecret && bearerToken !== validSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await cleanupExpiredArtifacts();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Cleanup failed",
      },
      { status: 500 },
    );
  }
}
