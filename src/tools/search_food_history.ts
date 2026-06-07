import type { FoodLogEntry } from "../types.js";
import type { ToolDefinition } from "./tool.js";
import { asRecord, assertDateKey, jsonSchema, optionalNumber, optionalString, requiredString } from "./common.js";

export const searchFoodHistoryTool: ToolDefinition = {
  name: "search_food_history",
  description: "Search previous logged meals by raw text or parsed food item names.",
  inputSchema: jsonSchema(
    {
      query: { type: "string" },
      limit: { type: "number", default: 10 },
      startDate: { type: "string", description: "Optional YYYY-MM-DD start date." },
      endDate: { type: "string", description: "Optional YYYY-MM-DD end date." }
    },
    ["query"]
  ),
  async handler(rawArgs, { storage }) {
    const args = asRecord(rawArgs);
    const query = requiredString(args, "query");
    const limit = Math.max(1, Math.min(optionalNumber(args, "limit") ?? 10, 50));
    const startDate = optionalString(args, "startDate");
    const endDate = optionalString(args, "endDate");
    const logs = await storage.readLogsBetween(
      startDate ? assertDateKey(startDate) : undefined,
      endDate ? assertDateKey(endDate) : undefined
    );
    const terms = tokenize(query);

    const matches = logs
      .flatMap((log) => log.entries.map((entry) => ({ date: log.date, entry, score: scoreEntry(entry, terms) })))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score || b.entry.timestamp.localeCompare(a.entry.timestamp))
      .slice(0, limit)
      .map(({ date, entry, score }) => ({ date, score, entry }));

    return {
      query,
      matches
    };
  }
};

function scoreEntry(entry: FoodLogEntry, terms: string[]): number {
  const haystack = [entry.rawEntry, entry.notes ?? "", entry.source ?? ""]
    .join(" ")
    .toLowerCase();

  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function tokenize(query: string): string[] {
  const stopWords = new Set(["same", "as", "yesterday", "today", "meal", "food", "the", "a", "an"]);
  return query
    .toLowerCase()
    .split(/[^a-z0-9'-]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1 && !stopWords.has(term));
}
