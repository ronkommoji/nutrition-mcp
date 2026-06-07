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
