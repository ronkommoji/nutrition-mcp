#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { NUTRITION_POLICY } from "./resources/nutrition_policy.js";
import { NutritionStorage, currentDateInTimezone } from "./storage/filesystem.js";
import { tools } from "./tools/index.js";

const storage = new NutritionStorage();
await storage.ensureInitialized();

const server = new Server(
  {
    name: "nutrition-mcp",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }))
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools.find((candidate) => candidate.name === request.params.name);
  if (!tool) {
    return textResult({ error: `Unknown tool: ${request.params.name}` }, true);
  }

  try {
    const result = await tool.handler(request.params.arguments ?? {}, { storage });
    return textResult(result);
  } catch (error) {
    return textResult(
      {
        error: error instanceof Error ? error.message : String(error)
      },
      true
    );
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "nutrition://user_profile",
      name: "user_profile",
      description: "Current nutrition tracking profile.",
      mimeType: "application/json"
    },
    {
      uri: "nutrition://daily_summary",
      name: "daily_summary",
      description: "Current day calorie and protein totals.",
      mimeType: "application/json"
    },
    {
      uri: "nutrition://nutrition_policy",
      name: "nutrition_policy",
      description: "Accuracy rules and confidence framework.",
      mimeType: "text/markdown"
    }
  ]
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri === "nutrition://user_profile") {
    const profile = await storage.readProfile();
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(profile, null, 2)
        }
      ]
    };
  }

  if (uri === "nutrition://daily_summary") {
    const profile = await storage.readProfile();
    const date = currentDateInTimezone(profile?.timezone ?? "UTC");
    const log = await storage.readDailyLog(date);
    const summary = {
      date,
      calories: {
        consumed: log.totals.calories,
        goal: profile?.dailyCalorieGoal ?? null,
        remaining: profile ? profile.dailyCalorieGoal - log.totals.calories : null
      },
      protein: {
        consumed: log.totals.protein,
        goal: profile?.dailyProteinGoal ?? null,
        remaining: profile ? Math.round((profile.dailyProteinGoal - log.totals.protein) * 10) / 10 : null
      }
    };
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(summary, null, 2)
        }
      ]
    };
  }

  if (uri === "nutrition://nutrition_policy") {
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: NUTRITION_POLICY
        }
      ]
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);

function textResult(value: unknown, isError = false) {
  return {
    isError,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}
