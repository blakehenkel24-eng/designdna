"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { DesignDnaPack, ExtractionRow } from "@/lib/types";

type Props = {
  extractionId: string;
  initialExtraction: ExtractionRow;
};

export function ExtractionStatusClient({ extractionId, initialExtraction }: Props) {
  const [extraction, setExtraction] = useState(initialExtraction);
  const [prompt, setPrompt] = useState<string>("");
  const [pack, setPack] = useState<DesignDnaPack | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    async function poll() {
      const response = await fetch(`/api/extractions/${extractionId}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.message ?? "Failed to fetch extraction status");
        return;
      }

      setExtraction(payload.item);

      if (payload.item.status === "completed") {
        await Promise.all([loadPrompt(), loadPack()]);
        return;
      }

      if (payload.item.status === "failed") {
        return;
      }

      timer = setTimeout(poll, 2500);
    }

    async function loadPrompt() {
      const response = await fetch(`/api/extractions/${extractionId}/prompt`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (response.ok) {
        setPrompt(payload.prompt ?? "");
      }
    }

    async function loadPack() {
      const response = await fetch(`/api/extractions/${extractionId}/pack`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (response.ok) {
        setPack(payload.pack ?? null);
      }
    }

    if (initialExtraction.status === "completed") {
      void Promise.all([loadPrompt(), loadPack()]);
    } else {
      void poll();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [extractionId, initialExtraction.status]);

  function downloadPack() {
    if (!pack) return;

    const blob = new Blob([JSON.stringify(pack, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `design_dna_pack_${extractionId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page-shell">
      <section className="card">
        <div className="section-header">
          <h1>Extraction status</h1>
          <Link href="/" className="secondary-button">
            Back
          </Link>
        </div>
        <p>
          <strong>URL:</strong> {extraction.url}
        </p>
        <p>
          <strong>Status:</strong>{" "}
          <span className={`status status-${extraction.status}`}>{extraction.status}</span>
        </p>
        <p>
          <strong>Progress:</strong> {extraction.progress_pct}%
        </p>

        {extraction.status === "failed" ? (
          <p className="error">
            {extraction.error_code}: {extraction.error_message}
          </p>
        ) : null}

        {error ? <p className="error">{error}</p> : null}
      </section>

      {extraction.status === "completed" ? (
        <>
          <section className="card">
            <div className="section-header">
              <h2>LLM-ready prompt</h2>
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigator.clipboard.writeText(prompt)}
              >
                Copy
              </button>
            </div>
            <pre className="output-block">{prompt}</pre>
          </section>

          <section className="card">
            <div className="section-header">
              <h2>Design DNA pack</h2>
              <button type="button" className="secondary-button" onClick={downloadPack}>
                Download JSON
              </button>
            </div>
            <pre className="output-block">{pack ? JSON.stringify(pack, null, 2) : ""}</pre>
          </section>
        </>
      ) : null}
    </main>
  );
}
