import type { ToolDefinition } from "./tool.js";
import { asRecord, jsonSchema, optionalNumber, optionalString, parseGoalType } from "./common.js";

export const updateProfileTool: ToolDefinition = {
  name: "update_profile",
  description: "Update profile fields such as calorie goal, protein goal, weight, goal type, or timezone.",
  inputSchema: jsonSchema({
    name: { type: "string" },
    weight: { type: "number" },
    weightUnit: { type: "string", enum: ["lb", "kg"] },
    dailyCalorieGoal: { type: "number" },
    dailyProteinGoal: { type: "number" },
    goalType: { type: "string", enum: ["cut", "maintain", "bulk"] },
    timezone: { type: "string" }
  }),
  async handler(rawArgs, { storage }) {
    const existing = await storage.readProfile();
    if (!existing) {
      throw new Error("No profile exists. Call setup_profile first.");
    }

    const args = asRecord(rawArgs);
    const updated = {
      ...existing,
      name: optionalString(args, "name") ?? existing.name,
      weight: {
        value: optionalNumber(args, "weight") ?? existing.weight.value,
        unit: args.weightUnit === "kg" || args.weightUnit === "lb" ? args.weightUnit : existing.weight.unit
      },
      dailyCalorieGoal: optionalNumber(args, "dailyCalorieGoal") ?? existing.dailyCalorieGoal,
      dailyProteinGoal: optionalNumber(args, "dailyProteinGoal") ?? existing.dailyProteinGoal,
      goalType: args.goalType === undefined ? existing.goalType : parseGoalType(args.goalType),
      timezone: optionalString(args, "timezone") ?? existing.timezone,
      updatedAt: new Date().toISOString()
    };

    await storage.writeProfile(updated);
    return {
      profile: updated,
      message: "Profile updated."
    };
  }
};
