export type GoalType = "cut" | "maintain" | "bulk";

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

export interface FoodLogEntry {
  id: string;
  timestamp: string;
  date: string;
  rawEntry: string;
  calories: number;
  protein: number;
  userConfirmed: boolean;
  notes?: string;
  source?: string;
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
