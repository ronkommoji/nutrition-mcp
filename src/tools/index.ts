import { estimateNutritionTool } from "./estimate_nutrition.js";
import { exportLogsTool } from "./export_logs.js";
import { getDailyStatusTool } from "./get_daily_status.js";
import { getWeeklySummaryTool } from "./get_weekly_summary.js";
import { logFoodTool } from "./log_food.js";
import { searchFoodHistoryTool } from "./search_food_history.js";
import { setupProfileTool } from "./setup_profile.js";
import type { ToolDefinition } from "./tool.js";
import { undoLastLogTool } from "./undo_last_log.js";
import { updateProfileTool } from "./update_profile.js";

export const tools: ToolDefinition[] = [
  setupProfileTool,
  updateProfileTool,
  estimateNutritionTool,
  logFoodTool,
  undoLastLogTool,
  getDailyStatusTool,
  getWeeklySummaryTool,
  searchFoodHistoryTool,
  exportLogsTool
];
