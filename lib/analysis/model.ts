// The model boundary. The analysis module talks to a model only through ModelClient, so tests can
// inject a fake and the OpenRouter implementation (ticket 03) can live in server-only code.

/** A JSON Schema object, passed through to the provider's structured-output option. */
export type JsonSchema = { [key: string]: unknown };

export type ModelRequest = {
  system: string;
  user: string;
  /** Name for the structured-output schema (letters, digits, underscores). */
  schemaName: string;
  /** Strict JSON Schema the response must follow. */
  jsonSchema: JsonSchema;
  /**
   * Structured facts about the request, for tests and logs. Never sent to the provider: real
   * clients ignore it. It lets a fake model answer per party without reading prompt wording.
   */
  metadata?: { party: string };
};

export interface ModelClient {
  /**
   * Sends one request and returns the response parsed as JSON. Throws on transport failure
   * (network, timeout, provider error). Throws MalformedModelOutputError when the response arrived
   * but is not parsable JSON. The returned value is untrusted: callers validate its shape.
   */
  completeJson(request: ModelRequest): Promise<unknown>;
}

/** The model answered, but its output could not be parsed as JSON. */
export class MalformedModelOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MalformedModelOutputError";
  }
}

/** Parses a model's raw text response, throwing MalformedModelOutputError when it is not JSON. */
export function parseModelJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new MalformedModelOutputError(`Model output is not valid JSON: ${detail}`);
  }
}
