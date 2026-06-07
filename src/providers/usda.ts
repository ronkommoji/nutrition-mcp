export interface LocalFoodDefinition {
  name: string;
  aliases: string[];
  servingUnit: string;
  calories: number;
  protein: number;
  source: string;
}

export const USDA_FOODS: LocalFoodDefinition[] = [
  {
    name: "large egg",
    aliases: ["egg", "eggs", "large egg", "large eggs"],
    servingUnit: "large egg",
    calories: 70,
    protein: 6,
    source: "USDA fallback table"
  },
  {
    name: "wheat toast",
    aliases: ["toast", "wheat toast", "slice of toast", "bread", "wheat bread"],
    servingUnit: "slice",
    calories: 80,
    protein: 3,
    source: "USDA fallback table"
  },
  {
    name: "cooked white rice",
    aliases: ["rice", "white rice", "cooked rice"],
    servingUnit: "cup cooked",
    calories: 205,
    protein: 4.3,
    source: "USDA fallback table"
  },
  {
    name: "cooked chicken breast",
    aliases: ["chicken", "chicken breast", "grilled chicken", "cooked chicken"],
    servingUnit: "4 oz cooked",
    calories: 185,
    protein: 35,
    source: "USDA fallback table"
  },
  {
    name: "banana",
    aliases: ["banana", "bananas"],
    servingUnit: "medium banana",
    calories: 105,
    protein: 1.3,
    source: "USDA fallback table"
  },
  {
    name: "plain greek yogurt",
    aliases: ["greek yogurt", "plain greek yogurt", "yogurt"],
    servingUnit: "170 g serving",
    calories: 100,
    protein: 17,
    source: "USDA fallback table"
  },
  {
    name: "dry oatmeal",
    aliases: ["oatmeal", "oats"],
    servingUnit: "1/2 cup dry",
    calories: 150,
    protein: 5,
    source: "USDA fallback table"
  },
  {
    name: "peanut butter",
    aliases: ["peanut butter", "pb"],
    servingUnit: "2 tbsp",
    calories: 190,
    protein: 7,
    source: "USDA fallback table"
  },
  {
    name: "avocado",
    aliases: ["avocado", "avocados"],
    servingUnit: "medium avocado",
    calories: 240,
    protein: 3,
    source: "USDA fallback table"
  },
  {
    name: "olive oil",
    aliases: ["olive oil", "oil"],
    servingUnit: "1 tbsp",
    calories: 120,
    protein: 0,
    source: "USDA fallback table"
  }
];

export function findUsdaFoodByAlias(text: string): LocalFoodDefinition[] {
  const normalized = normalize(text);
  return USDA_FOODS.filter((food) =>
    food.aliases.some((alias) => new RegExp(`\\b${escapeRegex(normalize(alias))}\\b`, "i").test(normalized))
  );
}

export function normalize(value: string): string {
  return value.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
