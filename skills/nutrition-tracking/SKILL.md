---
name: nutrition-tracking
description: Use when the user mentions food they ate, asks about calories/protein/macros, wants to log a meal, check daily or weekly nutrition progress, set a nutrition goal, or review food history. Drives the nutrition-mcp tools with an estimate-then-confirm-then-log policy.
---

# Nutrition Tracking

Drive the `nutrition` MCP server to act as a conversational calorie and protein
tracker. The server provides the tools; this skill governs how to use them.

## Core principles

1. **Estimate aggressively, log conservatively.** Always give the user a number,
   but only write it to their log when confidence is high or the user confirms.
2. **Show your reasoning.** State the assumptions behind every estimate (serving
   sizes, preparation, portions).
3. **Ask when uncertain.** A clarifying question beats a fabricated number.
4. **Never fabricate branded/restaurant nutrition data.** If you don't have a
   reliable match, say so and estimate from components instead.

## First-run setup

If a tool reports there is no profile, call `setup_profile` to capture daily
calorie goal, daily protein goal, goal type (cut/maintain/bulk), and timezone
before logging. Use `update_profile` to change goals, weight, or timezone later.

## The estimate → confirm → log flow

1. User describes food → call `estimate_nutrition` with their phrasing.
2. Read the returned `confidence` and apply the thresholds below.
3. Only call `log_food` (with `userConfirmed: true`) once the threshold is met.

### Confidence thresholds

- **High** — user gave calories+protein, an exact local/branded match, or a
  clear USDA-style match with serving size. → You may suggest logging it
  directly; log on a simple "yes".
- **Medium** — homemade meal with standard serving assumptions, or a restaurant
  component estimate with incomplete portions. → Show the estimate and its
  assumptions, then ask for confirmation before calling `log_food`.
- **Low** — unknown restaurant item, missing serving size with no reliable
  match, or an ambiguous description. → Ask follow-up questions. Do **not**
  `log_food`.

If the user logged something by mistake, call `undo_last_log`.

## Progress and history

- "How am I doing today?" / "calories left?" → `get_daily_status`.
- "How was this week?" / weekly averages → `get_weekly_summary`.
- "When did I last have X?" / past meals → `search_food_history`.
- "Export my data" → `export_logs` (JSON or CSV).

## Worked examples

- User: "I had 2 eggs and toast."
  → `estimate_nutrition {"query":"2 eggs and toast"}`. Likely medium confidence;
  show estimate + assumptions, ask to confirm, then
  `log_food {"rawEntry":"2 eggs and toast","userConfirmed":true}`.

- User: "Log 600 calories, 40g protein chicken bowl."
  → High confidence (user supplied numbers); confirm briefly and
  `log_food {"rawEntry":"chicken bowl, 600 cal 40g protein","userConfirmed":true}`.

- User: "I ate something at a food truck, not sure what."
  → Low confidence; ask what it was and rough portion before estimating. Do not
  log yet.
