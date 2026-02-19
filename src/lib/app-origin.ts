import type { NextRequest } from "next/server";

function normalizeOrigin(origin: string) {
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

function getConfiguredOrigin() {
  const configured = process.env.APP_ORIGIN?.trim();
  if (!configured) {
    return null;
  }

  try {
    return normalizeOrigin(new URL(configured).origin);
  } catch {
    return null;
  }
}

export function resolveAppOrigin(request: NextRequest | Request) {
  const configured = getConfiguredOrigin();
  if (configured) {
    return configured;
  }

  if ("nextUrl" in request && request.nextUrl?.origin) {
    return normalizeOrigin(request.nextUrl.origin);
  }

  return normalizeOrigin(new URL(request.url).origin);
}
