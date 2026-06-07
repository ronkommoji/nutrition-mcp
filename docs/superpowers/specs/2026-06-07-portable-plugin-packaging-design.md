# Design: `nutrition-mcp` as a Portable Agent Plugin

**Date:** 2026-06-07
**Status:** Approved (design phase)
**Owner:** ronkommoji

## Goal

Turn the existing local `nutrition-mcp` project into an artifact that can be
downloaded, set up, and used on any modern AI agent runtime — Hermes, Claude
Code, Codex, and other MCP-capable clients — with minimal friction. First test
target is Hermes.

This is **packaging, a skill layer, manifests, and docs**. Server logic does not
change.

## Background / Research

The universal primitive across all target runtimes is **MCP launched via a
command** (typically `npx`). Confirmed:

- **Hermes Agent (Nous Research)** — connects to MCP servers via a YAML
  `mcp_servers:` config block (`command`, `args`, `env`, `enabled`, optional
  `tools.include`). Supports local stdio + remote HTTP. Auto-discovers tools,
  resources, and prompts. Changes applied with `/reload-mcp`.
- **Claude Code** — reads MCP servers from `.mcp.json`, and supports a native
  **plugin** format: `.claude-plugin/plugin.json` bundling skills/commands/
  agents/hooks/MCP, distributed via a `marketplace.json` catalog.
- **Codex / generic clients (Cursor, Windsurf, etc.)** — MCP server config with
  the same `command`/`args`/`env` shape (TOML or JSON).

The existing server already implements MCP correctly (stdio transport, 9 tools,
3 resources). No rewrite needed.

## Core Principle

The MCP server is the **single source of truth** for all logic. Every agent runs
the *same* server via one pasteable command. The skill and Claude plugin wrapper
are thin layers on top — no per-agent reimplementation of behavior.

## Distribution Mechanism

Run from GitHub via npx — no npm registry, no manual clone/build:

```
npx -y github:ronkommoji/nutrition-mcp
```

Requirements to make this work with zero manual build:

- `package.json` gains a `prepare` script (`npm run build`) so TypeScript is
  compiled automatically when npm fetches the git package (devDependencies are
  available during git-install, so `tsc` runs).
- `dist/` is **removed from version control** and added to `.gitignore` — it is
  a generated artifact produced by `prepare`.
- Existing `bin` entry (`nutrition-mcp` → `./dist/index.js`) and shebang
  (`#!/usr/bin/env node`) are retained so npx can execute it.

## Final Repository Structure

```
nutrition-mcp/
├── .claude-plugin/
│   ├── plugin.json          # Claude Code plugin manifest (name, version, skills, mcp)
│   └── marketplace.json     # lets users add this repo as a marketplace
├── .mcp.json                # MCP server def (npx github command) — Claude reads directly
├── skills/
│   └── nutrition-tracking/
│       └── SKILL.md         # portable skill: estimate→confirm→log flow, confidence thresholds
├── src/                     # existing server — logic unchanged
├── docs/
│   ├── install/
│   │   ├── hermes.md
│   │   ├── claude.md
│   │   ├── codex.md
│   │   └── generic-mcp.md
│   └── superpowers/specs/   # this design doc + future plans
├── package.json             # + prepare, files, repository, homepage metadata
├── .gitignore               # ignore dist/ + node_modules + .env
└── README.md                # rewritten: per-agent quickstart matrix
```

## Components

### 1. Packaging changes (`package.json`, `.gitignore`)
- Add `"prepare": "npm run build"`.
- Add `"files": ["dist", "skills", "src", "README.md"]` (or appropriate set) so
  the package is self-contained.
- Add `repository`, `homepage`, `bugs` metadata pointing at the GitHub repo.
- Bump version to `0.2.0` to mark the packaging milestone.
- `.gitignore`: ignore `dist/`, `node_modules/`, `.env`.
- Stop tracking `dist/` (delete from git index once repo is initialized).

### 2. Portable skill (`skills/nutrition-tracking/SKILL.md`)
Encodes the behavioral policy already in `src/resources/nutrition_policy.md` and
`src/prompts/nutrition_estimator.md`:
- When to use the nutrition tools.
- The estimate → confirm → log flow.
- Confidence thresholds: estimate aggressively; medium confidence requires user
  confirmation; low confidence asks follow-ups and is never auto-logged.
- Worked examples mapping user phrases to tool calls.

Standard skill frontmatter (`name`, `description`) so Claude Code loads it
natively via the plugin. The install docs explain how Hermes/Codex users fold
the same content into their instructions / AGENTS.md.

### 3. Claude plugin wrapper
- `.claude-plugin/plugin.json` — declares metadata, the bundled skill, and the
  MCP server (via `.mcp.json` reference / `mcpServers`).
- `.claude-plugin/marketplace.json` — makes the repo an installable marketplace.
- `.mcp.json` — MCP server definition using `npx -y github:ronkommoji/nutrition-mcp`,
  usable directly by Claude even without the plugin.

Result for Claude users:
`/plugin marketplace add ronkommoji/nutrition-mcp` →
`/plugin install nutrition-mcp` → tools + skill available.

### 4. Per-agent install docs (`docs/install/`)
One short doc each with exact copy-paste config.

Hermes (`hermes.md`):
```yaml
mcp_servers:
  nutrition:
    command: "npx"
    args: ["-y", "github:ronkommoji/nutrition-mcp"]
    enabled: true
    # env:                       # optional — server works without keys (local fallback)
    #   USDA_API_KEY: "..."
```
Then `/reload-mcp`.

Each doc also notes optional provider env vars (USDA / FatSecret / Gemini) and
that the server runs with local fallback data when none are set.

### 5. README rewrite
Per-agent quickstart matrix leading with the one npx command, links to the
install docs, tool/resource reference, and the logging policy summary.

### 6. Repository initialization
The directory is not yet a git repo. Plan includes `git init`, an initial
commit, and concise instructions for the user to create the GitHub repo and
push (so `npx github:ronkommoji/nutrition-mcp` resolves).

## What Does NOT Change

Server logic, the 9 tools, 3 resources, providers (USDA/FatSecret/Gemini
fallback), storage layer. Purely additive packaging + docs + one skill file.

## Success Criteria

1. `npx -y github:ronkommoji/nutrition-mcp` starts the MCP server from a clean
   machine with only Node ≥ 20 installed (no manual build).
2. Pasting the Hermes YAML snippet + `/reload-mcp` surfaces the nutrition tools
   in Hermes.
3. Claude users can install via the marketplace flow and get tools + skill.
4. Codex and generic MCP clients work from their respective install docs.
5. Server still runs offline with local fallback when no provider keys are set.

## Out of Scope

- Publishing to the npm registry (revisit later if desired).
- New nutrition features, providers, or tools.
- Remote/HTTP hosting of the MCP server.
