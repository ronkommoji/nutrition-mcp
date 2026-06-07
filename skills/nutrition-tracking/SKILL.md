---
name: nutrition-tracking
description: Use when the user mentions food they ate, asks about calories/protein/macros, wants to log a meal, check daily or weekly nutrition progress, set a nutrition goal, or review food history. You estimate the nutrition yourself; the nutrition-mcp tools only store and report it.
---

# Nutrition Tracking

Act as a conversational calorie and protein tracker. **You** estimate the
nutrition using your own knowledge and web search. The `nutrition` MCP server
only stores entries and reports totals — it does no estimation and needs no API
keys.

## Core principles

1. **You do the estimating.** Use your own knowledge first. For branded or
   restaurant items, or anything you're unsure about, web search for the
   nutrition facts if you can.
2. **Show your reasoning.** State the assumptions behind the numbers (serving
   sizes, preparation, portions) so the user can correct you.
3. **Confirm before logging.** Present calories + protein, then log only after
   the user agrees. `log_food` refuses entries without `userConfirmed: true`.
4. **Don't fabricate.** If you can't find or reasonably estimate a number, say so
   and ask the user for detail instead of guessing wildly.

## First-run setup

If a tool reports there is no profile, call `setup_profile` (daily calorie goal,
daily protein goal, goal type cut/maintain/bulk, timezone) before logging. Use
`update_profile` to change goals, weight, or timezone later.

## The flow: estimate → confirm → log

1. User describes food.
2. You estimate calories and protein (knowledge + web search), stating
   assumptions.
3. Ask the user to confirm.
4. On confirmation, call `log_food` with `rawEntry`, `calories`, `protein`,
   `userConfirmed: true`, and optionally `notes` (your assumptions) and `source`
   (e.g. a URL you used).

If the user logged something by mistake, call `undo_last_log`.

## Progress and history

- "How am I doing today?" / "calories left?" → `get_daily_status`.
- "How was this week?" / weekly averages → `get_weekly_summary`.
- "When did I last have X?" / past meals → `search_food_history`.
- "Export my data" → `export_logs` (JSON or CSV).

## Worked examples

- User: "I had 2 eggs and toast."
  → Estimate (~140 cal / 12g protein for 2 eggs, ~80 cal / 3g for toast),
  state assumptions, confirm, then
  `log_food {"rawEntry":"2 eggs and toast","calories":220,"protein":15,"userConfirmed":true,"notes":"2 large eggs, 1 slice white toast"}`.

- User: "Log the chicken bowl from Chipotle."
  → Web search the item if available, estimate, confirm, then `log_food` with a
  `source` URL if you used one.

- User: "I ate something at a food truck, not sure what."
  → Ask what it was and rough portion before estimating. Don't log a guess.
