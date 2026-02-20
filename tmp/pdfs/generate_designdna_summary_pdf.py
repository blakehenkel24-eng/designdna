from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas
from pathlib import Path

OUT = Path('output/pdf/designdna-app-summary.pdf')
OUT.parent.mkdir(parents=True, exist_ok=True)

PAGE_W, PAGE_H = letter
MARGIN = 40
GAP = 18
CONTENT_W = PAGE_W - (2 * MARGIN)
COL_W = (CONTENT_W - GAP) / 2

c = canvas.Canvas(str(OUT), pagesize=letter)

# Explicit page background for renderer compatibility
c.setFillColor(colors.white)
c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)


def draw_wrapped(text, x, y, width, font='Helvetica', size=10, leading=13, color=colors.black):
    c.setFont(font, size)
    c.setFillColor(color)
    lines = simpleSplit(text, font, size, width)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_heading(text, x, y):
    c.setFont('Helvetica-Bold', 12)
    c.setFillColor(colors.HexColor('#10233d'))
    c.drawString(x, y, text)
    y -= 5
    c.setStrokeColor(colors.HexColor('#c9d2dd'))
    c.setLineWidth(0.8)
    c.line(x, y, x + COL_W, y)
    return y - 12


def draw_bullets(items, x, y, width, size=9.5, leading=12):
    for item in items:
        bullet = '- '
        bullet_w = c.stringWidth(bullet, 'Helvetica', size)
        wrapped = simpleSplit(item, 'Helvetica', size, width - bullet_w)
        if not wrapped:
            wrapped = ['']
        c.setFont('Helvetica', size)
        c.setFillColor(colors.black)
        c.drawString(x, y, bullet + wrapped[0])
        y -= leading
        for cont in wrapped[1:]:
            c.drawString(x + bullet_w, y, cont)
            y -= leading
        y -= 1
    return y

# Header block
c.setFillColor(colors.HexColor('#0f172a'))
c.rect(0, PAGE_H - 84, PAGE_W, 84, fill=1, stroke=0)
c.setFillColor(colors.white)
c.setFont('Helvetica-Bold', 20)
c.drawString(MARGIN, PAGE_H - 44, 'DesignDNA App Summary')
c.setFont('Helvetica', 10)
c.drawString(MARGIN, PAGE_H - 62, 'Evidence source: README.md, docs/*.md, public/*.html, src/app/api/*')

start_y = PAGE_H - 102
left_x = MARGIN
right_x = MARGIN + COL_W + GAP

# Left column
y_left = start_y

y_left = draw_heading('What It Is', left_x, y_left)
y_left = draw_wrapped(
    'DesignDNA is a Next.js web app that analyzes public webpages and outputs an LLM-ready recreation prompt, '
    'a preview payload, and versioned export JSON artifacts. It translates real interface structure and style signals '
    'into reusable implementation guidance.',
    left_x,
    y_left,
    COL_W,
    size=9.5,
    leading=12,
)
y_left -= 8

y_left = draw_heading("Who It's For", left_x, y_left)
y_left = draw_wrapped(
    'Primary persona: design and engineering teams (plus individual builders) who need repeatable prompt workflows '
    'to recreate and iterate on web UI patterns.',
    left_x,
    y_left,
    COL_W,
    size=9.5,
    leading=12,
)
y_left -= 8

y_left = draw_heading('What It Does', left_x, y_left)
features = [
    'Accepts a public URL and runs an analysis pipeline via /api/analyze.',
    'Performs URL safety and compliance checks (protocol allowlist, SSRF guards, robots.txt policy checks).',
    'Captures DOM/CSS and screenshots with Playwright, then extracts structure and design tokens.',
    'Builds deterministic prompt/preview outputs, with optional OpenAI-compatible LLM refinement and fallback behavior.',
    'Supports auth (email/password and Google OAuth), usage entitlements, and analysis history for logged-in users.',
    'Gates paid capabilities such as JSON export and higher monthly limits; includes top-up/upgrade endpoints.',
    'Includes async extraction queue support (Redis + worker) and scheduled cleanup for expired artifacts.',
]
y_left = draw_bullets(features, left_x, y_left, COL_W, size=9.2, leading=11)
y_left -= 4

y_left = draw_heading('How To Run (Minimal)', left_x, y_left)
run_steps = [
    '1. Install dependencies: npm install',
    '2. Copy env file: cp .env.example .env.local',
    '3. Configure Supabase and Upstash vars, run the 3 SQL migrations in supabase/migrations/, and create private "captures" bucket.',
    '4. Start app: npm run dev (open http://localhost:3000).',
    '5. Optional queue worker for /api/extractions: npm run worker',
]
y_left = draw_bullets(run_steps, left_x, y_left, COL_W, size=9.2, leading=11)

# Right column
y_right = start_y

y_right = draw_heading('How It Works (Architecture)', right_x, y_right)
arch = [
    'Frontend/UI: static public pages and dashboard clients invoke Next.js App Router API routes.',
    'API layer: route handlers live in src/app/api/**/route.ts and validate inputs with zod.',
    'Core orchestration: src/lib/analyze-service.ts coordinates parse -> rate limit (Upstash) -> URL security/robots -> Playwright capture -> prompt/tokens -> optional LLM enhancement.',
    'Persistence: Supabase Auth + Postgres store users, entitlements, analysis history, extraction jobs, and artifacts; Storage keeps capture artifacts.',
    'Async path: /api/extractions enqueues jobs in Redis; src/worker/index.ts + src/lib/worker.ts process jobs and update extraction status.',
    'Ops path: /api/cron/cleanup and src/lib/cleanup.ts remove expired storage artifacts using CRON_CLEANUP_SECRET protection.',
]
y_right = draw_bullets(arch, right_x, y_right, COL_W, size=9.3, leading=11)

y_right -= 6
y_right = draw_heading('Not Found In Repo', right_x, y_right)
not_found = [
    'Dedicated native mobile app clients or separate desktop runtime.',
    'Finalized legal/commercial terms text (about.html marks these as pending review).',
]
y_right = draw_bullets(not_found, right_x, y_right, COL_W, size=9.2, leading=11)

# Footer rule and note
footer_y = 32
c.setStrokeColor(colors.HexColor('#c9d2dd'))
c.setLineWidth(0.8)
c.line(MARGIN, footer_y + 10, PAGE_W - MARGIN, footer_y + 10)
c.setFont('Helvetica-Oblique', 8.5)
c.setFillColor(colors.HexColor('#4b5563'))
c.drawString(MARGIN, footer_y - 1, 'Generated from repository evidence only.')

# sanity guard for overflow
lowest_y = min(y_left, y_right)
if lowest_y < footer_y + 18:
    raise RuntimeError(f'Content overflow detected (lowest y={lowest_y:.2f}).')

c.showPage()
c.save()
print(str(OUT.resolve()))
