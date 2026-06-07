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

## API keys

Add an `env` block to the server entry to enable richer lookups (omit for local
fallback). The server does not read a `.env` file.

```json
"env": {
  "GEMINI_API_KEY": "your-key",
  "FATSECRET_CLIENT_ID": "...",
  "FATSECRET_CLIENT_SECRET": "..."
}
```

Claude Code expands `${VAR}`, so you can keep the secret in your shell instead of
the file: `"env": { "GEMINI_API_KEY": "${GEMINI_API_KEY}" }`.

## Requirements

Node.js ≥ 20.
