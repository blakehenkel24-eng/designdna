import { dequeueExtractionJob } from "@/lib/queue";
import { processExtractionJob } from "@/lib/worker";

const POLL_INTERVAL_MS = 2000;

let active = true;

process.on("SIGINT", () => {
  active = false;
});

process.on("SIGTERM", () => {
  active = false;
});

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("DesignDNA worker started");

  while (active) {
    const job = await dequeueExtractionJob();

    if (!job) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    console.log(`Processing extraction ${job.extractionId}`);
    await processExtractionJob(job);
  }

  console.log("DesignDNA worker stopped");
}

main().catch((error) => {
  console.error("Worker failed", error);
  process.exit(1);
});
