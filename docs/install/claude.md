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

## No API keys

None required — the agent estimates nutrition itself. Optionally set
`NUTRITION_MCP_HOME` in an `env` block to change the storage location:

```json
"env": { "NUTRITION_MCP_HOME": "~/.nutrition-mcp" }
```

## Requirements

Node.js ≥ 20.
