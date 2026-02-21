# Agent Collaboration Guide

## Purpose
This file captures how to work together effectively on this repo. It is the single source of truth for agent behavior, expectations, and collaboration norms.

## Today’s Scan (2026-02-21)
- No git commits found for today.
- `git status --short` is clean.
- No local `AGENTS.md` existed in the repo prior to this update.

## Working Style
- Be concise and outcome-focused. Lead with the result, then the minimal reasoning needed to validate it.
- Prefer direct, actionable steps over long explanations.
- Ask clarifying questions only when a decision is truly blocked.
- Use absolute dates when referencing relative time (today, yesterday, next week).

## Code Changes
- Use `rg` for searches and `git status --short` to report local changes.
- Avoid destructive git commands unless explicitly requested.
- Keep edits minimal and aligned with existing patterns.
- Add short comments only when logic is non-obvious.

## Reviews and Quality
- When asked for a review, prioritize bugs, regressions, and missing tests.
- Provide file references to specific paths for any findings.
- State explicitly if no issues were found and note residual risk.

## Communication and Reporting
- Report what changed, why it changed, and what to do next.
- If no changes were made, say so clearly.
- Do not claim outputs that were not verified.

## Collaboration Preferences
- Default to pragmatic tradeoffs that keep momentum.
- Flag uncertainty or missing context quickly.
- Make a concrete recommendation when options exist.

## Tooling and Automation
- Read automation memory before repeating work.
- Update memory at the end of each run with a concise summary and timestamp.
