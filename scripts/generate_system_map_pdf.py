#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = Path("output/pdf/designdna-system-map.pdf")
OUT.parent.mkdir(parents=True, exist_ok=True)


def build_styles():
    base = getSampleStyleSheet()

    title = ParagraphStyle(
        "TitleMain",
        parent=base["Title"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=12,
    )
    subtitle = ParagraphStyle(
        "Subtitle",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#334155"),
        spaceAfter=8,
    )
    h1 = ParagraphStyle(
        "H1",
        parent=base["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=8,
        spaceAfter=8,
    )
    h2 = ParagraphStyle(
        "H2",
        parent=base["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12.5,
        leading=16,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=6,
        spaceAfter=6,
    )
    body = ParagraphStyle(
        "Body",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#111827"),
        spaceAfter=6,
    )
    bullet = ParagraphStyle(
        "Bullet",
        parent=body,
        leftIndent=14,
        firstLineIndent=-10,
    )
    code = ParagraphStyle(
        "Code",
        parent=body,
        fontName="Courier",
        fontSize=8.6,
        leading=11,
        textColor=colors.HexColor("#111827"),
    )
    table_header = ParagraphStyle(
        "TableHeader",
        parent=body,
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
    )
    table_cell = ParagraphStyle(
        "TableCell",
        parent=body,
        fontName="Helvetica",
        fontSize=8.6,
        leading=11,
        textColor=colors.HexColor("#111827"),
    )

    return {
        "title": title,
        "subtitle": subtitle,
        "h1": h1,
        "h2": h2,
        "body": body,
        "bullet": bullet,
        "code": code,
        "table_header": table_header,
        "table_cell": table_cell,
    }


def p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(text).replace("\n", "<br/>"), style)


def add_bullets(story: list, items: list[str], style: ParagraphStyle):
    for item in items:
        story.append(p(f"- {item}", style))


def add_table(
    story: list,
    styles: dict[str, ParagraphStyle],
    rows: list[list[str]],
    widths: list[float],
):
    formatted: list[list[Paragraph]] = []
    for idx, row in enumerate(rows):
        row_style = styles["table_header"] if idx == 0 else styles["table_cell"]
        formatted.append([p(cell, row_style) for cell in row])

    table = Table(formatted, colWidths=widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 0.14 * inch))


def draw_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#cbd5e1"))
    canvas.setLineWidth(0.6)
    canvas.line(doc.leftMargin, 0.68 * inch, doc.pagesize[0] - doc.rightMargin, 0.68 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#475569"))
    canvas.drawString(doc.leftMargin, 0.48 * inch, "DesignDNA System Map - generated from repository files")
    canvas.drawRightString(doc.pagesize[0] - doc.rightMargin, 0.48 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_story(styles: dict[str, ParagraphStyle]) -> list:
    story: list = []
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    story.append(p("DesignDNA System Map", styles["title"]))
    story.append(p("A plain-language guide to how the full codebase works", styles["subtitle"]))
    story.append(p(f"Generated: {generated_at}", styles["subtitle"]))
    story.append(Spacer(1, 0.16 * inch))

    story.append(p("What this document is for", styles["h2"]))
    add_bullets(
        story,
        [
            "Give a non-technical owner a complete map of how DesignDNA works, from page click to database write.",
            "Show where each responsibility lives in the repository, so you can ask targeted questions and review changes with confidence.",
            "Translate code-level behavior into business-level language without hiding the technical truth.",
            "Provide file paths for every major subsystem so this can also be used by technical teammates as a shared source of truth.",
        ],
        styles["bullet"],
    )
    story.append(Spacer(1, 0.14 * inch))

    story.append(p("Read this first: one-sentence model", styles["h2"]))
    story.append(
        p(
            "DesignDNA is a Next.js web application that takes a public webpage URL, runs a capture and analysis pipeline, "
            "and returns reusable design outputs (prompt, summary, tokens, structure), while enforcing auth, limits, pricing, and storage policies.",
            styles["body"],
        )
    )

    story.append(p("Evidence baseline", styles["h2"]))
    add_bullets(
        story,
        [
            "Architecture docs: docs/architecture.md, docs/api-reference.md, docs/data-model.md, docs/configuration.md, docs/operations.md, docs/repository-map.md",
            "Runtime code: src/app/*, src/app/api/*, src/lib/*, src/worker/*",
            "Database schema: supabase/migrations/*.sql and src/types/database.ts",
            "Deployment config: next.config.ts, vercel.json, package.json",
        ],
        styles["bullet"],
    )

    story.append(PageBreak())

    story.append(p("1. System Boundaries", styles["h1"]))
    story.append(
        p(
            "This section defines what is inside the DesignDNA system and what sits outside of it.",
            styles["body"],
        )
    )
    add_table(
        story,
        styles,
        [
            ["Boundary", "Inside DesignDNA", "Outside DesignDNA"],
            [
                "User experience",
                "Next.js pages/components and static HTML pages that users interact with.",
                "Any external website a user submits for analysis.",
            ],
            [
                "Analysis engine",
                "Playwright capture, token extraction, prompt compiler, optional LLM refinement.",
                "Third-party model providers and their availability/performance.",
            ],
            [
                "Data storage",
                "Supabase tables and private captures storage bucket.",
                "User devices, browser local cache, third-party databases.",
            ],
            [
                "Auth and identity",
                "Supabase auth session handling and callback endpoints.",
                "Google identity platform and email delivery providers.",
            ],
            [
                "Rate limiting and queues",
                "Upstash Redis calls from app and worker code.",
                "Upstash service reliability and regional network behavior.",
            ],
            [
                "Operations",
                "Vercel cron endpoint, cleanup script, worker loop, test harness.",
                "Vercel scheduler runtime guarantees and platform-level outages.",
            ],
        ],
        [1.35 * inch, 2.45 * inch, 2.45 * inch],
    )

    story.append(p("External dependency map", styles["h2"]))
    add_table(
        story,
        styles,
        [
            ["Dependency", "Role in the system", "Where it is integrated"],
            ["Next.js 16", "Web runtime and API routing", "src/app, src/app/api, src/proxy.ts"],
            ["Supabase", "Auth, Postgres database, private file storage", "src/lib/supabase/*, src/lib/db.ts, migrations"],
            ["Upstash Redis", "Rate limit counters and extraction job queue", "src/lib/rate-limit.ts, src/lib/queue.ts"],
            ["Playwright", "Capture DOM/CSS/screenshot and build design pack", "src/lib/extractor/playwright-extractor.ts"],
            ["OpenAI-compatible chat API", "Optional semantic enhancement and structured JSON output", "src/lib/openai-enhance.ts"],
            ["Vercel", "Hosting + scheduled cleanup cron execution", "vercel.json, src/app/api/cron/cleanup/route.ts"],
        ],
        [1.35 * inch, 2.65 * inch, 2.25 * inch],
    )

    story.append(PageBreak())

    story.append(p("2. Product Surface: What Users Can Open", styles["h1"]))
    story.append(
        p(
            "DesignDNA currently combines static marketing pages with app routes and API routes. "
            "A key detail: the root route redirects to a static HTML experience.",
            styles["body"],
        )
    )
    add_table(
        story,
        styles,
        [
            ["URL / Route", "Who uses it", "What it does", "Primary files"],
            [
                "/",
                "All visitors",
                "Immediate redirect to the static landing runtime page.",
                "src/app/page.tsx, public/designdna-exact.html",
            ],
            [
                "/designdna-exact.html",
                "All visitors",
                "Main static landing/app shell served from public assets.",
                "public/designdna-exact.html",
            ],
            [
                "/prototype",
                "Guests or logged-in users",
                "Paste URL, run analysis, see summary/prompt/pack, copy and download outputs.",
                "src/app/prototype/page.tsx, src/app/prototype/PrototypeClient.tsx",
            ],
            [
                "/login",
                "Users who need auth",
                "Email/password signup/login and entry to Google OAuth flow.",
                "src/app/login/page.tsx, src/app/login/LoginForm.tsx",
            ],
            [
                "/login/reset-password",
                "Users from reset email links",
                "Set a new password inside an authenticated recovery session.",
                "src/app/login/reset-password/*",
            ],
            [
                "/extractions/[id]",
                "Logged-in users",
                "Poll extraction status and download prompt/pack when completed.",
                "src/app/extractions/[id]/*",
            ],
            [
                "/dashboard",
                "Intended logged-in users",
                "Currently redirects to root, but a full DashboardClient exists in code.",
                "src/app/dashboard/page.tsx, src/app/dashboard/DashboardClient.tsx",
            ],
            [
                "/policy",
                "All visitors",
                "Static acceptable-use policy summary.",
                "src/app/policy/page.tsx",
            ],
            [
                "/pricing.html, /documentation.html, /about.html",
                "All visitors",
                "Static marketing and informational pages.",
                "public/pricing.html, public/documentation.html, public/about.html",
            ],
        ],
        [1.05 * inch, 1.25 * inch, 2.45 * inch, 2.35 * inch],
    )

    story.append(p("Frontend state model (non-technical translation)", styles["h2"]))
    add_bullets(
        story,
        [
            "Prototype page state: the URL field, loading spinner, result payload, and copy/download feedback messages.",
            "Extraction status page state: current extraction row, prompt text, pack JSON, polling timer, and failure message.",
            "Login page state: mode toggle (login/signup), credential fields, forgot-password path, resend verification path, and messages.",
            "Dashboard client state (currently dormant route): extraction history list, selected extraction, tabs, prompt/pack artifacts, and sign-out action.",
        ],
        styles["bullet"],
    )
    story.append(
        p(
            "Why this matters: these client states tell you where user confusion can happen (loading, failed states, stale data) even if no backend bug exists.",
            styles["body"],
        )
    )

    story.append(PageBreak())

    story.append(p("3. API Inventory and Ownership", styles["h1"]))
    story.append(
        p(
            "All HTTP APIs live under src/app/api/**/route.ts. The table below groups them by business purpose.",
            styles["body"],
        )
    )

    add_table(
        story,
        styles,
        [
            ["Endpoint", "Method", "Auth", "Business purpose"],
            ["/api/analyze", "POST", "Optional", "Run synchronous analysis pipeline and return summary/prompt/export payload."],
            ["/api/prototype/extract", "POST", "Optional", "Alias that delegates directly to /api/analyze."],
            ["/api/me/entitlements", "GET", "Optional", "Return guest or logged-in usage/plan state."],
            ["/api/history", "GET", "Required", "Return analysis history for logged-in user, optional URL query filter."],
            ["/api/export/json", "POST", "Required", "Return full export JSON for one analysis if plan allows exports."],
            ["/api/topup", "POST", "Required", "Add +40 analyses only when user has zero remaining analyses."],
            ["/api/upgrade/pro", "POST", "Required", "Test-mode upgrade to PRO_ACTIVE plan."],
            ["/api/extractions", "GET", "Required", "List queued extraction jobs for logged-in user."],
            ["/api/extractions", "POST", "Required", "Consume daily quota, create job row, enqueue Redis payload."],
            ["/api/extractions/[id]", "GET", "Required", "Fetch one extraction row owned by the user."],
            ["/api/extractions/[id]/prompt", "GET", "Required", "Fetch prompt artifact for one extraction."],
            ["/api/extractions/[id]/pack", "GET", "Required", "Fetch design pack artifact for one extraction."],
            ["/api/auth/password", "POST", "Optional", "Email/password login or signup flow."],
            ["/api/auth/password/forgot", "POST", "Optional", "Send reset email with callback path."],
            ["/api/auth/password/resend", "POST", "Optional", "Resend signup verification email."],
            ["/api/auth/password/update", "POST", "Reset session", "Set a new password."],
            ["/api/auth/oauth/google", "GET", "Optional", "Start Google OAuth flow."],
            ["/auth/callback", "GET", "OAuth/email callback", "Exchange code for session and redirect to next path."],
            ["/api/auth/signout", "POST", "Required", "Sign out current user session."],
            ["/api/auth/events", "POST", "Optional", "Record a small allowlist of auth-related analytics events."],
            ["/api/benchmark/snapshot", "POST", "Mixed", "Save regression artifacts to test/regression (blocked in production)."],
            ["/api/cron/cleanup", "POST", "Secret header/token", "Delete expired artifact files and rows."],
        ],
        [1.9 * inch, 0.6 * inch, 0.95 * inch, 1.95 * inch],
    )

    story.append(p("Important API behavior details", styles["h2"]))
    add_bullets(
        story,
        [
            "/api/analyze sets cookie designdna_anon_uses for guests and enforces 1 lifetime guest analysis.",
            "/api/analyze supports x-ddna-debug-timing header to include step timing in the response payload.",
            "/api/export/json returns status 402 with PAID_REQUIRED_JSON_EXPORT for non-paid users.",
            "/api/topup returns status 409 TOPUP_NOT_AVAILABLE_YET if user still has remaining analyses.",
            "/api/cron/cleanup requires either x-cron-secret or Authorization: Bearer token matching CRON_CLEANUP_SECRET.",
        ],
        styles["bullet"],
    )

    story.append(PageBreak())

    story.append(p("4. End-to-End Flow A: Synchronous Analysis", styles["h1"]))
    story.append(
        p(
            "This is the main path used by /prototype and /api/analyze. It is designed to return useful output even if LLM enhancement fails.",
            styles["body"],
        )
    )

    story.append(p("Flow diagram (plain text)", styles["h2"]))
    story.append(
        p(
            "User submits URL -> /api/analyze -> rate limit check -> URL normalization -> public IP / robots checks -> "
            "Playwright capture -> deterministic prompt/tokens build -> optional LLM refinement -> "
            "entitlement-aware response + optional history save",
            styles["code"],
        )
    )

    story.append(p("Detailed step breakdown", styles["h2"]))
    add_table(
        story,
        styles,
        [
            ["Step", "What happens", "Where in code"],
            ["1. Parse request", "Validate request body has URL string.", "src/app/api/analyze/route.ts"],
            ["2. Identify caller", "If logged in use user ID, else use x-forwarded-for IP for rate limiting.", "src/app/api/analyze/route.ts"],
            ["3. Rate limit", "Upstash counter allows max 8 analyze requests per 60 seconds per identifier.", "src/lib/rate-limit.ts"],
            ["4. Normalize URL", "Trim input, auto-add https:// if missing, allow only http/https.", "src/lib/url-security.ts"],
            ["5. Block unsafe targets", "Reject localhost/.local/private IP results to prevent SSRF-like internal scans.", "src/lib/url-security.ts"],
            ["6. robots policy", "Fetch robots.txt, only block on explicit disallow for DesignDNA user agent.", "src/lib/robots.ts"],
            ["7. Capture page", "Playwright captures DOM/style signals, screenshot, and trace package.", "src/lib/extractor/playwright-extractor.ts"],
            ["8. Deterministic output", "Build prompt and semantic tokens without LLM dependence.", "src/lib/prompt.ts, src/lib/compile-stitch.ts, src/lib/tokens-json.ts"],
            ["9. Optional LLM enhancement", "Call chat completions endpoint with strict JSON schema and retry logic.", "src/lib/openai-enhance.ts"],
            ["10. Pricing and history", "Consume quota for logged-in users and persist history payloads.", "src/lib/pricing.ts, src/lib/analyze-service.ts"],
            ["11. Return response", "Return completed/failed payload with entitlement flags and optional timing.", "src/app/api/analyze/route.ts"],
        ],
        [0.85 * inch, 3.1 * inch, 2.05 * inch],
    )

    story.append(p("Resilience model", styles["h2"]))
    add_bullets(
        story,
        [
            "If no LLM key exists, analysis still succeeds with deterministic output path no_api_key.",
            "If strict LLM JSON validation fails, the code attempts one repair request (max attempts capped at 2).",
            "If enhancement still fails, final path is deterministic_fallback and user still receives usable output.",
            "Telemetry writes are wrapped in trackEventSafe so analytics failures do not fail user analysis.",
        ],
        styles["bullet"],
    )

    story.append(PageBreak())

    story.append(p("5. End-to-End Flow B: Queue + Worker Extraction", styles["h1"]))
    story.append(
        p(
            "This is the asynchronous path behind /api/extractions and extraction status pages.",
            styles["body"],
        )
    )

    story.append(p("Flow diagram (plain text)", styles["h2"]))
    story.append(
        p(
            "Client POST /api/extractions -> require login -> consume daily queue quota -> create extraction row (queued) -> "
            "push Redis job -> worker loop pops job -> run capture pipeline -> upload screenshot/trace -> "
            "write prompt/pack artifact row -> mark completed or failed",
            styles["code"],
        )
    )

    story.append(p("Worker state progression", styles["h2"]))
    add_bullets(
        story,
        [
            "Queued row starts at status queued and progress 0.",
            "setExtractionRunning sets status running and progress 10.",
            "After public target check progress moves to 20.",
            "After robots check progress moves to 35.",
            "After capture progress moves to 75.",
            "completeExtraction sets status completed and progress 100.",
            "Any error path writes status failed, error code/message, and completed timestamp.",
        ],
        styles["bullet"],
    )

    story.append(p("Queue and worker internals", styles["h2"]))
    add_table(
        story,
        styles,
        [
            ["Concern", "Behavior", "Code files"],
            ["Queue format", "JSON payload with extractionId, userId, url stored in Redis list designdna:extraction_jobs.", "src/lib/queue.ts"],
            ["Polling interval", "Worker checks queue every 2000 ms when empty.", "src/worker/index.ts"],
            ["Artifact storage", "Screenshot and trace upload to private captures bucket path userId/extractionId/...", "src/lib/worker.ts"],
            ["Bucket bootstrap", "Worker auto-creates captures bucket if missing (20MB file size limit, private).", "src/lib/worker.ts"],
            ["Public error handling", "Internal errors are translated to user-safe messages before persistence.", "src/lib/errors.ts, src/lib/worker.ts"],
        ],
        [1.2 * inch, 2.9 * inch, 1.9 * inch],
    )

    story.append(PageBreak())

    story.append(p("6. Data Model and Data Lifecycle", styles["h1"]))
    story.append(
        p(
            "The project uses Supabase Postgres with row-level security and a small set of core business tables.",
            styles["body"],
        )
    )

    story.append(p("Core table map", styles["h2"]))
    add_table(
        story,
        styles,
        [
            ["Table", "Business meaning", "Key fields"],
            ["extractions", "Queue job record for async extraction flow.", "status, progress_pct, url, started_at, completed_at, expires_at"],
            ["extraction_artifacts", "Output artifacts linked 1:1 with extraction.", "prompt_text, pack_json, screenshot_path, trace_path"],
            ["usage_counters", "Daily extraction counter per user for queue cap.", "user_id + date_utc primary key, extractions_count"],
            ["rate_limit_config", "Daily cap config table (free plan seed).", "plan, daily_cap"],
            ["user_entitlements", "Monthly plan and allowances for synchronous analysis features.", "plan, analyses_used_this_period, analyses_limit_this_period, topup_balance, period bounds"],
            ["analysis_history", "Saved outputs of synchronous analysis for logged-in users.", "source_url, preview_payload, export_payload, created_at"],
            ["analytics_events", "Telemetry event stream, service-role written.", "event_name, event_payload, created_at"],
        ],
        [1.25 * inch, 2.35 * inch, 2.4 * inch],
    )

    story.append(p("Relationships in plain language", styles["h2"]))
    add_bullets(
        story,
        [
            "A user can have many extraction jobs and many history rows.",
            "Each extraction job can have exactly one artifact row.",
            "Each user has one entitlement row that tracks current monthly period state.",
            "Daily queue usage is stored per user per UTC date.",
            "Analytics rows may or may not tie to a known user ID.",
        ],
        styles["bullet"],
    )

    story.append(p("Security and RLS model", styles["h2"]))
    add_bullets(
        story,
        [
            "User-facing tables have row-level security enabled.",
            "Common policy pattern: authenticated user can only read/write rows where auth.uid() equals user_id.",
            "analytics_events intentionally blocks client inserts (with check false) so normal clients cannot write telemetry directly.",
            "consume_user_quota is a security-definer RPC with execute granted to authenticated and service_role only.",
        ],
        styles["bullet"],
    )

    story.append(p("Data lifecycle timeline", styles["h2"]))
    add_bullets(
        story,
        [
            "Creation: analysis or extraction request inserts rows in history/extractions.",
            "Enrichment: artifacts and export payloads are attached once capture/enhancement completes.",
            "Use phase: users query history or extraction status through user-scoped endpoints.",
            "Expiry: extraction rows have expires_at and cleanup removes storage files + artifact rows after TTL.",
            "Retention detail: cleanup removes artifacts/files but does not delete extraction metadata rows.",
        ],
        styles["bullet"],
    )

    story.append(PageBreak())

    story.append(p("7. Pricing, Entitlements, and Usage Rules", styles["h1"]))
    story.append(
        p(
            "There are two different quota systems in the codebase. This is a common source of confusion, so it is called out explicitly.",
            styles["body"],
        )
    )

    add_table(
        story,
        styles,
        [
            ["Quota type", "Scope", "Default rule", "Where enforced"],
            ["Guest lifetime quota", "Anonymous synchronous analysis", "1 lifetime analysis via cookie designdna_anon_uses.", "src/lib/analyze-service.ts, /api/analyze"],
            ["Monthly entitlement quota", "Logged-in synchronous analysis", "FREE = 10/month, PRO = 100/month (+ topups).", "src/lib/pricing.ts, user_entitlements table"],
            ["Daily queue quota", "Logged-in async extraction queue", "EXTRACTION_DAILY_CAP default 10/day.", "consume_user_quota RPC, src/lib/db.ts"],
        ],
        [1.4 * inch, 1.4 * inch, 1.75 * inch, 1.8 * inch],
    )

    story.append(p("Plan behavior summary", styles["h2"]))
    add_bullets(
        story,
        [
            "ANONYMOUS plan is computed in API responses and cannot export JSON or view history.",
            "FREE users can analyze and view history but cannot export JSON.",
            "PRO_ACTIVE and PRO_CANCELED_GRACE can export JSON and have higher monthly limits.",
            "Topups add +40 analyses and are only allowed once remaining analyses reaches zero.",
            "Monthly reset logic recalculates period bounds and can reset used/topup counts when period expires.",
        ],
        styles["bullet"],
    )

    story.append(p("Pricing-related endpoints", styles["h2"]))
    add_bullets(
        story,
        [
            "/api/me/entitlements returns the user or guest entitlement object for UI gating.",
            "/api/export/json checks can_export_json and returns 402 for non-paid plans.",
            "/api/topup grants +40 analyses with guard TOPUP_NOT_AVAILABLE_YET.",
            "/api/upgrade/pro sets plan to PRO_ACTIVE in test mode.",
        ],
        styles["bullet"],
    )

    story.append(PageBreak())

    story.append(p("8. Security and Trust Boundaries", styles["h1"]))
    story.append(
        p(
            "The system includes practical protections to reduce abuse and accidental unsafe behavior.",
            styles["body"],
        )
    )

    add_table(
        story,
        styles,
        [
            ["Risk area", "Protection implemented", "Files"],
            ["Input validation", "zod schemas parse JSON bodies and reject malformed payloads early.", "src/app/api/*/route.ts"],
            ["Request flooding", "Upstash rate limit on /api/analyze: 8 requests per 60 seconds per user/IP key.", "src/lib/rate-limit.ts"],
            ["SSRF / internal scan risk", "URL normalization blocks localhost/.local and DNS-resolved private IPs.", "src/lib/url-security.ts"],
            ["Crawl policy compliance", "robots.txt checked for DesignDNA user agent and blocks explicit disallow paths.", "src/lib/robots.ts"],
            ["Error leakage", "Internal stack/runtime details are mapped to safe public error text.", "src/lib/errors.ts"],
            ["Privileged writes", "Service role Supabase client used for privileged DB and storage operations.", "src/lib/supabase/admin.ts"],
            ["Cron endpoint abuse", "Secret required in x-cron-secret or Bearer token for cleanup endpoint.", "src/app/api/cron/cleanup/route.ts"],
        ],
        [1.25 * inch, 2.8 * inch, 2.0 * inch],
    )

    story.append(p("Security caveats to understand", styles["h2"]))
    add_bullets(
        story,
        [
            "robots logic is fail-open for transient network/DNS issues; only explicit disallow blocks a target.",
            "If Upstash env vars are missing, rate-limit helper allows requests (fallback allowed: true).",
            "Guest usage is cookie-based and therefore browser/device scoped, not global identity scoped.",
            "Service role key exposure would be high risk because it bypasses user-scoped restrictions.",
        ],
        styles["bullet"],
    )

    story.append(PageBreak())

    story.append(p("9. Configuration and Secrets", styles["h1"]))
    story.append(
        p(
            "Environment variables are split between strict required config and optional tuning flags.",
            styles["body"],
        )
    )

    story.append(p("Validated required variables (zod in src/lib/env.ts)", styles["h2"]))
    add_table(
        story,
        styles,
        [
            ["Variable", "Required", "Default", "Purpose"],
            ["NEXT_PUBLIC_SUPABASE_URL", "Yes", "None", "Supabase URL for browser/server clients."],
            ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "Yes", "None", "Publishable key for browser/server clients."],
            ["SUPABASE_SERVICE_ROLE_KEY", "Yes", "None", "Privileged server-side DB/storage writes."],
            ["UPSTASH_REDIS_REST_URL", "Yes", "None", "Redis connection for rate limit and queue."],
            ["UPSTASH_REDIS_REST_TOKEN", "Yes", "None", "Redis auth token."],
            ["EXTRACTION_DAILY_CAP", "No", "10", "Daily async extraction quota cap."],
            ["ARTIFACT_TTL_HOURS", "No", "24", "Expiration window for extraction artifacts."],
            ["CRON_CLEANUP_SECRET", "Yes", "None", "Authorization secret for cleanup endpoint."],
        ],
        [1.9 * inch, 0.7 * inch, 0.8 * inch, 2.0 * inch],
    )

    story.append(p("LLM and capture tuning knobs", styles["h2"]))
    add_bullets(
        story,
        [
            "LLM_API_KEY or OPENAI_API_KEY enables enhancement; if absent, deterministic fallback is used.",
            "LLM_API_BASE_URL defaults to https://api.openai.com/v1.",
            "LLM_MODEL defaults to gpt-4.1-mini unless overridden.",
            "ANALYZE_FAST_MODE_ENABLED switches capture timing profile.",
            "ANALYZE_LLM_TIMEOUT_MS and ANALYZE_LLM_MAX_ATTEMPTS control enhancement latency/retry policy.",
            "APP_ORIGIN is used to build callback URLs for auth and reset flows.",
        ],
        styles["bullet"],
    )

    story.append(p("Secrets handling guidance", styles["h2"]))
    add_bullets(
        story,
        [
            "Do not commit .env.local.",
            "Treat SUPABASE_SERVICE_ROLE_KEY and CRON_CLEANUP_SECRET as high-sensitivity secrets.",
            "If CRON_CLEANUP_SECRET is rotated, scheduler and environment must be updated at the same time.",
            "Only expose publishable keys to browser code.",
        ],
        styles["bullet"],
    )

    story.append(PageBreak())

    story.append(p("10. Operations and Deployment", styles["h1"]))
    story.append(
        p(
            "The app is built for local dev + serverless deployment with an optional separate worker process.",
            styles["body"],
        )
    )

    story.append(p("Command map", styles["h2"]))
    add_table(
        story,
        styles,
        [
            ["Command", "Purpose", "Notes"],
            ["npm run dev", "Start Next.js dev server", "Main local runtime at http://localhost:3000."],
            ["npm run build", "Create production build", "Pre-deploy compile step."],
            ["npm run start", "Start production server", "Runs compiled app."],
            ["npm run lint", "ESLint checks", "Code quality gate."],
            ["npm run typecheck", "TypeScript no-emit check", "Type safety gate."],
            ["npm run test", "Run vitest suite", "Unit tests for core logic."],
            ["npm run worker", "Run extraction worker loop", "Needed for async /api/extractions flow."],
            ["npm run cleanup:expired", "Manual cleanup of expired artifacts", "Script wrapper over src/scripts/cleanup-expired.ts."],
            ["npm run docs:check", "Ensure docs changed with docs-required code paths", "Enforced by scripts/check-docs-sync.sh."],
        ],
        [1.3 * inch, 2.0 * inch, 2.1 * inch],
    )

    story.append(p("Deployment behavior", styles["h2"]))
    add_bullets(
        story,
        [
            "vercel.json configures cron path /api/cron/cleanup on schedule 0 0 * * * (daily at 00:00).",
            "next.config.ts includes @sparticuz/chromium binaries for /api/analyze and /api/prototype/extract.",
            "The cleanup endpoint is safe to expose publicly only because it enforces CRON_CLEANUP_SECRET.",
            "Benchmark snapshot endpoint is intentionally disabled when NODE_ENV=production.",
        ],
        styles["bullet"],
    )

    story.append(PageBreak())

    story.append(p("11. Testing, Quality Controls, and Regression Assets", styles["h1"]))
    story.append(
        p(
            "Testing is a mix of unit tests for logic and file-based regression snapshots for output stability.",
            styles["body"],
        )
    )

    story.append(p("Unit test coverage map", styles["h2"]))
    add_table(
        story,
        styles,
        [
            ["Test file", "Primary concern validated"],
            ["src/lib/__tests__/auth-resume.test.ts", "Safe next-path handling in auth resume flows."],
            ["src/lib/__tests__/compile-stitch.test.ts", "Prompt compiler output structure and sections."],
            ["src/lib/__tests__/errors.test.ts", "Public error mapping and sanitization behavior."],
            ["src/lib/__tests__/openai-enhance.test.ts", "LLM enhancement and fallback handling."],
            ["src/lib/__tests__/playwright-extractor-config.test.ts", "Extractor timing/config selection behavior."],
            ["src/lib/__tests__/prompt.test.ts", "Prompt generation fallback and formatting."],
            ["src/lib/__tests__/robots.test.ts", "robots parsing and allow/disallow resolution."],
            ["src/lib/__tests__/style-normalize.test.ts", "Style value normalization behavior."],
            ["src/lib/__tests__/url-security.test.ts", "URL normalization and blocked target checks."],
            ["src/lib/__tests__/vision.test.ts", "Vision helper behavior for extracted metadata."],
        ],
        [2.7 * inch, 2.7 * inch],
    )

    story.append(p("Regression snapshot harness", styles["h2"]))
    add_bullets(
        story,
        [
            "Snapshots live in test/regression/<slug>/ with stitchPrompt.txt, tokens.json, and score.json.",
            "Stable URL inputs are listed in test/fixtures/urls.json.",
            "POST /api/benchmark/snapshot can write snapshot files in non-production mode.",
            "This gives a practical before/after diff surface when extraction logic changes.",
        ],
        styles["bullet"],
    )

    story.append(PageBreak())

    story.append(p("12. Repository Ownership Map", styles["h1"]))
    story.append(
        p(
            "This is the folder-level map of responsibilities. Use it when deciding where changes belong.",
            styles["body"],
        )
    )

    add_table(
        story,
        styles,
        [
            ["Path", "Responsibility"],
            ["src/app/", "App Router pages, route handlers, and route-level UI composition."],
            ["src/app/api/", "HTTP API contracts and edge/server entry points."],
            ["src/lib/", "Business logic and service integrations (pricing, security, extraction, queue helpers)."],
            ["src/lib/extractor/", "Capture pipeline internals and style/token extraction algorithms."],
            ["src/lib/supabase/", "Supabase client wrappers for browser/server/admin contexts."],
            ["src/worker/", "Standalone worker process for async queue jobs."],
            ["src/scripts/", "Small operational scripts run via package scripts."],
            ["supabase/migrations/", "Source of truth for DB schema and RLS policies."],
            ["docs/", "Human-readable project documentation that must evolve with code changes."],
            ["public/", "Static runtime pages/assets and marketing artifacts."],
            ["test/", "Fixtures and regression snapshots."],
            ["scripts/", "Meta scripts such as docs sync enforcement."],
        ],
        [2.0 * inch, 3.4 * inch],
    )

    story.append(p("High-impact files index", styles["h2"]))
    add_table(
        story,
        styles,
        [
            ["File", "Why it matters"],
            ["src/lib/analyze-service.ts", "Main orchestrator for analysis flow and entitlement integration."],
            ["src/lib/openai-enhance.ts", "LLM enhancement contract, strict schema validation, deterministic fallback."],
            ["src/lib/extractor/playwright-extractor.ts", "Capture engine and output pack generation."],
            ["src/lib/pricing.ts", "Plan limits, monthly resets, topups, history/export permissions."],
            ["src/lib/db.ts", "Queue extraction persistence and artifact write helpers."],
            ["src/lib/worker.ts", "Job execution logic and storage upload behavior."],
            ["src/app/api/analyze/route.ts", "Main synchronous API entrypoint and guest cookie handling."],
            ["src/app/api/extractions/route.ts", "Async queue API entrypoint and quota enforcement."],
            ["src/app/api/export/json/route.ts", "Paid JSON export gate behavior."],
            ["src/lib/url-security.ts", "Target safety checks against private/internal hosts."],
            ["src/lib/robots.ts", "robots policy enforcement model."],
            ["supabase/migrations/20260216233000_init_designdna.sql", "Initial queue/data/security schema."],
            ["supabase/migrations/20260217195000_pricing_entitlements.sql", "Entitlement/history/analytics schema."],
            ["supabase/migrations/20260219120000_update_pricing_model.sql", "Plan limit adjustments (Free 10, Pro 100)."],
            ["scripts/check-docs-sync.sh", "Prevents shipping core code changes without docs updates."],
        ],
        [2.65 * inch, 2.75 * inch],
    )

    story.append(PageBreak())

    story.append(p("13. Operational Debug Map for Non-Technical Owners", styles["h1"]))
    story.append(
        p(
            "If you hear a problem report, use this table to route the issue to the right subsystem quickly.",
            styles["body"],
        )
    )

    add_table(
        story,
        styles,
        [
            ["Symptom", "Likely subsystem", "First files to inspect"],
            ["User says URL analysis is blocked immediately", "URL safety or robots policy", "src/lib/url-security.ts, src/lib/robots.ts, /api/analyze response"],
            ["User gets temporary failure messages often", "Capture runtime or upstream instability", "src/lib/errors.ts, src/lib/extractor/playwright-extractor.ts"],
            ["Guest user says they are blocked after first try", "Anonymous lifetime usage rule", "src/lib/analyze-service.ts, /api/me/entitlements"],
            ["Paid user cannot export JSON", "Entitlement gate or plan state", "src/app/api/export/json/route.ts, src/lib/pricing.ts, user_entitlements"],
            ["Extraction stuck in queued/running", "Worker not running or queue issue", "src/worker/index.ts, src/lib/queue.ts, src/lib/worker.ts"],
            ["Cleanup did not remove old artifacts", "Cron auth or cleanup selection logic", "vercel.json, src/app/api/cron/cleanup/route.ts, src/lib/cleanup.ts"],
            ["Login/reset link sends user to wrong page", "Path sanitization/callback origin", "src/lib/auth-resume.ts, src/lib/app-origin.ts, auth route handlers"],
            ["Docs check fails in CI/PR", "Docs-required paths changed without docs updates", "scripts/check-docs-sync.sh, docs/*, README.md"],
        ],
        [2.2 * inch, 1.55 * inch, 1.7 * inch],
    )

    story.append(p("Current architecture quirks worth noting", styles["h2"]))
    add_bullets(
        story,
        [
            "Route /dashboard currently redirects to /, even though DashboardClient includes a full extraction workspace implementation.",
            "Root route / redirects to a static HTML file in public instead of rendering a React page.",
            "The repository contains both synchronous and asynchronous analysis paths; this can confuse roadmap and support discussions if not named explicitly.",
        ],
        styles["bullet"],
    )

    story.append(PageBreak())

    story.append(p("14. Glossary", styles["h1"]))
    add_table(
        story,
        styles,
        [
            ["Term", "Meaning in this codebase"],
            ["Analysis", "Synchronous URL processing path that returns output in one API call."],
            ["Extraction", "Asynchronous queued job tracked by status in the extractions table."],
            ["Pack / DesignDnaPack", "Structured capture payload containing tokens, sections, components, and metadata."],
            ["Preview payload", "Smaller object used for cards/history summaries in the product."],
            ["Export JSON", "Versioned full output schema (schema_version 1.0) for downstream use."],
            ["Entitlement", "Plan and usage state that defines what the user can do right now."],
            ["Topup", "Additional paid analysis credits added after monthly limit is exhausted."],
            ["RLS", "Row-level security: DB policy that prevents users reading/writing other users' rows."],
            ["Service role client", "Privileged server-side Supabase client for trusted writes."],
            ["Fail-open robots behavior", "If robots file cannot be fetched due to transient errors, request is not blocked."],
            ["Deterministic fallback", "Guaranteed output path used when LLM enhancement is missing or invalid."],
        ],
        [1.9 * inch, 3.5 * inch],
    )

    story.append(p("15. Quick Executive Walkthrough", styles["h1"]))
    story.append(
        p(
            "If a non-technical stakeholder asks 'what happens after the user clicks Analyze?', this is the concise script:",
            styles["body"],
        )
    )
    add_bullets(
        story,
        [
            "The system checks that requests are not too frequent and that the URL is safe to scan.",
            "It confirms the target website policy does not explicitly block DesignDNA.",
            "It captures the page structure and visual language using Playwright.",
            "It builds design outputs in a deterministic way and optionally refines them with an LLM.",
            "It applies plan rules (guest, free, paid), stores user history when appropriate, and returns outputs.",
            "If anything fails, users receive safe error messages while internal details stay hidden.",
        ],
        styles["bullet"],
    )
    story.append(Spacer(1, 0.12 * inch))
    story.append(
        p(
            "Output artifact: output/pdf/designdna-system-map.pdf. This file is meant to be regenerated whenever major architecture, pricing, or data model changes occur.",
            styles["body"],
        )
    )

    return story


def main():
    styles = build_styles()
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=0.62 * inch,
        rightMargin=0.62 * inch,
        topMargin=0.68 * inch,
        bottomMargin=0.84 * inch,
        title="DesignDNA System Map",
        author="Codex",
    )
    story = build_story(styles)
    doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
    print(str(OUT.resolve()))


if __name__ == "__main__":
    main()
