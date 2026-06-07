import type { ToolDefinition } from "./tool.js";
import { asRecord, assertDateKey, jsonSchema, optionalString } from "./common.js";

export const undoLastLogTool: ToolDefinition = {
  name: "undo_last_log",
  description: "Remove the most recent food log entry, optionally constrained to a specific date.",
  inputSchema: jsonSchema({
    date: { type: "string", description: "Optional YYYY-MM-DD date." }
  }),
  async handler(rawArgs, { storage }) {
    const args = asRecord(rawArgs);
    const date = optionalString(args, "date");
    const removed = await storage.undoLastLog(date ? assertDateKey(date) : undefined);
    if (!removed) {
      return {
        undone: false,
        message: "No logged food entries were found."
      };
    }
    return {
      undone: true,
      removed
    };
  }
};
