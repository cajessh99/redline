// The OpenRouter client against an injected fetch. The fetch is the external boundary (the network);
// the client's request building, timeout and response parsing run for real.
import { describe, expect, it } from "vitest";
import { MalformedModelOutputError, type ModelRequest } from "../../lib/analysis/model.ts";
import {
  ModelRequestError,
  OPENROUTER_CHAT_URL,
  OpenRouterClient,
} from "../../lib/analysis/openrouter-client.ts";

const request: ModelRequest = {
  system: "system prompt",
  user: "user prompt",
  schemaName: "redline_analysis",
  jsonSchema: { type: "object", properties: { redLines: { type: "array" } }, required: ["redLines"] },
};

type Captured = { url: string; init: RequestInit };

function fetchReturning(status: number, body: string, captured: Captured[] = []): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(url), init: init ?? {} });
    return new Response(body, { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

function completion(content: unknown): string {
  return JSON.stringify({ choices: [{ message: { role: "assistant", content } }] });
}

const key = "sk-or-test-not-a-real-key";

describe("OpenRouterClient", () => {
  it("posts the pinned provider, low reasoning, strict json_schema and the configured model", async () => {
    const captured: Captured[] = [];
    const client = new OpenRouterClient({
      apiKey: key,
      model: "vendor/model-from-config",
      fetch: fetchReturning(200, completion('{"redLines":[]}'), captured),
    });

    const result = await client.completeJson(request);

    expect(result).toEqual({ redLines: [] });
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe(OPENROUTER_CHAT_URL);
    expect(captured[0].init.method).toBe("POST");
    const headers = new Headers(captured[0].init.headers);
    expect(headers.get("Authorization")).toBe(`Bearer ${key}`);
    expect(captured[0].init.signal).toBeInstanceOf(AbortSignal);

    const body = JSON.parse(String(captured[0].init.body));
    expect(body.model).toBe("vendor/model-from-config");
    expect(body.messages).toEqual([
      { role: "system", content: "system prompt" },
      { role: "user", content: "user prompt" },
    ]);
    expect(body.provider).toEqual({ order: ["fireworks"], allow_fallbacks: false, require_parameters: true });
    expect(body.reasoning).toEqual({ effort: "low" });
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "redline_analysis", strict: true, schema: request.jsonSchema },
    });
    expect(String(captured[0].init.body)).not.toContain(key);
  });

  it("does not send the request's metadata to the provider", async () => {
    const captured: Captured[] = [];
    const client = new OpenRouterClient({
      apiKey: key,
      model: "m",
      fetch: fetchReturning(200, completion('{"redLines":[]}'), captured),
    });
    await client.completeJson({ ...request, metadata: { party: "Contractor" } });
    const body = JSON.parse(String(captured[0].init.body));
    expect(Object.keys(body).sort()).toEqual(["messages", "model", "provider", "reasoning", "response_format"].sort());
    expect(String(captured[0].init.body)).not.toContain("metadata");
  });

  it("throws a request error on a 500, without the key in the message", async () => {
    const client = new OpenRouterClient({
      apiKey: key,
      model: "m",
      fetch: fetchReturning(500, '{"error":{"message":"upstream down"}}'),
    });
    const error = await client.completeJson(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ModelRequestError);
    expect((error as Error).message).toMatch(/500/);
    expect((error as Error).message).not.toContain(key);
  });

  it("throws a request error when the call times out", async () => {
    const hanging = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      })) as unknown as typeof fetch;
    const client = new OpenRouterClient({ apiKey: key, model: "m", fetch: hanging, timeoutMs: 20 });
    const error = await client.completeJson(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ModelRequestError);
    expect((error as Error).message).toMatch(/did not answer within 20 ms/);
  });

  it("throws a request error when the network fails", async () => {
    const failing = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const client = new OpenRouterClient({ apiKey: key, model: "m", fetch: failing });
    await expect(client.completeJson(request)).rejects.toBeInstanceOf(ModelRequestError);
  });

  it("throws MalformedModelOutputError when the content is not JSON", async () => {
    const client = new OpenRouterClient({
      apiKey: key,
      model: "m",
      fetch: fetchReturning(200, completion("Sure! Here are the flags: {redLines: ...")),
    });
    await expect(client.completeJson(request)).rejects.toBeInstanceOf(MalformedModelOutputError);
  });

  it("throws MalformedModelOutputError when the response has no message content", async () => {
    const client = new OpenRouterClient({
      apiKey: key,
      model: "m",
      fetch: fetchReturning(200, JSON.stringify({ choices: [] })),
    });
    await expect(client.completeJson(request)).rejects.toBeInstanceOf(MalformedModelOutputError);
  });
});
