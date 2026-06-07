# Install on Codex

Codex reads MCP servers from its config (`~/.codex/config.toml`).

```toml
[mcp_servers.nutrition]
command = "npx"
args = ["-y", "github:ronkommoji/nutrition-mcp"]

# Optional — works without keys (local fallback):
# [mcp_servers.nutrition.env]
# GEMINI_API_KEY = "..."            # enables Gemini estimation
# FATSECRET_CLIENT_ID = "..."       # both required for FatSecret
# FATSECRET_CLIENT_SECRET = "..."
```

Restart Codex so it picks up the new server, then ask it to log or estimate food.

## Skill (recommended)

Codex does not auto-load Claude skills. Paste the body of
[`skills/nutrition-tracking/SKILL.md`](../../skills/nutrition-tracking/SKILL.md)
into your `AGENTS.md` so Codex follows the estimate → confirm → log policy.

## Requirements

Node.js ≥ 20.
