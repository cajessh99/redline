import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { supabaseConfig } from "../lib/env.ts";
import { openRouterConfig } from "../lib/server/openrouter-env.ts";

const names = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  for (const n of names) delete process.env[n];
});

afterEach(() => {
  for (const n of names) {
    if (saved[n] === undefined) delete process.env[n];
    else process.env[n] = saved[n];
  }
});

describe("supabaseConfig", () => {
  it("returns null when both variables are missing", () => {
    expect(supabaseConfig()).toBeNull();
  });

  it("returns null when only one variable is set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    expect(supabaseConfig()).toBeNull();

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(supabaseConfig()).toBeNull();
  });

  it("returns null when a variable is empty or blank", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(supabaseConfig()).toBeNull();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "   ";
    expect(supabaseConfig()).toBeNull();
  });

  it("returns the url and anon key when both are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(supabaseConfig()).toEqual({ url: "https://abc.supabase.co", anonKey: "anon-key" });
  });
});

describe("openRouterConfig", () => {
  it("returns null when the key or the model is missing or empty", () => {
    expect(openRouterConfig()).toBeNull();
    process.env.OPENROUTER_API_KEY = "sk-test";
    expect(openRouterConfig()).toBeNull();
    process.env.OPENROUTER_MODEL = "";
    expect(openRouterConfig()).toBeNull();
  });

  it("returns the key and model from the environment when both are set", () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    process.env.OPENROUTER_MODEL = "vendor/some-model";
    expect(openRouterConfig()).toEqual({ apiKey: "sk-test", model: "vendor/some-model" });
  });
});
