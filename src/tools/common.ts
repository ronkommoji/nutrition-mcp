import type { Confidence, EstimateMode, GoalType, ParsedFoodItem } from "../types.js";

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function requiredString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required string argument: ${key}`);
  }
  return value.trim();
}

export function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function requiredNumber(args: Record<string, unknown>, key: string): number {
  const value = args[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Missing required number argument: ${key}`);
  }
  return value;
}

export function optionalNumber(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function optionalBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  return typeof value === "boolean" ? value : undefined;
}

export function parseGoalType(value: unknown): GoalType {
  if (value === "cut" || value === "maintain" || value === "bulk") {
    return value;
  }
  throw new Error("goalType must be one of: cut, maintain, bulk");
}

export function parseConfidence(value: unknown, fallback: Confidence): Confidence {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return fallback;
}

export function parseMode(value: unknown, fallback: EstimateMode): EstimateMode {
  if (value === "user_provided" || value === "local_usda" || value === "local_branded" || value === "llm_fallback") {
    return value;
  }
  return fallback;
}

export function optionalStringArray(args: Record<string, unknown>, key: string): string[] | undefined {
  const value = args[key];
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim());
}

export function optionalItems(args: Record<string, unknown>, key: string): ParsedFoodItem[] | undefined {
  const value = args[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }
    const record = item as Record<string, unknown>;
    if (
      typeof record.name !== "string" ||
      typeof record.quantity !== "number" ||
      typeof record.unit !== "string" ||
      typeof record.calories !== "number" ||
      typeof record.protein !== "number" ||
      typeof record.source !== "string"
    ) {
      return [];
    }
    return [
      {
        name: record.name,
        quantity: record.quantity,
        unit: record.unit,
        calories: record.calories,
        protein: record.protein,
        source: record.source,
        assumptions: Array.isArray(record.assumptions)
          ? record.assumptions.filter((assumption): assumption is string => typeof assumption === "string")
          : undefined
      }
    ];
  });

  return items.length > 0 ? items : undefined;
}

export function todayForTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const getPart = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

export function assertDateKey(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Date must use YYYY-MM-DD format");
  }
  return date;
}

export function jsonSchema(properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false
  };
}

export function roundProtein(value: number): number {
  return Math.round(value * 10) / 10;
}
