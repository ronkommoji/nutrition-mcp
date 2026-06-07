export function geminiGroundingConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function groundingSourceLabel(): string {
  return geminiGroundingConfigured() ? "Gemini grounding configured" : "Gemini grounding unavailable";
}
