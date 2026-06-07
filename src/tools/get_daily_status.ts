import type { ToolDefinition } from "./tool.js";
import { asRecord, assertDateKey, jsonSchema, optionalString, todayForTimezone } from "./common.js";

export const getDailyStatusTool: ToolDefinition = {
  name: "get_daily_status",
  description: "Return calories, protein, remaining goals, and entries for a day.",
  inputSchema: jsonSchema({
    date: { type: "string", description: "Optional YYYY-MM-DD date. Defaults to today in the profile timezone." }
  }),
  async handler(rawArgs, { storage }) {
    const args = asRecord(rawArgs);
    const profile = await storage.readProfile();
    const date = assertDateKey(optionalString(args, "date") ?? todayForTimezone(profile?.timezone ?? "UTC"));
    const log = await storage.readDailyLog(date);

    return {
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
      },
      entries: log.entries
    };
  }
};
