import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const STORAGE_BUCKET = "captures";

export async function cleanupExpiredArtifacts(now = new Date()) {
  const supabase = createSupabaseAdminClient();

  const { data: expiredExtractions, error: extractionError } = await supabase
    .from("extractions")
    .select("id")
    .lt("expires_at", now.toISOString());

  if (extractionError) {
    throw extractionError;
  }

  if (!expiredExtractions || expiredExtractions.length === 0) {
    return { deletedArtifacts: 0, deletedFiles: 0 };
  }

  const extractionIds = expiredExtractions.map((item) => item.id);

  const { data: artifacts, error: artifactsError } = await supabase
    .from("extraction_artifacts")
    .select("id, extraction_id, screenshot_path, trace_path")
    .in("extraction_id", extractionIds);

  if (artifactsError) {
    throw artifactsError;
  }

  const files = (artifacts ?? [])
    .flatMap((artifact) => [artifact.screenshot_path, artifact.trace_path])
    .filter((path): path is string => Boolean(path));

  if (files.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(files);

    if (storageError) {
      throw storageError;
    }
  }

  if ((artifacts ?? []).length > 0) {
    const artifactIds = artifacts!.map((artifact) => artifact.id);
    const { error: deleteArtifactsError } = await supabase
      .from("extraction_artifacts")
      .delete()
      .in("id", artifactIds);

    if (deleteArtifactsError) {
      throw deleteArtifactsError;
    }
  }

  return {
    deletedArtifacts: artifacts?.length ?? 0,
    deletedFiles: files.length,
  };
}
