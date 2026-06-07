import { estimateNutritionFromText } from "../providers/llm_fallback.js";
import type { ToolDefinition } from "./tool.js";
import { asRecord, jsonSchema, requiredString } from "./common.js";

export const estimateNutritionTool: ToolDefinition = {
  name: "estimate_nutrition",
  description: "Estimate calories and protein from a natural-language food entry without logging it.",
  inputSchema: jsonSchema(
    {
      query: { type: "string", description: "Natural-language food entry, e.g. '2 eggs and toast'." }
    },
    ["query"]
  ),
  async handler(rawArgs) {
    const args = asRecord(rawArgs);
    const estimate = estimateNutritionFromText(requiredString(args, "query"));
    return {
      estimate,
      recommendation: recommendationFor(estimate.confidence)
    };
  }
};

function recommendationFor(confidence: string): string {
  if (confidence === "high") {
    return "Can suggest direct logging, but confirmation is still acceptable.";
  }
  if (confidence === "medium") {
    return "Ask the user to confirm before logging.";
  }
  return "Ask follow-up questions before logging.";
}
