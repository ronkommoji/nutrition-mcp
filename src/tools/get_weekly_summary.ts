import type { ToolDefinition } from "./tool.js";
import { datesBetween, weekBounds } from "../storage/filesystem.js";
import type { DailyLog, WeeklySummary } from "../types.js";
import { asRecord, assertDateKey, jsonSchema, optionalString, todayForTimezone } from "./common.js";

export const getWeeklySummaryTool: ToolDefinition = {
  name: "get_weekly_summary",
  description: "Return weekly calorie and protein averages, best day, and tracked-day count.",
  inputSchema: jsonSchema({
    date: { type: "string", description: "Any YYYY-MM-DD date in the desired ISO week. Defaults to today." }
  }),
  async handler(rawArgs, { storage }) {
    const args = asRecord(rawArgs);
    const profile = await storage.readProfile();
    const date = assertDateKey(optionalString(args, "date") ?? todayForTimezone(profile?.timezone ?? "UTC"));
    const bounds = weekBounds(date);
    const logs = await Promise.all(datesBetween(bounds.startDate, bounds.endDate).map((day) => storage.readDailyLog(day)));
    const tracked = logs.filter((log) => log.entries.length > 0);
    const summary = buildWeeklySummary(bounds.week, bounds.startDate, bounds.endDate, logs, profile);
    await storage.writeWeeklySummary(summary);

    return {
      ...summary,
      daysTracked: tracked.length
    };
  }
};

function buildWeeklySummary(
  week: string,
  startDate: string,
  endDate: string,
  logs: DailyLog[],
  profile: { dailyCalorieGoal: number; dailyProteinGoal: number } | null
): WeeklySummary {
  const tracked = logs.filter((log) => log.entries.length > 0);
  const totals = tracked.reduce(
    (sum, log) => ({
      calories: sum.calories + log.totals.calories,
      protein: sum.protein + log.totals.protein
    }),
    { calories: 0, protein: 0 }
  );

  return {
    week,
    startDate,
    endDate,
    averageCalories: tracked.length === 0 ? 0 : Math.round(totals.calories / tracked.length),
    averageProtein: tracked.length === 0 ? 0 : Math.round((totals.protein / tracked.length) * 10) / 10,
    bestDay: chooseBestDay(tracked, profile),
    daysTracked: tracked.length,
    totalsByDay: logs.map((log) => ({
      date: log.date,
      calories: log.totals.calories,
      protein: log.totals.protein
    })),
    generatedAt: new Date().toISOString()
  };
}

function chooseBestDay(
  logs: DailyLog[],
  profile: { dailyCalorieGoal: number; dailyProteinGoal: number } | null
): string | null {
  if (logs.length === 0) {
    return null;
  }

  if (!profile) {
    return [...logs].sort((a, b) => b.totals.protein - a.totals.protein)[0]?.date ?? null;
  }

  return [...logs].sort((a, b) => adherenceScore(a, profile) - adherenceScore(b, profile))[0]?.date ?? null;
}

function adherenceScore(log: DailyLog, profile: { dailyCalorieGoal: number; dailyProteinGoal: number }): number {
  const calorieScore = Math.abs(log.totals.calories - profile.dailyCalorieGoal) / profile.dailyCalorieGoal;
  const proteinScore = Math.abs(log.totals.protein - profile.dailyProteinGoal) / profile.dailyProteinGoal;
  return calorieScore + proteinScore;
}
