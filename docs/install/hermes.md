# Install on Hermes Agent

Hermes connects to MCP servers via its YAML config (`mcp_servers:` block).

1. Add this to your Hermes MCP config:

   ```yaml
   mcp_servers:
     nutrition:
       command: "npx"
       args: ["-y", "github:ronkommoji/nutrition-mcp"]
       enabled: true
       # env:                      # optional
       #   NUTRITION_MCP_HOME: "~/.nutrition-mcp"   # storage location
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
