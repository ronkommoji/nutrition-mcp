import { randomUUID } from "node:crypto";
import type { FoodLogEntry } from "../types.js";
import type { ToolDefinition } from "./tool.js";
import {
  asRecord,
  assertDateKey,
  jsonSchema,
  optionalBoolean,
  optionalString,
  requiredNumber,
  requiredString,
  roundProtein,
  todayForTimezone
} from "./common.js";

export const logFoodTool: ToolDefinition = {
  name: "log_food",
  description:
    "Store a confirmed food entry. The agent supplies calories and protein (estimated with its own knowledge or web search). Requires userConfirmed: true.",
  inputSchema: jsonSchema(
    {
      rawEntry: { type: "string", description: "Food description, e.g. '2 eggs and toast'." },
      calories: { type: "number", description: "Calories to log." },
      protein: { type: "number", description: "Protein grams to log." },
      userConfirmed: {
        type: "boolean",
        description: "Must be true; the user confirmed the estimate before logging."
      },
      notes: { type: "string", description: "Optional assumptions or context, e.g. 'assumed 2 large eggs'." },
      source: { type: "string", description: "Optional source, e.g. a URL used to estimate." },
      date: { type: "string", description: "YYYY-MM-DD date. Defaults to today in the profile timezone." },
      timestamp: { type: "string", description: "ISO timestamp. Defaults to now." }
    },
    ["rawEntry", "calories", "protein", "userConfirmed"]
  ),
  async handler(rawArgs, { storage }) {
    const args = asRecord(rawArgs);
    const rawEntry = requiredString(args, "rawEntry");
    const calories = requiredNumber(args, "calories");
    const protein = requiredNumber(args, "protein");
    const userConfirmed = optionalBoolean(args, "userConfirmed") ?? false;

    if (!userConfirmed) {
      return {
        logged: false,
        reason: "log_food requires userConfirmed: true. Confirm the estimate with the user first."
      };
    }

    const profile = await storage.readProfile();
    const timezone = profile?.timezone ?? "UTC";
    const date = assertDateKey(optionalString(args, "date") ?? todayForTimezone(timezone));
    const timestamp = optionalString(args, "timestamp") ?? new Date().toISOString();
    const notes = optionalString(args, "notes");
    const source = optionalString(args, "source");

    const entry: FoodLogEntry = {
      id: randomUUID(),
      timestamp,
      date,
      rawEntry,
      calories: Math.round(calories),
      protein: roundProtein(protein),
      userConfirmed: true,
      ...(notes ? { notes } : {}),
      ...(source ? { source } : {})
    };

    const dailyLog = await storage.appendFoodLog(date, entry);
    return {
      logged: true,
      entry,
      dailyTotals: dailyLog.totals
    };
  }
};
