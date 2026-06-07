export type GoalType = "cut" | "maintain" | "bulk";

export type Confidence = "high" | "medium" | "low";

export type EstimateMode =
  | "user_provided"
  | "local_usda"
  | "local_branded"
  | "llm_fallback";

export interface UserProfile {
  name?: string;
  weight: {
    value: number;
    unit: "lb" | "kg";
  };
  dailyCalorieGoal: number;
  dailyProteinGoal: number;
  goalType: GoalType;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedFoodItem {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  source: string;
  assumptions?: string[];
}

export interface NutritionEstimate {
  rawText: string;
  calories: number | null;
  protein: number | null;
  confidence: Confidence;
  items: ParsedFoodItem[];
  reasoning: string;
  assumptions: string[];
  sources: string[];
  clarificationQuestions: string[];
  mode: EstimateMode;
  canLogDirectly: boolean;
  requiresConfirmation: boolean;
}

export interface FoodLogEntry {
  id: string;
  timestamp: string;
  date: string;
  rawEntry: string;
  items: ParsedFoodItem[];
  calories: number;
  protein: number;
  confidence: Confidence;
  sources: string[];
  reasoning: string;
  assumptions: string[];
  userConfirmed: boolean;
  mode: EstimateMode;
}

export interface DailyLog {
  date: string;
  entries: FoodLogEntry[];
  totals: {
    calories: number;
    protein: number;
  };
  updatedAt: string;
}

export interface WeeklySummary {
  week: string;
  startDate: string;
  endDate: string;
  averageCalories: number;
  averageProtein: number;
  bestDay: string | null;
  daysTracked: number;
  totalsByDay: Array<{
    date: string;
    calories: number;
    protein: number;
  }>;
  generatedAt: string;
}

export interface Settings {
  createdAt: string;
  updatedAt: string;
  storageVersion: 1;
}
