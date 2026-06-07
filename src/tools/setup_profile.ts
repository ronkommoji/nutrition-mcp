import type { ToolDefinition } from "./tool.js";
import { asRecord, jsonSchema, optionalString, parseGoalType, requiredNumber } from "./common.js";
import type { UserProfile } from "../types.js";

export const setupProfileTool: ToolDefinition = {
  name: "setup_profile",
  description: "Create the nutrition tracking profile used for daily goals and timezone-aware logging.",
  inputSchema: jsonSchema(
    {
      name: { type: "string", description: "User name." },
      weight: { type: "number", description: "Current body weight." },
      weightUnit: { type: "string", enum: ["lb", "kg"], default: "lb" },
      dailyCalorieGoal: { type: "number", description: "Daily calorie target." },
      dailyProteinGoal: { type: "number", description: "Daily protein target in grams." },
      goalType: { type: "string", enum: ["cut", "maintain", "bulk"] },
      timezone: { type: "string", description: "IANA timezone, e.g. America/New_York." }
    },
    ["weight", "dailyCalorieGoal", "dailyProteinGoal", "goalType"]
  ),
  async handler(rawArgs, { storage }) {
    const args = asRecord(rawArgs);
    const now = new Date().toISOString();
    const timezone = optionalString(args, "timezone") ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    const weightUnit = args.weightUnit === "kg" ? "kg" : "lb";

    const profile: UserProfile = {
      name: optionalString(args, "name"),
      weight: {
        value: requiredNumber(args, "weight"),
        unit: weightUnit
      },
      dailyCalorieGoal: requiredNumber(args, "dailyCalorieGoal"),
      dailyProteinGoal: requiredNumber(args, "dailyProteinGoal"),
      goalType: parseGoalType(args.goalType),
      timezone,
      createdAt: now,
      updatedAt: now
    };

    await storage.writeProfile(profile);
    return {
      profile,
      message: "Profile created."
    };
  }
};
