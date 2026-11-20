import "server-only";

// The OpenRouter key and model are read on the server only. Neither is prefixed NEXT_PUBLIC_, and
// this module refuses to load in a client bundle. The model id lives in OPENROUTER_MODEL, never in
// code.

export type OpenRouterConfig = { apiKey: string; model: string };

/** The OpenRouter key and model id, or null when either is missing or empty. */
export function openRouterConfig(): OpenRouterConfig | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim();
  if (!apiKey || !model) return null;
  return { apiKey, model };
}
