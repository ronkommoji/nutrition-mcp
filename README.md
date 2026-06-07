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

- **MCP server** — 8 tools + 2 resources (below).
- **Skill** — [`skills/nutrition-tracking/SKILL.md`](skills/nutrition-tracking/SKILL.md):
  the estimate → confirm → log policy that makes the tools behave well. Auto-loaded
  by the Claude plugin; paste into system instructions / AGENTS.md for other agents.

## Tools

- `setup_profile` — create a user profile.
- `update_profile` — update goals, weight, goal type, or timezone.
- `log_food` — store a confirmed meal.
- `undo_last_log` — remove the most recent entry.
- `get_daily_status` — current day progress.
- `get_weekly_summary` — weekly averages and tracked-day metrics.
- `search_food_history` — search previous meals.
- `export_logs` — export logs as JSON or CSV.

## Resources

- `nutrition://user_profile`
- `nutrition://daily_summary`

## Logging policy

The agent estimates calories and protein itself (its own knowledge plus web
search), shows its assumptions, and logs only after the user confirms.
`log_food` refuses any entry without `userConfirmed: true`.

## Storage

Data is stored under `~/.nutrition-mcp/` by default (`profile.json`, `logs/`,
`weekly/`, `cache/`, `settings.json`). Override with `NUTRITION_MCP_HOME`.

## No API keys

There are none. The agent's own model estimates calories and protein (its
knowledge plus web search), and the server only stores and reports them. The
single optional setting is `NUTRITION_MCP_HOME` (storage location, default
`~/.nutrition-mcp`).

## Local development

```bash
npm install
npm run build   # or: npm run dev   (tsx watch)
npm start
```

## License

MIT
