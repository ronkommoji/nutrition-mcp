# Install on Codex

Codex reads MCP servers from its config (`~/.codex/config.toml`).

```toml
[mcp_servers.nutrition]
command = "npx"
args = ["-y", "github:ronkommoji/nutrition-mcp"]

# Optional — change the storage location:
# [mcp_servers.nutrition.env]
# NUTRITION_MCP_HOME = "~/.nutrition-mcp"
```

Restart Codex so it picks up the new server, then ask it to log or estimate food.

## Skill (recommended)

Codex does not auto-load Claude skills. Paste the body of
[`skills/nutrition-tracking/SKILL.md`](../../skills/nutrition-tracking/SKILL.md)
into your `AGENTS.md` so Codex follows the estimate → confirm → log policy.

## Requirements

Node.js ≥ 20.
