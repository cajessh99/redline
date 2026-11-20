import "server-only";
import { OpenRouterClient } from "../analysis/openrouter-client.ts";
import { openRouterConfig } from "./openrouter-env.ts";

/** The real model client built from server env, or null when the key or model is not set. */
export function serverModelClient(): OpenRouterClient | null {
  const config = openRouterConfig();
  if (!config) return null;
  return new OpenRouterClient({ apiKey: config.apiKey, model: config.model });
}
