# Strip Estimation — Pure Logging Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all nutrition estimation, providers, and API keys so the agent's own model estimates calories/protein (knowledge + web search) and the server only stores, totals, and reports.

**Architecture:** Delete `src/providers/`, `src/resources/`, `src/prompts/`, and the `estimate_nutrition` tool. Rewrite `log_food` to accept explicit `calories`/`protein` with a `userConfirmed` gate plus optional `notes`/`source`. Simplify `FoodLogEntry` and update `search_food_history`/`export_logs`. Then update the skill, README, install docs, and bump the version.

**Tech Stack:** Node ≥ 20, TypeScript, `@modelcontextprotocol/sdk` (stdio).

---

## File Structure

- Modify: `src/types.ts` — slim `FoodLogEntry`; remove estimation types.
- Modify: `src/tools/common.ts` — remove estimation helpers + unused type imports.
- Rewrite: `src/tools/log_food.ts` — explicit numbers, confirm gate, no estimation.
- Modify: `src/tools/search_food_history.ts` — new search haystack.
- Modify: `src/tools/export_logs.ts` — new CSV columns.
- Modify: `src/tools/index.ts` — drop `estimate_nutrition`.
- Modify: `src/index.ts` — drop the `nutrition_policy` resource.
- Delete: `src/tools/estimate_nutrition.ts`, `src/providers/`, `src/resources/`, `src/prompts/`.
- Rewrite: `skills/nutrition-tracking/SKILL.md`.
- Modify: `README.md`, `docs/install/*.md`, `.env.example`.
- Modify: `package.json`, `.claude-plugin/plugin.json` — version `0.3.0`.

This is a tightly coupled refactor: the build only goes green once all code changes land together, so Task 1 is one cohesive code task verified by `npm run build` + a functional check. Tasks 2–4 are docs/metadata. Task 5 verifies end-to-end and pushes.

All commands run from `/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp`. If a commit fails for missing git identity, prefix with `git -c user.name='ronkommoji' -c user.email='ronkommoji@gmail.com'`.

---

### Task 1: Code refactor — pure logging store

**Files:** see File Structure above (all `src/` items).

- [ ] **Step 1: Replace `src/types.ts` with the slim model**

Full new contents of `src/types.ts`:
```ts
export type GoalType = "cut" | "maintain" | "bulk";

export interface UserProfile {
  name?: string;
  weight: {
    value: number;
    unit: "lb" | "kg";
  };
  dailyCalorieGoal: number;
  dailyProteinGoal: number;
  goalType: GoalType;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface FoodLogEntry {
  id: string;
  timestamp: string;
  date: string;
  rawEntry: string;
  calories: number;
  protein: number;
  userConfirmed: boolean;
  notes?: string;
  source?: string;
}

export interface DailyLog {
  date: string;
  entries: FoodLogEntry[];
  totals: {
    calories: number;
    protein: number;
  };
  updatedAt: string;
}

export interface WeeklySummary {
  week: string;
  startDate: string;
  endDate: string;
  averageCalories: number;
  averageProtein: number;
  bestDay: string | null;
  daysTracked: number;
  totalsByDay: Array<{
    date: string;
    calories: number;
    protein: number;
  }>;
  generatedAt: string;
}

export interface Settings {
  createdAt: string;
  updatedAt: string;
  storageVersion: 1;
}
```

- [ ] **Step 2: Trim `src/tools/common.ts`**

Change the type import (first line) from:
```ts
import type { Confidence, EstimateMode, GoalType, ParsedFoodItem } from "../types.js";
```
to:
```ts
import type { GoalType } from "../types.js";
```

Delete these four functions entirely from `src/tools/common.ts`: `parseConfidence`, `parseMode`, `optionalStringArray`, and `optionalItems`. (Keep `asRecord`, `requiredString`, `optionalString`, `requiredNumber`, `optionalNumber`, `optionalBoolean`, `parseGoalType`, `todayForTimezone`, `assertDateKey`, `jsonSchema`, `roundProtein`.)

- [ ] **Step 3: Replace `src/tools/log_food.ts`**

Full new contents:
```ts
import { randomUUID } from "node:crypto";
import type { FoodLogEntry } from "../types.js";
import type { ToolDefinition } from "./tool.js";
import {
  asRecord,
  assertDateKey,
  jsonSchema,
  optionalBoolean,
  optionalString,
  requiredNumber,
  requiredString,
  roundProtein,
  todayForTimezone
} from "./common.js";

export const logFoodTool: ToolDefinition = {
  name: "log_food",
  description:
    "Store a confirmed food entry. The agent supplies calories and protein (estimated with its own knowledge or web search). Requires userConfirmed: true.",
  inputSchema: jsonSchema(
    {
      rawEntry: { type: "string", description: "Food description, e.g. '2 eggs and toast'." },
      calories: { type: "number", description: "Calories to log." },
      protein: { type: "number", description: "Protein grams to log." },
      userConfirmed: {
        type: "boolean",
        description: "Must be true; the user confirmed the estimate before logging."
      },
      notes: { type: "string", description: "Optional assumptions or context, e.g. 'assumed 2 large eggs'." },
      source: { type: "string", description: "Optional source, e.g. a URL used to estimate." },
      date: { type: "string", description: "YYYY-MM-DD date. Defaults to today in the profile timezone." },
      timestamp: { type: "string", description: "ISO timestamp. Defaults to now." }
    },
    ["rawEntry", "calories", "protein", "userConfirmed"]
  ),
  async handler(rawArgs, { storage }) {
    const args = asRecord(rawArgs);
    const rawEntry = requiredString(args, "rawEntry");
    const calories = requiredNumber(args, "calories");
    const protein = requiredNumber(args, "protein");
    const userConfirmed = optionalBoolean(args, "userConfirmed") ?? false;

    if (!userConfirmed) {
      return {
        logged: false,
        reason: "log_food requires userConfirmed: true. Confirm the estimate with the user first."
      };
    }

    const profile = await storage.readProfile();
    const timezone = profile?.timezone ?? "UTC";
    const date = assertDateKey(optionalString(args, "date") ?? todayForTimezone(timezone));
    const timestamp = optionalString(args, "timestamp") ?? new Date().toISOString();
    const notes = optionalString(args, "notes");
    const source = optionalString(args, "source");

    const entry: FoodLogEntry = {
      id: randomUUID(),
      timestamp,
      date,
      rawEntry,
      calories: Math.round(calories),
      protein: roundProtein(protein),
      userConfirmed: true,
      ...(notes ? { notes } : {}),
      ...(source ? { source } : {})
    };

    const dailyLog = await storage.appendFoodLog(date, entry);
    return {
      logged: true,
      entry,
      dailyTotals: dailyLog.totals
    };
  }
};
```

- [ ] **Step 4: Update `scoreEntry` in `src/tools/search_food_history.ts`**

Replace the `scoreEntry` function with:
```ts
function scoreEntry(entry: FoodLogEntry, terms: string[]): number {
  const haystack = [entry.rawEntry, entry.notes ?? "", entry.source ?? ""]
    .join(" ")
    .toLowerCase();

  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}
```

- [ ] **Step 5: Update `toCsv` in `src/tools/export_logs.ts`**

Replace the `toCsv` function with:
```ts
function toCsv(logs: DailyLog[]): string {
  const rows = [["date", "timestamp", "raw_entry", "calories", "protein", "notes", "source"]];

  for (const log of logs) {
    for (const entry of log.entries) {
      rows.push([
        log.date,
        entry.timestamp,
        entry.rawEntry,
        String(entry.calories),
        String(entry.protein),
        entry.notes ?? "",
        entry.source ?? ""
      ]);
    }
  }

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}
```

- [ ] **Step 6: Replace `src/tools/index.ts` (drop estimate_nutrition)**

Full new contents:
```ts
import { exportLogsTool } from "./export_logs.js";
import { getDailyStatusTool } from "./get_daily_status.js";
import { getWeeklySummaryTool } from "./get_weekly_summary.js";
import { logFoodTool } from "./log_food.js";
import { searchFoodHistoryTool } from "./search_food_history.js";
import { setupProfileTool } from "./setup_profile.js";
import type { ToolDefinition } from "./tool.js";
import { undoLastLogTool } from "./undo_last_log.js";
import { updateProfileTool } from "./update_profile.js";

export const tools: ToolDefinition[] = [
  setupProfileTool,
  updateProfileTool,
  logFoodTool,
  undoLastLogTool,
  getDailyStatusTool,
  getWeeklySummaryTool,
  searchFoodHistoryTool,
  exportLogsTool
];
```

- [ ] **Step 7: Remove the `nutrition_policy` resource from `src/index.ts`**

Make three edits to `src/index.ts`:

(a) Delete this import line:
```ts
import { NUTRITION_POLICY } from "./resources/nutrition_policy.js";
```

(b) In the `ListResourcesRequestSchema` handler, delete this array element (including its leading comma):
```ts
    ,
    {
      uri: "nutrition://nutrition_policy",
      name: "nutrition_policy",
      description: "Accuracy rules and confidence framework.",
      mimeType: "text/markdown"
    }
```
so only `user_profile` and `daily_summary` remain in the resources array.

(c) In the `ReadResourceRequestSchema` handler, delete this entire branch:
```ts
  if (uri === "nutrition://nutrition_policy") {
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: NUTRITION_POLICY
        }
      ]
    };
  }
```

- [ ] **Step 8: Delete the estimation files and directories**

Run:
```bash
git rm src/tools/estimate_nutrition.ts
git rm -r src/providers src/resources src/prompts
```

- [ ] **Step 9: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both complete with no errors (no references to removed providers/types/helpers).

- [ ] **Step 10: Functional check — tools, resources, and log behavior**

Run (uses an isolated temp data dir so it never touches real logs):
```bash
NUTRITION_MCP_HOME="$(mktemp -d)" bash -c 'printf "%s\n%s\n%s\n%s\n%s\n" \
"{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"t\",\"version\":\"0\"}}}" \
"{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\",\"params\":{}}" \
"{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"resources/list\",\"params\":{}}" \
"{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"log_food\",\"arguments\":{\"rawEntry\":\"2 eggs\",\"calories\":140,\"protein\":12,\"userConfirmed\":true}}}" \
"{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"tools/call\",\"params\":{\"name\":\"log_food\",\"arguments\":{\"rawEntry\":\"toast\",\"calories\":80,\"protein\":3}}}" \
| node dist/index.js 2>/dev/null'
```
Expected in the output:
- tool names list does NOT include `estimate_nutrition`; counting `"name":"..."` tool entries gives 8.
- resources/list contains `user_profile` and `daily_summary` only (no `nutrition_policy`).
- id 4 result: `"logged": true` with `"dailyTotals"` showing calories 140, protein 12.
- id 5 result: `"logged": false` (no `userConfirmed`).

Quick assertion helper (optional):
```bash
NUTRITION_MCP_HOME="$(mktemp -d)" bash -c 'printf "%s\n%s\n" \
"{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"t\",\"version\":\"0\"}}}" \
"{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\",\"params\":{}}" \
| node dist/index.js 2>/dev/null' | grep -o "\"name\":\"[a-z_]*\"" | sort -u
```
Expected: exactly 8 lines — export_logs, get_daily_status, get_weekly_summary, log_food, search_food_history, setup_profile, undo_last_log, update_profile (no estimate_nutrition).

- [ ] **Step 11: Confirm no estimation references remain in src**

Run: `grep -rniE "gemini|fatsecret|usda|llm_fallback|estimate_nutrition|NutritionEstimate|EstimateMode" src/ || echo "clean"`
Expected: `clean`.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor: remove estimation/providers; server is a pure logging store

The agent's own model now estimates calories/protein (knowledge + web
search) and calls log_food with explicit numbers. Delete providers,
resources, prompts, and the estimate_nutrition tool; simplify FoodLogEntry."
```

---

### Task 2: Rewrite the skill

**Files:** Modify `skills/nutrition-tracking/SKILL.md`

- [ ] **Step 1: Replace the full contents of `skills/nutrition-tracking/SKILL.md`**

```markdown
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
```

- [ ] **Step 2: Verify frontmatter and no stale tool reference**

Run: `head -4 skills/nutrition-tracking/SKILL.md && grep -c "estimate_nutrition" skills/nutrition-tracking/SKILL.md`
Expected: frontmatter shows `name: nutrition-tracking`; grep count is `0`.

- [ ] **Step 3: Commit**

```bash
git add skills/nutrition-tracking/SKILL.md
git commit -m "docs: rewrite skill — agent estimates, server only logs"
```

---

### Task 3: Update README, install docs, and .env.example (remove keys)

**Files:** Modify `README.md`, `docs/install/{hermes,claude,codex,generic-mcp}.md`, `.env.example`

- [ ] **Step 1: README — drop `estimate_nutrition` from the tools list**

In `README.md`, delete this line:
```markdown
- `estimate_nutrition` — estimate calories and protein without logging.
```

- [ ] **Step 2: README — drop `nutrition_policy` from resources**

In `README.md`, delete this line:
```markdown
- `nutrition://nutrition_policy`
```

- [ ] **Step 3: README — replace the "API keys" section with a no-keys note**

Replace the entire `## API keys` section (from the `## API keys` heading through
the end of the `**Security:** ...` paragraph) with:
```markdown
## No API keys

There are none. The agent's own model estimates calories and protein (its
knowledge plus web search), and the server only stores and reports them. The
single optional setting is `NUTRITION_MCP_HOME` (storage location, default
`~/.nutrition-mcp`).
```

- [ ] **Step 4: README — adjust the "What's included" tool/resource counts**

In `README.md`, replace:
```markdown
- **MCP server** — 9 tools + 3 resources (below).
```
with:
```markdown
- **MCP server** — 8 tools + 2 resources (below).
```

- [ ] **Step 5: hermes.md — trim the env example to NUTRITION_MCP_HOME only**

In `docs/install/hermes.md`, replace:
```yaml
       # env:                      # optional — works without keys (local fallback)
       #   GEMINI_API_KEY: "..."             # enables Gemini estimation
       #   FATSECRET_CLIENT_ID: "..."        # both required for FatSecret
       #   FATSECRET_CLIENT_SECRET: "..."
       #   NUTRITION_MCP_HOME: "~/.nutrition-mcp"
```
with:
```yaml
       # env:                      # optional
       #   NUTRITION_MCP_HOME: "~/.nutrition-mcp"   # storage location
```

- [ ] **Step 6: claude.md — replace the "API keys" section**

In `docs/install/claude.md`, replace the entire `## API keys` section (heading
through the `Claude Code expands ${VAR}...` paragraph) with:
```markdown
## No API keys

None required — the agent estimates nutrition itself. Optionally set
`NUTRITION_MCP_HOME` in an `env` block to change the storage location:

```json
"env": { "NUTRITION_MCP_HOME": "~/.nutrition-mcp" }
```
```

- [ ] **Step 7: codex.md — trim the env example**

In `docs/install/codex.md`, replace:
```toml
# Optional — works without keys (local fallback):
# [mcp_servers.nutrition.env]
# GEMINI_API_KEY = "..."            # enables Gemini estimation
# FATSECRET_CLIENT_ID = "..."       # both required for FatSecret
# FATSECRET_CLIENT_SECRET = "..."
```
with:
```toml
# Optional — change the storage location:
# [mcp_servers.nutrition.env]
# NUTRITION_MCP_HOME = "~/.nutrition-mcp"
```

- [ ] **Step 8: generic-mcp.md — replace the "API keys" section**

In `docs/install/generic-mcp.md`, replace the entire `## API keys` section
(heading through the paragraph ending `it does not read a .env file.`) with:
```markdown
## No API keys

None required — the agent estimates nutrition itself. The only optional `env`
value is `NUTRITION_MCP_HOME` (storage location).
```

- [ ] **Step 9: Replace `.env.example`**

Full new contents of `.env.example`:
```
# Reference only. The server does NOT read a .env file.
# The only setting is the storage location, passed via your agent's MCP env block.

# Storage location (default: ~/.nutrition-mcp)
NUTRITION_MCP_HOME=~/.nutrition-mcp
```

- [ ] **Step 10: Verify no provider keys remain in user-facing files**

Run: `grep -rniE "gemini|fatsecret|usda_api_key" README.md .env.example docs/install/ || echo "clean"`
Expected: `clean`.

- [ ] **Step 11: Commit**

```bash
git add README.md docs/install .env.example
git commit -m "docs: remove API keys; document agent-side estimation"
```

---

### Task 4: Version bump to 0.3.0

**Files:** Modify `package.json`, `.claude-plugin/plugin.json`

- [ ] **Step 1: Bump `package.json`**

In `package.json`, change:
```json
  "version": "0.2.0",
```
to:
```json
  "version": "0.3.0",
```

- [ ] **Step 2: Bump `.claude-plugin/plugin.json`**

In `.claude-plugin/plugin.json`, change:
```json
  "version": "0.2.0",
```
to:
```json
  "version": "0.3.0",
```

- [ ] **Step 3: Verify both report 0.3.0**

Run: `node -e "console.log(require('./package.json').version, require('./.claude-plugin/plugin.json').version)"`
Expected: `0.3.0 0.3.0`

- [ ] **Step 4: Commit**

```bash
git add package.json .claude-plugin/plugin.json
git commit -m "chore: bump version to 0.3.0"
```

---

### Task 5: End-to-end verification + push

**Files:** none (verification + publish).

- [ ] **Step 1: Clean build from scratch**

Run: `rm -rf dist && npm run build && test -f dist/index.js && echo "built"`
Expected: `built`.

- [ ] **Step 2: Full functional smoke (isolated data dir)**

Run:
```bash
NUTRITION_MCP_HOME="$(mktemp -d)" bash -c 'printf "%s\n%s\n%s\n" \
"{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"t\",\"version\":\"0\"}}}" \
"{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"log_food\",\"arguments\":{\"rawEntry\":\"oatmeal\",\"calories\":300,\"protein\":10,\"userConfirmed\":true,\"source\":\"https://example.com\"}}}" \
"{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"get_daily_status\",\"arguments\":{}}}" \
| node dist/index.js 2>/dev/null' | grep -o "\"logged\":[a-z]*\|\"consumed\":[0-9]*"
```
Expected: shows `"logged":true` and `"consumed":300` (calories) among the matches.

- [ ] **Step 3: Commit any stray build/doc changes (if `git status` is dirty)**

Run: `git status --porcelain`
If anything is uncommitted, `git add -A && git commit -m "chore: finalize strip-estimation"`. Otherwise skip.

- [ ] **Step 4: Push to GitHub**

Run: `git push origin main 2>&1 | tail -3`
Expected: a successful push line (`main -> main`).

- [ ] **Step 5: Verify the live npx path still builds and lists 8 tools**

Run (clears npx cache so it re-fetches the new commit):
```bash
rm -rf ~/.npm/_npx 2>/dev/null; cd /tmp && printf '%s\n%s\n' \
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}' \
'{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
| npx -y github:ronkommoji/nutrition-mcp 2>/dev/null | grep -o '"name":"[a-z_]*"' | sort -u
```
Expected: exactly 8 tool names, no `estimate_nutrition`.

---

## Self-Review

**Spec coverage:**
- Remove `estimate_nutrition` → Task 1 Steps 6, 8, 10. ✓
- Rewrite `log_food` (explicit numbers, confirm gate, notes/source) → Task 1 Step 3. ✓
- Simplify `FoodLogEntry`; remove estimation types → Task 1 Steps 1, 2. ✓
- Update `search_food_history`/`export_logs` → Task 1 Steps 4, 5. ✓
- Remove `nutrition_policy` resource (3→2) → Task 1 Step 7, verified Step 10. ✓
- Delete `providers/`, `resources/`, `prompts/` → Task 1 Step 8, verified Step 11. ✓
- Rewrite skill → Task 2. ✓
- README/install/.env keys removal → Task 3. ✓
- Version 0.3.0 → Task 4. ✓
- Success criteria 1–7 → Task 1 Steps 9–11, Task 5 Steps 1–5. ✓

**Placeholder scan:** No TBD/TODO; all file contents and commands concrete. ✓

**Type/name consistency:** New `FoodLogEntry` fields (`rawEntry`, `calories`, `protein`, `userConfirmed`, `notes?`, `source?`) are used consistently across `log_food`, `search_food_history`, `export_logs`, and `types.ts`. Helper removals (`parseConfidence`, `parseMode`, `optionalItems`, `optionalStringArray`) match their only consumer (`log_food`), which no longer imports them. ✓
