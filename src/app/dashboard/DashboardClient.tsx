"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { DesignDnaPack, DesignTokenFrequency, ExtractionRow } from "@/lib/types";

import styles from "./DashboardClient.module.css";

type Props = {
  initialExtractions: ExtractionRow[];
  userEmail: string;
};

type TabId = "prompt" | "overview" | "colors" | "typography" | "effects" | "structure";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "prompt", label: "LLM Prompt" },
  { id: "overview", label: "Overview" },
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "effects", label: "Effects" },
  { id: "structure", label: "Structure" },
];
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

function normalizeUrlInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return URL_SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function formatDate(value: string | null) {
  if (!value) return "N/A";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function topItems(items: DesignTokenFrequency[], limit = 8) {
  return items.slice(0, limit);
}

export function DashboardClient({ initialExtractions, userEmail }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("prompt");
  const [extractions, setExtractions] = useState(initialExtractions);
  const [selectedId, setSelectedId] = useState<string | null>(initialExtractions[0]?.id ?? null);
  const [selectedExtraction, setSelectedExtraction] = useState<ExtractionRow | null>(
    initialExtractions[0] ?? null,
  );
  const [prompt, setPrompt] = useState<string>("");
  const [pack, setPack] = useState<DesignDnaPack | null>(null);

  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  async function refreshHistory(preferredId?: string) {
    setRefreshing(true);
    const response = await fetch("/api/extractions", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      setRefreshing(false);
      return;
    }

    const payload = await response.json();
    const items: ExtractionRow[] = payload.items ?? [];
    setExtractions(items);
    setRefreshing(false);

    if (preferredId) {
      setStatusError(null);
      setPrompt("");
      setPack(null);
      const preferred = items.find((item) => item.id === preferredId) ?? null;
      setSelectedExtraction(preferred);
      setSelectedId(preferredId);
      return;
    }

    if (!selectedId && items[0]) {
      setStatusError(null);
      setPrompt("");
      setPack(null);
      setSelectedExtraction(items[0]);
      setSelectedId(items[0].id);
      return;
    }

    if (selectedId && !items.some((item) => item.id === selectedId)) {
      setStatusError(null);
      setPrompt("");
      setPack(null);
      setSelectedExtraction(items[0] ?? null);
      setSelectedId(items[0]?.id ?? null);
    }
  }

  async function submitExtraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUrl = normalizeUrlInput(url);
    if (!normalizedUrl) return;

    setLoading(true);
    setError(null);
    setStatusError(null);
    setCopyMessage(null);

    const response = await fetch("/api/extractions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: normalizedUrl }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.message ?? "Failed to queue extraction");
      setLoading(false);
      return;
    }

    setUrl("");
    setLoading(false);
    setActiveTab("prompt");
    await refreshHistory(payload.extractionId);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function copyPrompt() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopyMessage("Prompt copied.");
    window.setTimeout(() => setCopyMessage(null), 1300);
  }

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    let cancelled = false;
    let timer: NodeJS.Timeout | null = null;

    async function loadPrompt(extractionId: string) {
      const response = await fetch(`/api/extractions/${extractionId}/prompt`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!cancelled && response.ok) {
        setPrompt(payload.prompt ?? "");
      }
    }

    async function loadPack(extractionId: string) {
      const response = await fetch(`/api/extractions/${extractionId}/pack`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!cancelled && response.ok) {
        setPack(payload.pack ?? null);
      }
    }

    async function loadArtifacts(extractionId: string) {
      await Promise.all([loadPrompt(extractionId), loadPack(extractionId)]);
    }

    async function poll(extractionId: string) {
      const response = await fetch(`/api/extractions/${extractionId}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        if (!cancelled) {
          setStatusError(payload.message ?? "Failed to fetch extraction status");
        }
        return;
      }

      if (cancelled) return;
      const item = payload.item as ExtractionRow;
      setSelectedExtraction(item);
      setExtractions((prev) => {
        const exists = prev.some((existing) => existing.id === item.id);
        if (!exists) return [item, ...prev];
        return prev.map((existing) => (existing.id === item.id ? item : existing));
      });

      if (item.status === "completed") {
        await loadArtifacts(extractionId);
        return;
      }

      if (item.status === "failed") {
        return;
      }

      timer = setTimeout(() => {
        void poll(extractionId);
      }, 2500);
    }

    void poll(selectedId);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [selectedId]);

  const promptReady = selectedExtraction?.status === "completed" && !!prompt;
  const packReady = selectedExtraction?.status === "completed" && !!pack;

  function renderTokenList(items: DesignTokenFrequency[], emptyLabel: string) {
    if (items.length === 0) {
      return <p className={styles.helperText}>{emptyLabel}</p>;
    }

    return (
      <ul className={styles.tokenList}>
        {items.map((item) => (
          <li key={`${item.value}-${item.count}`}>
            <span>{item.value}</span>
            <strong>{item.count}</strong>
          </li>
        ))}
      </ul>
    );
  }

  function renderActiveTab() {
    if (!selectedExtraction) {
      return <p className={styles.helperText}>No extractions yet. Capture a URL to begin.</p>;
    }

    if (selectedExtraction.status !== "completed") {
      return (
        <div className={styles.statusState}>
          <p>
            Current extraction status:{" "}
            <span className={`status status-${selectedExtraction.status}`}>
              {selectedExtraction.status}
            </span>
          </p>
          <p>Progress: {selectedExtraction.progress_pct}%</p>
          {selectedExtraction.error_message ? (
            <p className="error">
              {selectedExtraction.error_code}: {selectedExtraction.error_message}
            </p>
          ) : null}
        </div>
      );
    }

    if (!packReady) {
      return <p className={styles.helperText}>Loading extraction artifacts...</p>;
    }

    switch (activeTab) {
      case "prompt":
        return (
          <div className={styles.promptPanel}>
            <div className={styles.instructions}>
              <h3>How to use this prompt</h3>
              <ol>
                <li>Copy the prompt into your preferred LLM.</li>
                <li>Ask it to recreate the source experience with your own brand/content.</li>
                <li>Use token tabs to iterate on visual details quickly.</li>
              </ol>
            </div>
            <div className={styles.panelHeader}>
              <div>
                <h3>Design Recreation Prompt</h3>
                <p>LLM-focused output derived from the captured page.</p>
              </div>
              <button
                type="button"
                className="secondary-button"
                disabled={!promptReady}
                onClick={copyPrompt}
              >
                Copy Prompt
              </button>
            </div>
            {copyMessage ? <p className="success">{copyMessage}</p> : null}
            <pre className={styles.promptBlock}>{prompt}</pre>
          </div>
        );

      case "overview":
        return (
          <div className={styles.dataGrid}>
            <article className={styles.infoCard}>
              <h3>Capture</h3>
              <p>
                <strong>URL:</strong> {pack.meta.url}
              </p>
              <p>
                <strong>Captured:</strong> {formatDate(pack.meta.captured_at)}
              </p>
              <p>
                <strong>Viewport:</strong> {pack.meta.viewport.width}x{pack.meta.viewport.height}
              </p>
              <p>
                <strong>Confidence:</strong> {(pack.confidence.overall * 100).toFixed(1)}%
              </p>
            </article>
            <article className={styles.infoCard}>
              <h3>Summary</h3>
              <p>{pack.recreation_guidance.objective}</p>
              <p>
                <strong>Sections:</strong> {pack.layout_map.sections.length}
              </p>
              <p>
                <strong>Components:</strong> {pack.components.length}
              </p>
              <p>
                <strong>Headings:</strong> {pack.content_summary.headings.length}
              </p>
            </article>
          </div>
        );

      case "colors":
        return (
          <div className={styles.dataGrid}>
            <article className={styles.infoCard}>
              <h3>Dominant Colors</h3>
              <div className={styles.swatchRow}>
                {pack.vision_summary.dominant_colors.map((color) => (
                  <div key={color} className={styles.swatch}>
                    <span style={{ backgroundColor: color }} />
                    <code>{color}</code>
                  </div>
                ))}
              </div>
            </article>
            <article className={styles.infoCard}>
              <h3>Top Color Tokens</h3>
              {renderTokenList(topItems(pack.design_tokens.colors, 12), "No color tokens available.")}
            </article>
          </div>
        );

      case "typography":
        return (
          <div className={styles.dataGrid}>
            <article className={styles.infoCard}>
              <h3>Font Families</h3>
              {renderTokenList(
                topItems(pack.design_tokens.typography.families),
                "No font families available.",
              )}
            </article>
            <article className={styles.infoCard}>
              <h3>Sizes</h3>
              {renderTokenList(topItems(pack.design_tokens.typography.sizes), "No font sizes available.")}
            </article>
            <article className={styles.infoCard}>
              <h3>Weights</h3>
              {renderTokenList(
                topItems(pack.design_tokens.typography.weights),
                "No font weights available.",
              )}
            </article>
          </div>
        );

      case "effects":
        return (
          <div className={styles.dataGrid}>
            <article className={styles.infoCard}>
              <h3>Effects</h3>
              {renderTokenList(topItems(pack.design_tokens.effects), "No effects available.")}
            </article>
            <article className={styles.infoCard}>
              <h3>Shadows</h3>
              {renderTokenList(topItems(pack.design_tokens.shadows), "No shadows available.")}
            </article>
            <article className={styles.infoCard}>
              <h3>Radii + Spacing</h3>
              {renderTokenList(
                [...topItems(pack.design_tokens.radii, 5), ...topItems(pack.design_tokens.spacing, 5)],
                "No radii/spacing tokens available.",
              )}
            </article>
          </div>
        );

      case "structure":
        return (
          <div className={styles.dataGrid}>
            <article className={styles.infoCard}>
              <h3>Section Map</h3>
              <ul className={styles.sectionList}>
                {pack.layout_map.sections.slice(0, 10).map((section) => (
                  <li key={section.id}>
                    <span>{section.role}</span>
                    <code>{section.selector}</code>
                  </li>
                ))}
              </ul>
            </article>
            <article className={styles.infoCard}>
              <h3>Constraints + Warnings</h3>
              <ul className={styles.noteList}>
                {pack.recreation_guidance.constraints.map((constraint) => (
                  <li key={constraint}>{constraint}</li>
                ))}
                {pack.recreation_guidance.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </article>
          </div>
        );
    }
  }

  return (
    <div className={styles.workspaceRoot}>
      <header className={styles.workspaceHeader}>
        <div>
          <h1>Capture Website Design DNA</h1>
          <p>Signed in as {userEmail}</p>
        </div>
        <div className={styles.headerActions}>
          <Link className="secondary-button" href="/policy">
            Policy
          </Link>
          <button className="secondary-button" onClick={signOut} type="button">
            Sign out
          </button>
        </div>
      </header>

      <section className={styles.captureCard}>
        <h2>Enter a URL to extract design DNA and generate an LLM-ready prompt.</h2>
        <form className={styles.captureForm} onSubmit={submitExtraction}>
          <input
            type="text"
            inputMode="url"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="example.com or https://example.com"
          />
          <button disabled={loading} type="submit">
            {loading ? "Capturing..." : "Capture"}
          </button>
        </form>
        {error ? <p className="error">{error}</p> : null}
        {statusError ? <p className="error">{statusError}</p> : null}
        {selectedExtraction ? (
          <div className={styles.captureProgress}>
            <p className={styles.captureMeta}>
              Active extraction:{" "}
              <button type="button" onClick={() => setActiveTab("prompt")}>
                {selectedExtraction.id.slice(0, 8)}
              </button>
              <span className={`status status-${selectedExtraction.status}`}>
                {selectedExtraction.status}
              </span>
              <strong>{selectedExtraction.progress_pct}%</strong>
            </p>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={selectedExtraction.progress_pct}
              aria-label="Extraction progress"
            >
              <div
                className={`${styles.progressFill} ${
                  selectedExtraction.status === "queued" || selectedExtraction.status === "running"
                    ? styles.progressFillAnimated
                    : ""
                }`}
                style={{
                  width: `${Math.min(100, Math.max(0, selectedExtraction.progress_pct))}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section className={styles.analysisCard}>
        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={tab.id === activeTab ? styles.tabActive : styles.tab}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.panel}>{renderActiveTab()}</div>
      </section>

      <section className={styles.historyCard}>
        <div className={styles.panelHeader}>
          <div>
            <h3>Recent Extractions</h3>
            <p>Click any item to inspect it in the tabs above.</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void refreshHistory()}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <ul className={styles.historyList}>
          {extractions.length === 0 ? <li>No extractions yet.</li> : null}
          {extractions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  setStatusError(null);
                  setPrompt("");
                  setPack(null);
                  setSelectedExtraction(item);
                  setSelectedId(item.id);
                }}
              >
                <span>{item.url}</span>
                <span className={`status status-${item.status}`}>{item.status}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
