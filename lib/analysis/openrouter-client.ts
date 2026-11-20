// The real ModelClient, over OpenRouter's OpenAI-compatible chat completions endpoint.
//
// It reads no environment and does not import server-only, so the smoke script can build one from
// plain Node. In the app it is built only by lib/server/model.ts, which is server-only and reads
// the key there. The key goes into the Authorization header and nowhere else: it is never logged
// and never appears in an error message.
//
// Request settings are the owner's (build brief, answer 1): the provider is pinned to Fireworks with
// no fallbacks and require_parameters, reasoning effort is low, and every call asks for strict
// json_schema output. The model id comes from the caller (OPENROUTER_MODEL), never from code.

import { MalformedModelOutputError, parseModelJson, type ModelClient, type ModelRequest } from "./model.ts";

export const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

/** How long one model call may take before it is abandoned. */
export const DEFAULT_MODEL_TIMEOUT_MS = 120_000;

export type OpenRouterClientOptions = {
  apiKey: string;
  model: string;
  /** Injected in tests. Defaults to the global fetch. */
  fetch?: typeof fetch;
  timeoutMs?: number;
};

/** The model call failed in transport: network error, timeout, or a non-2xx response. */
export class ModelRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The text content of the first choice, or a MalformedModelOutputError when there is none. */
function messageContent(body: unknown): string {
  if (!isRecord(body) || !Array.isArray(body.choices) || body.choices.length === 0) {
    throw new MalformedModelOutputError("OpenRouter response has no choices");
  }
  const first = body.choices[0];
  const message = isRecord(first) ? first.message : undefined;
  const content = isRecord(message) ? message.content : undefined;
  if (typeof content !== "string") {
    throw new MalformedModelOutputError("OpenRouter response has no message content");
  }
  return content;
}

export class OpenRouterClient implements ModelClient {
  readonly model: string;
  readonly #apiKey: string;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  constructor(options: OpenRouterClientOptions) {
    if (!options.apiKey) throw new Error("OpenRouterClient needs an API key");
    if (!options.model) throw new Error("OpenRouterClient needs a model id");
    this.#apiKey = options.apiKey;
    this.model = options.model;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_MODEL_TIMEOUT_MS;
  }

  async completeJson(request: ModelRequest): Promise<unknown> {
    const body = {
      model: this.model,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: request.schemaName, strict: true, schema: request.jsonSchema },
      },
      provider: { order: ["fireworks"], allow_fallbacks: false, require_parameters: true },
      reasoning: { effort: "low" },
    };

    let response: Response;
    try {
      response = await this.#fetch(OPENROUTER_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        throw new ModelRequestError(`OpenRouter did not answer within ${this.#timeoutMs} ms`);
      }
      const detail = error instanceof Error ? error.message : String(error);
      throw new ModelRequestError(`OpenRouter request failed: ${detail}`);
    }

    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ModelRequestError(`OpenRouter response could not be read: ${detail}`);
    }

    if (!response.ok) {
      // OpenRouter's error bodies carry a message, never the key. Keep it short for logs.
      throw new ModelRequestError(`OpenRouter returned ${response.status}: ${text.slice(0, 300)}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new MalformedModelOutputError("OpenRouter response body is not JSON");
    }
    return parseModelJson(messageContent(parsed));
  }
}
