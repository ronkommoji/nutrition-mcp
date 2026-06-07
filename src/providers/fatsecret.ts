import { escapeRegex, normalize } from "./usda.js";

export interface LocalBrandedFood {
  name: string;
  brand: string;
  aliases: string[];
  servingUnit: string;
  calories: number;
  protein: number;
  source: string;
}

export const LOCAL_BRANDED_FOODS: LocalBrandedFood[] = [
  {
    name: "McChicken",
    brand: "McDonald's",
    aliases: ["mcchicken", "mcdonalds mcchicken", "mcdonald's mcchicken"],
    servingUnit: "sandwich",
    calories: 400,
    protein: 14,
    source: "Local branded fallback catalog"
  }
];

export function fatSecretConfigured(): boolean {
  return Boolean(process.env.FATSECRET_CLIENT_ID && process.env.FATSECRET_CLIENT_SECRET);
}

export function findLocalBrandedFood(text: string): LocalBrandedFood | null {
  const normalized = normalize(text);
  return (
    LOCAL_BRANDED_FOODS.find((food) =>
      food.aliases.some((alias) => new RegExp(`\\b${escapeRegex(normalize(alias))}s?\\b`, "i").test(normalized))
    ) ?? null
  );
}
