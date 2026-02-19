import { promises as fs } from "node:fs";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const scoreSchema = z
  .object({
    runtime_seconds: z.number().min(0).default(0),
    visual_fidelity_1_to_5: z.number().int().min(0).max(5).default(0),
    component_fidelity_1_to_5: z.number().int().min(0).max(5).default(0),
    token_quality_1_to_5: z.number().int().min(0).max(5).default(0),
    notes: z.string().default(""),
  })
  .partial();

const requestSchema = z.object({
  analysis_id: z.string().uuid().optional(),
  url: z.string().url().optional(),
  prompt: z.string().optional(),
  tokens_json: z.unknown().optional(),
  score: scoreSchema.optional(),
});

function slugFromUrl(rawUrl: string) {
  const parsed = new URL(rawUrl);
  const host = parsed.hostname.replace(/^www\./, "");
  const pathPart = parsed.pathname
    .replace(/\/$/, "")
    .split("/")
    .filter(Boolean)
    .join("-");

  const base = `${host}${pathPart ? `-${pathPart}` : ""}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return base || "snapshot";
}

function deriveRuntimeSeconds(score: z.infer<typeof scoreSchema> | undefined) {
  if (!score?.runtime_seconds) {
    return 0;
  }
  return Number(score.runtime_seconds.toFixed(2));
}

async function writeSnapshotFiles(input: {
  folderPath: string;
  prompt: string;
  tokensJson: unknown;
  score: z.infer<typeof scoreSchema> | undefined;
  url: string;
}) {
  await fs.mkdir(input.folderPath, { recursive: true });

  const stitchPromptPath = path.join(input.folderPath, "stitchPrompt.txt");
  const tokensPath = path.join(input.folderPath, "tokens.json");
  const scorePath = path.join(input.folderPath, "score.json");

  await fs.writeFile(stitchPromptPath, `${input.prompt.trim()}\n`, "utf8");
  await fs.writeFile(tokensPath, `${JSON.stringify(input.tokensJson, null, 2)}\n`, "utf8");

  const scorePayload = {
    url: input.url,
    captured_at: new Date().toISOString(),
    runtime_seconds: deriveRuntimeSeconds(input.score),
    visual_fidelity_1_to_5: input.score?.visual_fidelity_1_to_5 ?? 0,
    component_fidelity_1_to_5: input.score?.component_fidelity_1_to_5 ?? 0,
    token_quality_1_to_5: input.score?.token_quality_1_to_5 ?? 0,
    notes: input.score?.notes ?? "",
  };

  await fs.writeFile(scorePath, `${JSON.stringify(scorePayload, null, 2)}\n`, "utf8");

  return {
    stitchPromptPath,
    tokensPath,
    scorePath,
  };
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: "Benchmark snapshot writing is disabled in production.",
      },
      { status: 403 },
    );
  }

  try {
    const body = requestSchema.parse(await request.json());

    let sourceUrl = body.url;
    let prompt = body.prompt ?? "";
    let tokensJson = body.tokens_json;

    if (body.analysis_id) {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Log in required for analysis-based snapshots." }, { status: 401 });
      }

      const { data: history, error } = await supabase
        .from("analysis_history")
        .select("source_url, export_payload")
        .eq("id", body.analysis_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!history) {
        return NextResponse.json({ error: "Analysis history item not found." }, { status: 404 });
      }

      const exportPayload = (history.export_payload ?? {}) as {
        source_url?: string;
        design_prompt?: string;
      };

      sourceUrl = sourceUrl ?? history.source_url ?? exportPayload.source_url;
      prompt = prompt || exportPayload.design_prompt || "";
      tokensJson = tokensJson ?? history.export_payload ?? {};
    }

    if (!sourceUrl) {
      return NextResponse.json({ error: "url is required when analysis_id is missing." }, { status: 400 });
    }

    if (!prompt.trim()) {
      return NextResponse.json({ error: "prompt is required for snapshot saving." }, { status: 400 });
    }

    const folderName = slugFromUrl(sourceUrl);
    const baseFolder = path.join(process.cwd(), "test", "regression", folderName);

    const files = await writeSnapshotFiles({
      folderPath: baseFolder,
      prompt,
      tokensJson: tokensJson ?? {},
      score: body.score,
      url: sourceUrl,
    });

    return NextResponse.json({
      ok: true,
      folder: baseFolder,
      files,
      slug: folderName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save benchmark snapshot";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
