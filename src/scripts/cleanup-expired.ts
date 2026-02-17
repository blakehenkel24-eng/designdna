import { cleanupExpiredArtifacts } from "@/lib/cleanup";

async function main() {
  const result = await cleanupExpiredArtifacts();
  console.log(
    `Cleanup complete. Deleted ${result.deletedArtifacts} artifacts and ${result.deletedFiles} files.`,
  );
}

main().catch((error) => {
  console.error("Cleanup failed", error);
  process.exit(1);
});
