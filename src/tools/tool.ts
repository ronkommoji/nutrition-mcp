import type { NutritionStorage } from "../storage/filesystem.js";

export interface ToolContext {
  storage: NutritionStorage;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: unknown, context: ToolContext) => Promise<unknown>;
}
