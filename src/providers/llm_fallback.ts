import type { Confidence, NutritionEstimate, ParsedFoodItem } from "../types.js";
import { findLocalBrandedFood } from "./fatsecret.js";
import type { LocalFoodDefinition } from "./usda.js";
import { escapeRegex, findUsdaFoodByAlias, normalize } from "./usda.js";

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10
};

const RESTAURANT_HINTS = [
  "mcdonald",
  "burger king",
  "wendy",
  "taco bell",
  "kfc",
  "subway",
  "panera",
  "starbucks",
  "chipotle",
  "chick-fil-a",
  "in-n-out"
];

export function estimateNutritionFromText(rawText: string): NutritionEstimate {
  const query = normalize(rawText);
  const userMacros = parseUserProvidedMacros(query);

  if (userMacros) {
    return finalizeEstimate({
      rawText,
      calories: userMacros.calories,
      protein: userMacros.protein,
      confidence: "high",
      items: [
        {
          name: "user-provided food entry",
          quantity: 1,
          unit: "entry",
          calories: userMacros.calories,
          protein: userMacros.protein,
          source: "User provided nutrition values"
        }
      ],
      reasoning: "Used the calorie and protein values supplied by the user.",
      assumptions: [],
      sources: ["User provided nutrition values"],
      clarificationQuestions: [],
      mode: "user_provided"
    });
  }

  const branded = estimateBrandedFood(rawText);
  if (branded) {
    return branded;
  }

  const chipotle = estimateChipotleBowl(rawText);
  if (chipotle) {
    return chipotle;
  }

  if (looksLikeUnknownRestaurant(query)) {
    return finalizeEstimate({
      rawText,
      calories: null,
      protein: null,
      confidence: "low",
      items: [],
      reasoning: "The entry appears to reference a restaurant or branded food, but no exact local nutrition match was available.",
      assumptions: [],
      sources: ["LLM Estimation Mode"],
      clarificationQuestions: [
        "What was the exact restaurant item name?",
        "Do you have calories or protein from the menu or label?"
      ],
      mode: "llm_fallback"
    });
  }

  const staples = estimateUsdaStaples(rawText);
  if (staples.items.length > 0) {
    return staples;
  }

  return finalizeEstimate({
    rawText,
    calories: null,
    protein: null,
    confidence: "low",
    items: [],
    reasoning: "There was not enough food or serving-size detail to make a defensible estimate.",
    assumptions: [],
    sources: ["LLM Estimation Mode"],
    clarificationQuestions: [
      "What foods were included?",
      "About how much did you eat?"
    ],
    mode: "llm_fallback"
  });
}

function parseUserProvidedMacros(query: string): { calories: number; protein: number } | null {
  const caloriesMatch =
    query.match(/\b(\d{2,5}(?:\.\d+)?)\s*(?:calories|calorie|cals|cal|kcal)\b/i) ??
    query.match(/\bcalories?\s*:?\s*(\d{2,5}(?:\.\d+)?)/i);

  const proteinMatch =
    query.match(/\b(\d{1,4}(?:\.\d+)?)\s*(?:g|gram|grams)?\s*(?:of\s*)?protein\b/i) ??
    query.match(/\bprotein\s*:?\s*(\d{1,4}(?:\.\d+)?)/i);

  if (!caloriesMatch || !proteinMatch) {
    return null;
  }

  return {
    calories: Math.round(Number(caloriesMatch[1])),
    protein: roundProtein(Number(proteinMatch[1]))
  };
}

function estimateBrandedFood(rawText: string): NutritionEstimate | null {
  const food = findLocalBrandedFood(rawText);
  if (!food) {
    return null;
  }

  const scale = quantityNearAliases(rawText, food.aliases, 1) * partialScale(rawText);
  const item = {
    name: `${food.brand} ${food.name}`,
    quantity: scale,
    unit: food.servingUnit,
    calories: roundCalories(food.calories * scale),
    protein: roundProtein(food.protein * scale),
    source: food.source,
    assumptions: scale === 1 ? [] : [`Scaled full serving by ${formatPercent(scale)}.`]
  };

  return finalizeEstimate({
    rawText,
    calories: item.calories,
    protein: item.protein,
    confidence: "high",
    items: [item],
    reasoning:
      scale === 1
        ? `Matched ${food.brand} ${food.name} in the local branded fallback catalog.`
        : `Matched ${food.brand} ${food.name} and scaled the full serving by ${formatPercent(scale)}.`,
    assumptions: item.assumptions ?? [],
    sources: [food.source],
    clarificationQuestions: [],
    mode: "local_branded"
  });
}

function estimateChipotleBowl(rawText: string): NutritionEstimate | null {
  const query = normalize(rawText);
  if (!query.includes("chipotle") || !query.includes("bowl")) {
    return null;
  }

  const items: ParsedFoodItem[] = [];
  const assumptions: string[] = [];

  if (!query.includes("no rice")) {
    items.push(component("Chipotle rice", 1, "serving", 210, 4, "Restaurant component assumptions"));
    assumptions.push("Assumed one serving of rice.");
  }

  if (!query.includes("no beans")) {
    items.push(component("Chipotle beans", 1, "serving", 130, 8, "Restaurant component assumptions"));
    assumptions.push("Assumed one serving of beans.");
  }

  if (query.includes("double chicken")) {
    items.push(component("Chipotle chicken", 2, "servings", 360, 64, "Restaurant component assumptions"));
  } else if (query.includes("chicken")) {
    items.push(component("Chipotle chicken", 1, "serving", 180, 32, "Restaurant component assumptions"));
  } else {
    assumptions.push("Protein choice was not clear.");
  }

  if (query.includes("fajita")) {
    items.push(component("Chipotle fajita vegetables", 1, "serving", 20, 1, "Restaurant component assumptions"));
  }
  if (query.includes("cheese")) {
    items.push(component("Chipotle cheese", 1, "serving", 110, 6, "Restaurant component assumptions"));
  }
  if (query.includes("sour cream")) {
    items.push(component("Chipotle sour cream", 1, "serving", 110, 2, "Restaurant component assumptions"));
  }
  if (query.includes("guac") || query.includes("guacamole")) {
    items.push(component("Chipotle guacamole", 1, "serving", 230, 2, "Restaurant component assumptions"));
  }
  if (query.includes("salsa")) {
    items.push(component("Chipotle salsa", 1, "serving", 25, 1, "Restaurant component assumptions"));
  }

  if (!query.includes("cheese") && !query.includes("sour cream") && !query.includes("guac")) {
    assumptions.push("No cheese, sour cream, or guacamole was included unless mentioned.");
  }

  const totals = totalItems(items);
  return finalizeEstimate({
    rawText,
    calories: totals.calories,
    protein: totals.protein,
    confidence: "medium",
    items,
    reasoning: "Estimated a Chipotle bowl from common component portions because exact toppings were not fully specified.",
    assumptions,
    sources: ["LLM Estimation Mode", "Restaurant component assumptions"],
    clarificationQuestions: [
      "Which rice, beans, salsa, and toppings were included?",
      "Was the bowl portion standard or larger than usual?"
    ],
    mode: "llm_fallback"
  });
}

function estimateUsdaStaples(rawText: string): NutritionEstimate {
  const foods = findUsdaFoodByAlias(rawText);
  const items: ParsedFoodItem[] = [];
  const assumptions: string[] = [];
  let allQuantitiesExplicit = true;

  for (const food of foods) {
    const quantity = inferQuantity(rawText, food);
    if (!quantity.explicit) {
      allQuantitiesExplicit = false;
      assumptions.push(`Assumed ${quantity.value} ${food.servingUnit} of ${food.name}.`);
    }
    items.push({
      name: food.name,
      quantity: quantity.value,
      unit: food.servingUnit,
      calories: roundCalories(food.calories * quantity.value),
      protein: roundProtein(food.protein * quantity.value),
      source: food.source,
      assumptions: quantity.explicit ? [] : [`Default serving: ${food.servingUnit}.`]
    });
  }

  const totals = totalItems(items);
  const confidence: Confidence = allQuantitiesExplicit ? "high" : "medium";

  return finalizeEstimate({
    rawText,
    calories: totals.calories,
    protein: totals.protein,
    confidence,
    items,
    reasoning:
      confidence === "high"
        ? "Used local USDA-style values with clear serving quantities from the entry."
        : "Used local USDA-style values and standard serving assumptions for missing quantities.",
    assumptions,
    sources: unique(items.map((item) => item.source)),
    clarificationQuestions:
      confidence === "high"
        ? []
        : ["Were the assumed serving sizes accurate enough to log?"],
    mode: "local_usda"
  });
}

function inferQuantity(rawText: string, food: LocalFoodDefinition): { value: number; explicit: boolean } {
  const query = normalize(rawText);
  const aliasPattern = food.aliases.map((alias) => escapeRegex(normalize(alias))).join("|");

  const ounceMatch = query.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(?:oz|ounce|ounces)\\s+(?:of\\s+)?(?:${aliasPattern})\\b`));
  if (ounceMatch && food.servingUnit.includes("4 oz")) {
    return { value: Number(ounceMatch[1]) / 4, explicit: true };
  }

  const cupMatch = query.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(?:cup|cups)\\s+(?:of\\s+)?(?:${aliasPattern})\\b`));
  if (cupMatch && food.servingUnit.includes("cup")) {
    return { value: Number(cupMatch[1]), explicit: true };
  }

  const sliceMatch = query.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(?:slice|slices|piece|pieces)\\s+(?:of\\s+)?(?:${aliasPattern})\\b`));
  if (sliceMatch && food.servingUnit === "slice") {
    return { value: Number(sliceMatch[1]), explicit: true };
  }

  const numericMatch = query.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s+(?:large\\s+|medium\\s+|small\\s+)?(?:${aliasPattern})\\b`));
  if (numericMatch) {
    return { value: Number(numericMatch[1]), explicit: true };
  }

  const wordMatch = query.match(new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")})\\s+(?:large\\s+|medium\\s+|small\\s+)?(?:${aliasPattern})\\b`));
  if (wordMatch) {
    return { value: NUMBER_WORDS[wordMatch[1]] ?? 1, explicit: true };
  }

  return { value: partialScale(rawText), explicit: partialScale(rawText) !== 1 };
}

function quantityNearAliases(rawText: string, aliases: string[], defaultValue: number): number {
  const query = normalize(rawText);
  const aliasPattern = aliases.map((alias) => escapeRegex(normalize(alias))).join("|");
  const numericMatch = query.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s+(?:${aliasPattern})s?\\b`));
  if (numericMatch) {
    return Number(numericMatch[1]);
  }
  const wordMatch = query.match(new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")})\\s+(?:${aliasPattern})s?\\b`));
  if (wordMatch) {
    return NUMBER_WORDS[wordMatch[1]] ?? defaultValue;
  }
  return defaultValue;
}

function partialScale(rawText: string): number {
  const query = normalize(rawText);
  if (/\b(half|1\/2)\b/.test(query)) {
    return 0.5;
  }
  if (/\b(quarter|1\/4)\b/.test(query)) {
    return 0.25;
  }
  if (/\bthree quarters\b/.test(query)) {
    return 0.75;
  }
  return 1;
}

function looksLikeUnknownRestaurant(query: string): boolean {
  return RESTAURANT_HINTS.some((hint) => query.includes(hint)) || /\bfrom\s+[a-z][a-z'-]+/.test(query);
}

function component(
  name: string,
  quantity: number,
  unit: string,
  calories: number,
  protein: number,
  source: string
): ParsedFoodItem {
  return {
    name,
    quantity,
    unit,
    calories,
    protein,
    source
  };
}

function totalItems(items: ParsedFoodItem[]): { calories: number; protein: number } {
  return items.reduce(
    (total, item) => ({
      calories: roundCalories(total.calories + item.calories),
      protein: roundProtein(total.protein + item.protein)
    }),
    { calories: 0, protein: 0 }
  );
}

function finalizeEstimate(input: Omit<NutritionEstimate, "canLogDirectly" | "requiresConfirmation">): NutritionEstimate {
  return {
    ...input,
    calories: input.calories === null ? null : roundCalories(input.calories),
    protein: input.protein === null ? null : roundProtein(input.protein),
    sources: unique(input.sources),
    assumptions: unique(input.assumptions),
    canLogDirectly: input.confidence === "high" && input.calories !== null && input.protein !== null,
    requiresConfirmation: input.confidence !== "high"
  };
}

function roundCalories(value: number): number {
  return Math.round(value / 5) * 5;
}

function roundProtein(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
