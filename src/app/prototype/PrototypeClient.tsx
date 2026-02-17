"use client";

import { FormEvent, useState } from "react";

type ApiResponse = {
  status: "completed" | "failed";
  url?: string;
  prompt?: string;
  summary?: string;
  designBlueprint?: {
    themeReference: string;
    colors: string[];
    typography: string[];
    effects: string[];
    htmlStructure: string[];
  };
  starterHtmlCss?: string;
  pack?: unknown;
  error?: string;
};

export function PrototypeClient() {
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [actionMessage, setActionMessage] = useState<string>("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/prototype/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const payload = (await response.json()) as ApiResponse;
      setResult(payload);
      setActionMessage("");
    } catch (error) {
      setResult({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setActionMessage(`${label} copied.`);
    } catch {
      setActionMessage(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  function downloadText(filename: string, content: string, type = "text/plain") {
    const blob = new Blob([content], { type });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(href);
    setActionMessage(`${filename} downloaded.`);
  }

  function buildMarkdownExport(data: ApiResponse) {
    return [
      "# DesignDNA Prototype Export",
      "",
      `- URL: ${data.url ?? ""}`,
      `- Status: ${data.status}`,
      "",
      "## AI Summary",
      data.summary ?? "",
      "",
      "## Design Blueprint",
      `- Theme Reference: ${data.designBlueprint?.themeReference ?? ""}`,
      `- Colors: ${(data.designBlueprint?.colors ?? []).join(", ")}`,
      `- Typography: ${(data.designBlueprint?.typography ?? []).join(", ")}`,
      `- Effects: ${(data.designBlueprint?.effects ?? []).join(", ")}`,
      `- HTML Structure: ${(data.designBlueprint?.htmlStructure ?? []).join(", ")}`,
      "",
      "## LLM-ready Prompt",
      data.prompt ?? "",
      "",
      "## Starter HTML + CSS",
      "```html",
      data.starterHtmlCss ?? "",
      "```",
      "",
      "## Raw Design Pack",
      "```json",
      JSON.stringify(data.pack ?? {}, null, 2),
      "```",
      "",
    ].join("\n");
  }

  return (
    <main className="page-shell">
      <section className="card">
        <h1>DesignDNA Prototype</h1>
        <p className="muted">
          Paste a public URL. We scan it, then AI generates a recreation prompt and summary.
        </p>

        <form className="inline-form" onSubmit={onSubmit}>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            type="url"
            required
            placeholder="https://example.com"
          />
          <button type="submit" disabled={loading}>
            {loading ? "Analyzing..." : "Analyze with AI"}
          </button>
        </form>
      </section>

      {result ? (
        <section className="card">
          <div className="section-header">
            <h2>Status: {result.status}</h2>
            {result.status === "completed" ? (
              <div className="hero-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    downloadText(
                      "design-dna-result.json",
                      JSON.stringify(result, null, 2),
                      "application/json",
                    )
                  }
                >
                  Download JSON
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    downloadText(
                      "design-dna-result.md",
                      buildMarkdownExport(result),
                      "text/markdown",
                    )
                  }
                >
                  Download Markdown
                </button>
              </div>
            ) : null}
          </div>
          {actionMessage ? <p className="success">{actionMessage}</p> : null}
          {result.status === "failed" ? (
            <p className="error">{result.error}</p>
          ) : (
            <>
              <p>
                <strong>URL:</strong> {result.url}
              </p>
              <div className="section-header">
                <h3>AI summary</h3>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => copyText(result.summary ?? "", "Summary")}
                >
                  Copy
                </button>
              </div>
              <pre className="output-block">{result.summary}</pre>
              <div className="section-header">
                <h3>LLM-ready prompt</h3>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => copyText(result.prompt ?? "", "Prompt")}
                >
                  Copy
                </button>
              </div>
              <pre className="output-block">{result.prompt}</pre>
              <div className="section-header">
                <h3>Design blueprint</h3>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    copyText(
                      JSON.stringify(result.designBlueprint ?? {}, null, 2),
                      "Design blueprint",
                    )
                  }
                >
                  Copy
                </button>
              </div>
              <pre className="output-block">
                {JSON.stringify(result.designBlueprint ?? {}, null, 2)}
              </pre>
              <div className="section-header">
                <h3>Starter HTML + CSS</h3>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => copyText(result.starterHtmlCss ?? "", "Starter HTML + CSS")}
                >
                  Copy
                </button>
              </div>
              <pre className="output-block">{result.starterHtmlCss}</pre>
              <h3>Raw design pack</h3>
              <pre className="output-block">{JSON.stringify(result.pack, null, 2)}</pre>
            </>
          )}
        </section>
      ) : null}
    </main>
  );
}
