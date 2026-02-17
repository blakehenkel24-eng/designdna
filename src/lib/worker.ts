import { buildRecreationPrompt } from "@/lib/prompt";
import { assertRobotsAllowed } from "@/lib/robots";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ExtractionJobPayload } from "@/lib/types";
import { failExtraction, setExtractionProgress, setExtractionRunning, completeExtraction } from "@/lib/db";
import { toExtractionError } from "@/lib/errors";
import { captureDesignDna } from "@/lib/extractor/playwright-extractor";
import { assertPublicTarget, normalizeUrl } from "@/lib/url-security";

const STORAGE_BUCKET = "captures";
let storageChecked = false;

async function ensureStorageBucket() {
  if (storageChecked) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    throw error;
  }

  const exists = data.some((bucket) => bucket.name === STORAGE_BUCKET);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: "20MB",
    });

    if (createError) {
      throw createError;
    }
  }

  storageChecked = true;
}

export async function processExtractionJob(job: ExtractionJobPayload) {
  try {
    await setExtractionRunning(job.extractionId);

    const normalized = normalizeUrl(job.url);
    await assertPublicTarget(normalized);
    await setExtractionProgress(job.extractionId, 20);

    await assertRobotsAllowed(normalized);
    await setExtractionProgress(job.extractionId, 35);

    const capture = await captureDesignDna(normalized.toString());
    await setExtractionProgress(job.extractionId, 75);

    const promptText = buildRecreationPrompt(capture.pack);
    await ensureStorageBucket();

    const supabase = createSupabaseAdminClient();
    const screenshotPath = `${job.userId}/${job.extractionId}/screenshot.png`;
    const tracePath = `${job.userId}/${job.extractionId}/trace.html`;

    const { error: screenshotError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(screenshotPath, capture.screenshotBuffer, {
        upsert: true,
        contentType: "image/png",
      });

    if (screenshotError) {
      throw screenshotError;
    }

    const { error: traceError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(tracePath, capture.traceBuffer, {
        upsert: true,
        contentType: "text/html",
      });

    if (traceError) {
      throw traceError;
    }

    await completeExtraction(job.extractionId, {
      promptText,
      packJson: capture.pack,
      screenshotPath,
      tracePath,
    });
  } catch (error) {
    const extractedError = toExtractionError(error);

    await failExtraction(
      job.extractionId,
      extractedError.code,
      extractedError.message,
      extractedError.code === "TARGET_BLOCKED" ? extractedError.message : null,
    );
  }
}
