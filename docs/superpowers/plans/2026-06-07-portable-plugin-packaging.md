# Portable Plugin Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repackage the existing `nutrition-mcp` server so a single `npx -y github:ronkommoji/nutrition-mcp` command installs it into any MCP-capable agent (Hermes, Claude Code, Codex, generic), with a portable skill and per-agent install docs.

**Architecture:** The MCP server stays the single source of truth. We add a `prepare` build hook so the package self-builds when fetched from git, stop tracking generated `dist/`, add a portable `SKILL.md`, a Claude Code plugin wrapper (`.claude-plugin/` + `.mcp.json`), per-agent install docs, and a rewritten README. No server logic changes.

**Tech Stack:** Node ≥ 20, TypeScript, `@modelcontextprotocol/sdk` (stdio), npm `prepare`/git-install, Claude Code plugin + marketplace JSON, YAML/TOML/JSON agent configs.

---

## File Structure

- Create: `.mcp.json` — MCP server definition (npx github command).
- Create: `.claude-plugin/plugin.json` — Claude plugin manifest (metadata; skill + mcp auto-discovered).
- Create: `.claude-plugin/marketplace.json` — makes the repo an installable marketplace.
- Create: `skills/nutrition-tracking/SKILL.md` — portable behavioral skill.
- Create: `docs/install/hermes.md`, `docs/install/claude.md`, `docs/install/codex.md`, `docs/install/generic-mcp.md`.
- Modify: `package.json` — add `prepare`, `files`, `repository`, `homepage`, `bugs`, bump version.
- Modify: `.gitignore` — already ignores `dist/`, `node_modules/`, `.env` (created during brainstorming); verify only.
- Modify: `README.md` — rewrite as per-agent quickstart.
- Untrack: `dist/` (it is currently on disk but not yet committed; ensure it is never committed).

Note: this directory was `git init`-ed during brainstorming; the design doc + `.gitignore` are already committed. `dist/` is on disk but untracked, so no `git rm` is needed — `.gitignore` keeps it out.

---

### Task 1: Packaging — `package.json` self-building git install

**Files:**
- Modify: `package.json`
- Verify: `.gitignore`

- [ ] **Step 1: Confirm `.gitignore` excludes generated/secret files**

Run: `cat "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp/.gitignore"`
Expected output contains exactly these lines:
```
node_modules/
dist/
.env
```
If any are missing, add them.

- [ ] **Step 2: Confirm `dist/` is untracked**

Run: `cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp" && git status --porcelain dist | head`
Expected: no output (dist is ignored, not staged). If `dist/` shows as tracked, run `git rm -r --cached dist`.

- [ ] **Step 3: Rewrite `package.json`**

Replace the full contents of `package.json` with:
```json
{
  "name": "nutrition-mcp",
  "version": "0.2.0",
  "description": "Filesystem-based MCP server for conversational calorie and protein tracking. Installs into any MCP-capable agent (Hermes, Claude Code, Codex).",
  "type": "module",
  "bin": {
    "nutrition-mcp": "./dist/index.js"
  },
  "files": [
    "dist",
    "skills",
    "src",
    "README.md"
  ],
  "scripts": {
    "build": "tsc",
    "prepare": "npm run build",
    "typecheck": "tsc --noEmit",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "keywords": [
    "mcp",
    "model-context-protocol",
    "nutrition",
    "calorie-tracker",
    "protein-tracker",
    "hermes",
    "claude-code"
  ],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ronkommoji/nutrition-mcp.git"
  },
  "homepage": "https://github.com/ronkommoji/nutrition-mcp#readme",
  "bugs": {
    "url": "https://github.com/ronkommoji/nutrition-mcp/issues"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.13.0"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 4: Verify the build still works and produces the bin**

Run: `cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp" && npm run build && test -f dist/index.js && head -1 dist/index.js`
Expected: build completes with no errors; prints `#!/usr/bin/env node`.

- [ ] **Step 5: Verify the server starts and lists all 9 tools over stdio**

Run:
```bash
cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp" && printf '%s\n%s\n' \
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}' \
'{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
| node dist/index.js 2>/dev/null | grep -o '"name":"[a-z_]*"' | sort -u
```
Expected: includes `estimate_nutrition`, `export_logs`, `get_daily_status`, `get_weekly_summary`, `log_food`, `search_food_history`, `setup_profile`, `undo_last_log`, `update_profile`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp"
git add package.json .gitignore
git commit -m "chore: package for git-install with prepare build hook"
```

---

### Task 2: MCP server definition (`.mcp.json`)

**Files:**
- Create: `.mcp.json`

- [ ] **Step 1: Create `.mcp.json`**

```json
{
  "mcpServers": {
    "nutrition": {
      "command": "npx",
      "args": ["-y", "github:ronkommoji/nutrition-mcp"]
    }
  }
}
```

- [ ] **Step 2: Validate it is well-formed JSON**

Run: `cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp" && node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp"
git add .mcp.json
git commit -m "feat: add .mcp.json for direct Claude/MCP-client install"
```

---

### Task 3: Portable skill (`skills/nutrition-tracking/SKILL.md`)

**Files:**
- Create: `skills/nutrition-tracking/SKILL.md`

- [ ] **Step 1: Create `skills/nutrition-tracking/SKILL.md`**

```markdown
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
```

- [ ] **Step 2: Verify frontmatter parses (name + description present)**

Run: `cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp" && head -4 skills/nutrition-tracking/SKILL.md`
Expected: shows YAML frontmatter with `name: nutrition-tracking` and a `description:` line.

- [ ] **Step 3: Commit**

```bash
cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp"
git add skills/nutrition-tracking/SKILL.md
git commit -m "feat: add portable nutrition-tracking skill"
```

---

### Task 4: Claude plugin wrapper (`.claude-plugin/`)

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Create `.claude-plugin/plugin.json`**

The `skills/` directory and root `.mcp.json` are auto-discovered by Claude Code;
this file supplies metadata.
```json
{
  "name": "nutrition-mcp",
  "version": "0.2.0",
  "description": "Conversational calorie and protein tracker: nutrition tools plus an estimate-then-confirm-then-log skill.",
  "author": {
    "name": "ronkommoji",
    "email": "ronkommoji@gmail.com"
  },
  "homepage": "https://github.com/ronkommoji/nutrition-mcp#readme",
  "repository": "https://github.com/ronkommoji/nutrition-mcp",
  "license": "MIT",
  "keywords": ["nutrition", "calorie-tracker", "protein-tracker", "mcp"]
}
```

- [ ] **Step 2: Create `.claude-plugin/marketplace.json`**

```json
{
  "name": "nutrition-mcp",
  "owner": {
    "name": "ronkommoji",
    "url": "https://github.com/ronkommoji"
  },
  "plugins": [
    {
      "name": "nutrition-mcp",
      "source": "./",
      "description": "Conversational calorie and protein tracker (tools + skill)."
    }
  ]
}
```

- [ ] **Step 3: Validate both files are well-formed JSON**

Run:
```bash
cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp" && for f in .claude-plugin/plugin.json .claude-plugin/marketplace.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8')); console.log('$f ok')"; done
```
Expected: `.claude-plugin/plugin.json ok` and `.claude-plugin/marketplace.json ok`.

- [ ] **Step 4: Commit**

```bash
cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp"
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "feat: add Claude Code plugin + marketplace manifests"
```

---

### Task 5: Per-agent install docs (`docs/install/`)

**Files:**
- Create: `docs/install/hermes.md`
- Create: `docs/install/claude.md`
- Create: `docs/install/codex.md`
- Create: `docs/install/generic-mcp.md`

- [ ] **Step 1: Create `docs/install/hermes.md`**

```markdown
# Install on Hermes Agent

Hermes connects to MCP servers via its YAML config (`mcp_servers:` block).

1. Add this to your Hermes MCP config:

   ```yaml
   mcp_servers:
     nutrition:
       command: "npx"
       args: ["-y", "github:ronkommoji/nutrition-mcp"]
       enabled: true
       # env:                      # optional — works without keys (local fallback)
       #   USDA_API_KEY: "..."
       #   FATSECRET_CLIENT_ID: "..."
       #   FATSECRET_CLIENT_SECRET: "..."
       #   GEMINI_API_KEY: "..."
       #   NUTRITION_MCP_HOME: "~/.nutrition-mcp"
   ```

2. Apply it: run `/reload-mcp` in Hermes.
3. Hermes auto-discovers the nutrition tools. Try: "I had 2 eggs and toast."

## Skill (recommended)

Hermes does not auto-load Claude skills. For best behavior, paste the contents of
[`skills/nutrition-tracking/SKILL.md`](../../skills/nutrition-tracking/SKILL.md)
(below the frontmatter) into your Hermes system instructions so it follows the
estimate → confirm → log policy.

## Requirements

Node.js ≥ 20 on the machine running Hermes (so `npx` can fetch and build the server).
```

- [ ] **Step 2: Create `docs/install/claude.md`**

```markdown
# Install on Claude Code

## Option A — Plugin (tools + skill in one step, recommended)

```text
/plugin marketplace add ronkommoji/nutrition-mcp
/plugin install nutrition-mcp
```

This registers the `nutrition` MCP server and loads the `nutrition-tracking`
skill. Restart or reload when prompted.

## Option B — MCP server only

Copy [`.mcp.json`](../../.mcp.json) into your project root, or add to your
Claude config:

```json
{
  "mcpServers": {
    "nutrition": {
      "command": "npx",
      "args": ["-y", "github:ronkommoji/nutrition-mcp"]
    }
  }
}
```

## Optional provider keys

Add an `env` block to the server entry to enable USDA/FatSecret/Gemini lookups
(omit for local fallback):

```json
"env": { "USDA_API_KEY": "...", "GEMINI_API_KEY": "..." }
```

## Requirements

Node.js ≥ 20.
```

- [ ] **Step 3: Create `docs/install/codex.md`**

```markdown
# Install on Codex

Codex reads MCP servers from its config (`~/.codex/config.toml`).

```toml
[mcp_servers.nutrition]
command = "npx"
args = ["-y", "github:ronkommoji/nutrition-mcp"]

# Optional — works without keys (local fallback):
# [mcp_servers.nutrition.env]
# USDA_API_KEY = "..."
# GEMINI_API_KEY = "..."
```

Restart Codex so it picks up the new server, then ask it to log or estimate food.

## Skill (recommended)

Codex does not auto-load Claude skills. Paste the body of
[`skills/nutrition-tracking/SKILL.md`](../../skills/nutrition-tracking/SKILL.md)
into your `AGENTS.md` so Codex follows the estimate → confirm → log policy.

## Requirements

Node.js ≥ 20.
```

- [ ] **Step 4: Create `docs/install/generic-mcp.md`**

```markdown
# Install on any MCP client (Cursor, Windsurf, Claude Desktop, etc.)

Most MCP clients accept a `mcpServers` JSON block. Add:

```json
{
  "mcpServers": {
    "nutrition": {
      "command": "npx",
      "args": ["-y", "github:ronkommoji/nutrition-mcp"],
      "env": {}
    }
  }
}
```

Where to put it:
- **Claude Desktop:** `claude_desktop_config.json`.
- **Cursor / Windsurf:** the MCP settings panel or their `mcp.json`.
- **Other clients:** see your client's MCP configuration docs.

## Optional provider keys

Fill the `env` object with any of `USDA_API_KEY`, `FATSECRET_CLIENT_ID`,
`FATSECRET_CLIENT_SECRET`, `GEMINI_API_KEY`, `NUTRITION_MCP_HOME`. All optional —
the server uses local fallback data when they are absent.

## Skill (recommended)

If your client supports system instructions, paste the body of
`skills/nutrition-tracking/SKILL.md` so the agent follows the
estimate → confirm → log policy.

## Requirements

Node.js ≥ 20.
```

- [ ] **Step 5: Commit**

```bash
cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp"
git add docs/install
git commit -m "docs: add per-agent install guides"
```

---

### Task 6: Rewrite `README.md` as a per-agent quickstart

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the full contents of `README.md`**

```markdown
# Nutrition MCP

A filesystem-based [MCP](https://modelcontextprotocol.io) server that turns any
MCP-capable AI agent into a conversational calorie and protein tracker:
natural-language estimates, confidence-aware logging, daily/weekly progress,
food-history search, and export. Works offline with local fallback data — no API
keys required.

## Quickstart

The server runs straight from GitHub via `npx` — no clone, no manual build (it
self-builds on first fetch). You only need **Node.js ≥ 20**.

The one command every agent uses:

```
npx -y github:ronkommoji/nutrition-mcp
```

Pick your agent:

| Agent | Guide |
|-------|-------|
| Hermes Agent | [docs/install/hermes.md](docs/install/hermes.md) |
| Claude Code | [docs/install/claude.md](docs/install/claude.md) |
| Codex | [docs/install/codex.md](docs/install/codex.md) |
| Cursor / Windsurf / Claude Desktop / other | [docs/install/generic-mcp.md](docs/install/generic-mcp.md) |

Claude Code users can install tools **and** the skill in one step:

```text
/plugin marketplace add ronkommoji/nutrition-mcp
/plugin install nutrition-mcp
```

## What's included

- **MCP server** — 9 tools + 3 resources (below).
- **Skill** — [`skills/nutrition-tracking/SKILL.md`](skills/nutrition-tracking/SKILL.md):
  the estimate → confirm → log policy that makes the tools behave well. Auto-loaded
  by the Claude plugin; paste into system instructions / AGENTS.md for other agents.

## Tools

- `setup_profile` — create a user profile.
- `update_profile` — update goals, weight, goal type, or timezone.
- `estimate_nutrition` — estimate calories and protein without logging.
- `log_food` — store a confirmed meal.
- `undo_last_log` — remove the most recent entry.
- `get_daily_status` — current day progress.
- `get_weekly_summary` — weekly averages and tracked-day metrics.
- `search_food_history` — search previous meals.
- `export_logs` — export logs as JSON or CSV.

## Resources

- `nutrition://user_profile`
- `nutrition://daily_summary`
- `nutrition://nutrition_policy`

## Logging policy

Estimate aggressively, log conservatively. High-confidence estimates can be
logged directly; medium confidence needs user confirmation; low confidence
triggers follow-up questions and is never auto-logged.

## Storage

Data is stored under `~/.nutrition-mcp/` by default (`profile.json`, `logs/`,
`weekly/`, `cache/`, `settings.json`). Override with `NUTRITION_MCP_HOME`.

## Optional provider API keys

The server works with no keys via local fallback. To enable external lookups,
set any of `USDA_API_KEY`, `FATSECRET_CLIENT_ID`, `FATSECRET_CLIENT_SECRET`,
`GEMINI_API_KEY` in your agent's MCP `env` config (see the install guides).

## Local development

```bash
npm install
npm run build   # or: npm run dev   (tsx watch)
npm start
```

## License

MIT
```

- [ ] **Step 2: Verify all linked paths exist**

Run:
```bash
cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp" && for p in docs/install/hermes.md docs/install/claude.md docs/install/codex.md docs/install/generic-mcp.md skills/nutrition-tracking/SKILL.md; do test -f "$p" && echo "ok $p" || echo "MISSING $p"; done
```
Expected: five `ok` lines, no `MISSING`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp"
git add README.md
git commit -m "docs: rewrite README as per-agent quickstart"
```

---

### Task 7: End-to-end verification of the git-install path + push instructions

This proves the `prepare` build hook produces a runnable server the way `npx` will, using a packed tarball (the same mechanism without needing the repo pushed yet).

**Files:** none (verification + handoff).

- [ ] **Step 1: Pack the package and inspect contents**

Run: `cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp" && npm pack --dry-run 2>&1 | grep -E "dist/index.js|skills/nutrition-tracking/SKILL.md|package.json"`
Expected: lists `dist/index.js`, `skills/nutrition-tracking/SKILL.md`, and `package.json` among packaged files.

- [ ] **Step 2: Install the packed tarball into a throwaway dir and run the bin (simulates `npx`)**

Run:
```bash
cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp" && TARBALL="$(npm pack 2>/dev/null | tail -1)" && TMP="$(mktemp -d)" && npm --prefix "$TMP" install "$PWD/$TARBALL" >/dev/null 2>&1 && printf '%s\n%s\n' \
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}' \
'{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
| node "$TMP/node_modules/nutrition-mcp/dist/index.js" 2>/dev/null | grep -c '"name":"log_food"'; rm -f "$TARBALL"; rm -rf "$TMP"
```
Expected: prints `1` (the installed package's bin runs and exposes `log_food`).

- [ ] **Step 3: Confirm no secrets or build artifacts are tracked by git**

Run: `cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp" && git ls-files | grep -E "^(dist/|node_modules/|\.env$)" | head`
Expected: no output.

- [ ] **Step 4: Print the push instructions for the user**

The git-install command (`npx github:ronkommoji/nutrition-mcp`) only resolves
once the repo is on GitHub. Tell the user to run:
```bash
gh repo create ronkommoji/nutrition-mcp --public --source="/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp" --remote=origin --push
```
or, without `gh`:
```bash
cd "/Users/ronkommoji/Documents/Coding Projects/nutrition-mcp"
git branch -M main
git remote add origin https://github.com/ronkommoji/nutrition-mcp.git
git push -u origin main
```

- [ ] **Step 5: Final smoke instruction (post-push, optional)**

After pushing, verify the real path end-to-end:
Run: `npx -y github:ronkommoji/nutrition-mcp </dev/null` and confirm it starts without error (Ctrl-C to exit; it waits on stdio).

---

## Self-Review

**Spec coverage:**
- Distribution via `npx github:` + `prepare` build → Task 1, Task 7. ✓
- `dist/` untracked / `.gitignore` → Task 1. ✓
- `.mcp.json` → Task 2. ✓
- Portable skill → Task 3. ✓
- Claude plugin wrapper (plugin.json + marketplace.json) → Task 4. ✓
- Per-agent install docs (hermes/claude/codex/generic) → Task 5. ✓
- README rewrite → Task 6. ✓
- Repo init + push instructions → Task 7 (init already done in brainstorming). ✓
- Server logic unchanged → no task modifies `src/` logic. ✓
- Success criteria 1–5 (npx self-build, Hermes tools, Claude install, generic, offline fallback) → covered by Tasks 1/5/6/7. ✓

**Placeholder scan:** No TBD/TODO; all file contents and commands are concrete. ✓

**Type/name consistency:** Plugin/server/skill names consistent (`nutrition-mcp` package, `nutrition` MCP server key, `nutrition-tracking` skill). Tool names match README/source across all tasks. ✓
