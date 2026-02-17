import dns from "node:dns/promises";
import net from "node:net";

import { ExtractionError } from "@/lib/errors";

const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function isPrivateIpv4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return true;
  }

  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;

  return false;
}

function isPrivateIpv6(ip: string) {
  const lowered = ip.toLowerCase();
  return (
    lowered === "::1" ||
    lowered.startsWith("fc") ||
    lowered.startsWith("fd") ||
    lowered.startsWith("fe80")
  );
}

function assertPublicIp(ip: string) {
  const ipType = net.isIP(ip);

  if (ipType === 4 && isPrivateIpv4(ip)) {
    throw new ExtractionError(
      "TARGET_BLOCKED",
      "Target resolves to a private IPv4 address",
      400,
    );
  }

  if (ipType === 6 && isPrivateIpv6(ip)) {
    throw new ExtractionError(
      "TARGET_BLOCKED",
      "Target resolves to a private IPv6 address",
      400,
    );
  }
}

export function normalizeUrl(raw: string) {
  let parsed: URL;

  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new ExtractionError("INVALID_URL", "URL is invalid", 400);
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new ExtractionError(
      "INVALID_URL",
      "Only http and https URLs are supported",
      400,
    );
  }

  if (BLOCKED_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
    throw new ExtractionError("TARGET_BLOCKED", "Blocked hostname", 400);
  }

  if (parsed.hostname.endsWith(".local")) {
    throw new ExtractionError("TARGET_BLOCKED", "Blocked local domain", 400);
  }

  return parsed;
}

export async function assertPublicTarget(parsed: URL) {
  const records = await dns.lookup(parsed.hostname, { all: true });
  if (!records.length) {
    throw new ExtractionError(
      "TARGET_BLOCKED",
      "Unable to resolve target hostname",
      400,
    );
  }

  for (const record of records) {
    assertPublicIp(record.address);
  }
}
