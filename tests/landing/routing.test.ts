import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { routeRequest } from "../../lib/routing.ts";
import { updateSession } from "../../lib/supabase/session.ts";

describe("routeRequest", () => {
  it("serves the landing page to a visitor at the root", () => {
    expect(routeRequest("/", false)).toEqual({ kind: "continue" });
  });

  it("sends a signed-in reader at the root to the library", () => {
    expect(routeRequest("/", true)).toEqual({ kind: "redirect", to: "/library" });
  });

  it("sends a visitor at an account page to sign-in", () => {
    for (const path of ["/library", "/library/x", "/red-lines", "/red-lines/edit", "/documents/abc"]) {
      expect(routeRequest(path, false), path).toEqual({ kind: "redirect", to: "/sign-in" });
    }
  });

  it("serves account pages to a signed-in reader", () => {
    for (const path of ["/library", "/red-lines", "/documents/abc"]) {
      expect(routeRequest(path, true), path).toEqual({ kind: "continue" });
    }
  });

  it("serves open pages to everyone", () => {
    for (const path of ["/sign-in", "/sign-up", "/check", "/documents"]) {
      expect(routeRequest(path, false), path).toEqual({ kind: "continue" });
      expect(routeRequest(path, true), path).toEqual({ kind: "continue" });
    }
  });
});

// The proxy's own entry point, run for real with Supabase unconfigured: everyone is a visitor.
describe("updateSession with Supabase unconfigured", () => {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
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

  it("lets a request for the root through to the landing page", async () => {
    const response = await updateSession(new NextRequest("http://localhost/"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects a request for the library to sign-in", async () => {
    const response = await updateSession(new NextRequest("http://localhost/library?x=1"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/sign-in");
  });
});
