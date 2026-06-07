import { randomUUID } from "node:crypto";
import { estimateNutritionFromText } from "../providers/llm_fallback.js";
import type { FoodLogEntry } from "../types.js";
import type { ToolDefinition } from "./tool.js";
import {
  asRecord,
  assertDateKey,
  jsonSchema,
  optionalBoolean,
  optionalItems,
  optionalNumber,
  optionalString,
  optionalStringArray,
  parseConfidence,
  parseMode,
  requiredString,
  roundProtein,
  todayForTimezone
} from "./common.js";

export const logFoodTool: ToolDefinition = {
  name: "log_food",
  description: "Store a confirmed food entry in the filesystem daily log.",
  inputSchema: jsonSchema(
    {
      rawEntry: { type: "string", description: "Original user food entry." },
      calories: { type: "number", description: "Calories to log. If omitted, the server estimates first." },
      protein: { type: "number", description: "Protein grams to log. If omitted, the server estimates first." },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      reasoning: { type: "string" },
      sources: { type: "array", items: { type: "string" } },
      assumptions: { type: "array", items: { type: "string" } },
      items: { type: "array", items: { type: "object" } },
      userConfirmed: { type: "boolean", description: "Whether the user confirmed an estimate before logging." },
      date: { type: "string", description: "YYYY-MM-DD date. Defaults to today in the profile timezone." },
      timestamp: { type: "string", description: "ISO timestamp. Defaults to now." },
      mode: { type: "string", enum: ["user_provided", "local_usda", "local_branded", "llm_fallback"] }
    },
    ["rawEntry"]
  ),
  async handler(rawArgs, { storage }) {
    const args = asRecord(rawArgs);
    const rawEntry = requiredString(args, "rawEntry");
    const profile = await storage.readProfile();
    const timezone = profile?.timezone ?? "UTC";
    const date = assertDateKey(optionalString(args, "date") ?? todayForTimezone(timezone));
    const timestamp = optionalString(args, "timestamp") ?? new Date().toISOString();
    const estimate = estimateNutritionFromText(rawEntry);

    const calories = optionalNumber(args, "calories") ?? estimate.calories;
    const protein = optionalNumber(args, "protein") ?? estimate.protein;
    const userConfirmed = optionalBoolean(args, "userConfirmed") ?? false;
    const confidence = parseConfidence(args.confidence, estimate.confidence);
    const sources = optionalStringArray(args, "sources") ?? estimate.sources;
    const assumptions = optionalStringArray(args, "assumptions") ?? estimate.assumptions;
    const items = optionalItems(args, "items") ?? estimate.items;
    const reasoning = optionalString(args, "reasoning") ?? estimate.reasoning;
    const mode = parseMode(args.mode, estimate.mode);

    if (calories === null || protein === null) {
      return {
        logged: false,
        reason: "Nutrition values were not reliable enough to log.",
        estimate,
        clarificationQuestions: estimate.clarificationQuestions
      };
    }

    if (confidence !== "high" && !userConfirmed) {
      return {
        logged: false,
        reason: "Medium and low confidence estimates require user confirmation before logging.",
        estimate,
        clarificationQuestions: estimate.clarificationQuestions
      };
    }

    const entry: FoodLogEntry = {
      id: randomUUID(),
      timestamp,
      date,
      rawEntry,
      items,
      calories: Math.round(calories),
      protein: roundProtein(protein),
      confidence,
      sources,
      reasoning,
      assumptions,
      userConfirmed: userConfirmed || confidence === "high",
      mode
    };

    const dailyLog = await storage.appendFoodLog(date, entry);
    return {
      logged: true,
      entry,
      dailyTotals: dailyLog.totals
    };
  }
};
