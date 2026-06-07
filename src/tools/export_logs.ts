import type { DailyLog, UserProfile } from "../types.js";
import type { ToolDefinition } from "./tool.js";
import { asRecord, assertDateKey, jsonSchema, optionalString } from "./common.js";

export const exportLogsTool: ToolDefinition = {
  name: "export_logs",
  description: "Export profile and food logs as JSON or CSV text.",
  inputSchema: jsonSchema({
    format: { type: "string", enum: ["json", "csv"], default: "json" },
    startDate: { type: "string", description: "Optional YYYY-MM-DD start date." },
    endDate: { type: "string", description: "Optional YYYY-MM-DD end date." }
  }),
  async handler(rawArgs, { storage }) {
    const args = asRecord(rawArgs);
    const format = optionalString(args, "format") ?? "json";
    if (format !== "json" && format !== "csv") {
      throw new Error("format must be json or csv");
    }
    const startDate = optionalString(args, "startDate");
    const endDate = optionalString(args, "endDate");
    const profile = await storage.readProfile();
    const logs = await storage.readLogsBetween(
      startDate ? assertDateKey(startDate) : undefined,
      endDate ? assertDateKey(endDate) : undefined
    );

    if (format === "csv") {
      return {
        format,
        content: toCsv(logs)
      };
    }

    return {
      format,
      content: JSON.stringify({ profile, logs }, null, 2)
    };
  }
};

function toCsv(logs: DailyLog[]): string {
  const rows = [["date", "timestamp", "raw_entry", "calories", "protein", "notes", "source"]];

  for (const log of logs) {
    for (const entry of log.entries) {
      rows.push([
        log.date,
        entry.timestamp,
        entry.rawEntry,
        String(entry.calories),
        String(entry.protein),
        entry.notes ?? "",
        entry.source ?? ""
      ]);
    }
  }

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function csvEscape(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}
