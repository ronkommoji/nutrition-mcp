# Design: Strip Estimation — Server Becomes a Pure Logging Store

**Date:** 2026-06-07
**Status:** Approved (design phase)
**Owner:** ronkommoji

## Goal

Make the nutrition server "super simple": remove all nutrition estimation,
external providers, and API keys. The **agent's own model** (Claude, Hermes's
configured model, etc.) estimates calories/protein using its knowledge and web
search, then logs explicit numbers. The server only stores, totals, and reports.

## Architecture Shift

Before: the server estimated nutrition via local providers (`llm_fallback`,
`usda`, `fatsecret`, `gemini`) and gated logging on a computed confidence.

After: the server does no estimation. It is a filesystem-backed log: profiles,
daily/weekly totals, search, export, undo. The agent supplies the numbers.

## Tools (9 → 8)

### Removed
- `estimate_nutrition` — deleted entirely. The agent estimates itself; no tool.

### Rewritten: `log_food`
Stores a confirmed entry from numbers the agent provides. No internal estimation.

Input schema:
- Required: `rawEntry` (string, food description), `calories` (number),
  `protein` (number), `userConfirmed` (boolean).
- Optional: `notes` (string — assumptions/context), `source` (string — e.g. a URL
  the agent web-searched), `date` (YYYY-MM-DD, defaults to today in profile tz),
  `timestamp` (ISO, defaults to now).

Behavior:
- If `userConfirmed` is not `true`, do not log; return
  `{ logged: false, reason: "log_food requires userConfirmed: true." }`.
- Otherwise append the entry and return `{ logged: true, entry, dailyTotals }`.

### Unchanged
`setup_profile`, `update_profile`, `undo_last_log`, `get_daily_status`,
`get_weekly_summary`, `search_food_history`, `export_logs` — keep their behavior
(adjusted only where they referenced dropped fields).

## Data Model

### `FoodLogEntry` (simplified)
Keep: `id`, `timestamp`, `date`, `rawEntry`, `calories`, `protein`,
`userConfirmed`.
Add (optional): `notes?`, `source?`.
Drop: `items`, `confidence`, `sources[]`, `reasoning`, `assumptions`, `mode`.

Field name `rawEntry` is kept (no rename) to minimize churn; it holds the food
description.

### Types removed from `src/types.ts`
`ParsedFoodItem`, `NutritionEstimate`, `Confidence`, `EstimateMode`.

### Helpers removed from `src/tools/common.ts`
`parseConfidence`, `parseMode`, `optionalItems`, and `optionalStringArray` if it
becomes unused after the change. Remove the now-unused `ParsedFoodItem`/
`Confidence`/`EstimateMode` imports.

## Consumers Updated for New Fields

- `search_food_history` (`scoreEntry`): search haystack changes from
  `rawEntry + items[].name + sources[]` to `rawEntry + notes + source`.
- `export_logs` (`toCsv`): columns change from
  `date,timestamp,raw_entry,calories,protein,confidence,sources,reasoning` to
  `date,timestamp,raw_entry,calories,protein,notes,source`.
- `get_daily_status`, `get_weekly_summary`: verified to use only totals/calories/
  protein; no change expected (confirm during implementation via typecheck).

## Deletions

- `src/providers/` — `gemini.ts`, `fatsecret.ts`, `usda.ts`, `llm_fallback.ts`.
- `src/resources/` — `nutrition_policy.ts`, `nutrition_policy.md`.
- `src/prompts/` — `nutrition_estimator.md`.
- `src/index.ts`: remove the `NUTRITION_POLICY` import, the
  `nutrition://nutrition_policy` resource entry, and its `ReadResource` branch.
  Resources drop from 3 → 2 (`user_profile`, `daily_summary`).

## Skill + Docs

- Rewrite `skills/nutrition-tracking/SKILL.md`: the agent estimates with its own
  knowledge + web search, shows assumptions, confirms with the user, then calls
  `log_food` with `calories`, `protein`, `userConfirmed: true`, and optional
  `notes`/`source`. Remove references to `estimate_nutrition` and to the
  server-side confidence framework.
- `README.md`: tools list 9 → 8 (drop `estimate_nutrition`); resources 3 → 2
  (drop `nutrition_policy`); delete the entire "API keys" section and all
  provider/`env`-key examples. Keep `NUTRITION_MCP_HOME` as the only optional env
  var. Add a one-line note that the agent's model does estimation (web search /
  knowledge), no keys required.
- `docs/install/{hermes,claude,codex,generic-mcp}.md`: remove `GEMINI_API_KEY` /
  `FATSECRET_*` env examples. Keep the optional `NUTRITION_MCP_HOME` note and the
  skill-paste instructions.
- `.env.example`: reduce to only `NUTRITION_MCP_HOME`.
- Version bump `0.2.0` → `0.3.0` in `package.json` and
  `.claude-plugin/plugin.json`.

## What Stays Identical

Storage layer (`src/storage/filesystem.ts`), profiles, daily/weekly totals,
undo, the npx/git-install packaging, plugin manifests, and marketplace.

## Success Criteria

1. `npm run build` and `npm run typecheck` pass with no references to removed
   providers/types.
2. Server lists exactly 8 tools (no `estimate_nutrition`) and 2 resources.
3. `log_food` with `userConfirmed: true` and explicit `calories`/`protein`
   stores an entry and returns updated daily totals.
4. `log_food` without `userConfirmed: true` returns `logged: false`.
5. `search_food_history` and `export_logs` work against the new fields.
6. No `GEMINI`/`FATSECRET`/`USDA` references remain in `src/` or user-facing docs.
7. `npx -y github:ronkommoji/nutrition-mcp` still builds and runs.

## Out of Scope

- Any external nutrition API integration (removed, not deferred).
- Renaming `rawEntry`.
- New reporting features.
