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

## No API keys

None required — the agent estimates nutrition itself. The only optional `env`
value is `NUTRITION_MCP_HOME` (storage location).

## Skill (recommended)

If your client supports system instructions, paste the body of
`skills/nutrition-tracking/SKILL.md` so the agent follows the
estimate → confirm → log policy.

## Requirements

Node.js ≥ 20.
