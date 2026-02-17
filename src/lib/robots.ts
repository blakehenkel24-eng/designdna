import { ExtractionError } from "@/lib/errors";

type RobotsRule = {
  userAgents: string[];
  allow: string[];
  disallow: string[];
};

const DESIGN_DNA_AGENT = "DesignDNA";

function matchesAgent(ruleAgents: string[]) {
  return ruleAgents.some(
    (agent) =>
      agent === "*" || DESIGN_DNA_AGENT.toLowerCase().startsWith(agent.toLowerCase()),
  );
}

function parseRobots(content: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  let current: RobotsRule | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line) continue;

    const [rawKey, ...rawValues] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rawValues.join(":").trim();

    if (!value) continue;

    if (key === "user-agent") {
      if (!current || current.allow.length || current.disallow.length) {
        current = { userAgents: [], allow: [], disallow: [] };
        rules.push(current);
      }
      current.userAgents.push(value);
      continue;
    }

    if (!current) continue;

    if (key === "allow") {
      current.allow.push(value);
    }

    if (key === "disallow") {
      current.disallow.push(value);
    }
  }

  return rules;
}

function isMatch(pathname: string, rulePath: string) {
  if (!rulePath) return false;

  const normalizedRule = rulePath.replace(/\*+/g, "*");
  if (normalizedRule === "/") return true;

  if (normalizedRule.endsWith("$")) {
    return pathname === normalizedRule.slice(0, -1);
  }

  if (normalizedRule.includes("*")) {
    const escaped = normalizedRule
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${escaped}`).test(pathname);
  }

  return pathname.startsWith(normalizedRule);
}

function resolveAllowed(pathname: string, rule: RobotsRule) {
  let bestDisallow = -1;
  let bestAllow = -1;

  for (const disallowedPath of rule.disallow) {
    if (isMatch(pathname, disallowedPath)) {
      bestDisallow = Math.max(bestDisallow, disallowedPath.length);
    }
  }

  for (const allowedPath of rule.allow) {
    if (isMatch(pathname, allowedPath)) {
      bestAllow = Math.max(bestAllow, allowedPath.length);
    }
  }

  if (bestAllow >= bestDisallow) {
    return true;
  }

  return bestDisallow === -1;
}

export async function assertRobotsAllowed(targetUrl: URL) {
  const robotsUrl = new URL("/robots.txt", targetUrl.origin);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(robotsUrl, {
      headers: { "user-agent": DESIGN_DNA_AGENT },
      signal: controller.signal,
      redirect: "follow",
    });

    if (response.status === 404) {
      return;
    }

    if (!response.ok) {
      // Fail open for prototype reliability when robots is temporarily unavailable.
      return;
    }

    const rules = parseRobots(await response.text());

    const matchingRules = rules.filter((rule) => matchesAgent(rule.userAgents));
    if (!matchingRules.length) {
      return;
    }

    const pathnameWithQuery =
      targetUrl.pathname + (targetUrl.search ? targetUrl.search : "");

    const isAllowed = matchingRules.some((rule) =>
      resolveAllowed(pathnameWithQuery, rule),
    );

    if (!isAllowed) {
      throw new ExtractionError(
        "TARGET_BLOCKED",
        "robots.txt disallows this path",
        400,
      );
    }
  } catch (error) {
    if (error instanceof ExtractionError) {
      throw error;
    }
    // Fail open for transient DNS/network issues. We only block on explicit disallow.
    return;
  } finally {
    clearTimeout(timeout);
  }
}
