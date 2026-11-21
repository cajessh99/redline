import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import Landing from "../../app/page.js";
import LandingAnalytics from "../../app/landing-analytics.tsx";
import { landingPageViewsOnly } from "../../lib/analytics.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));

/** Every element in a tree of already-built React elements, without rendering anything. */
function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const props = node.props as { children?: ReactNode };
  return [node, ...elements(props.children)];
}

/** Source files under a directory, as repo-relative paths with forward slashes. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(name) ? [relative(root, path).split(sep).join("/")] : [];
  });
}

/** Files that import (or require, or dynamically import) the given module specifier pattern. */
function importers(files: string[], specifier: RegExp): string[] {
  return files.filter((file) => {
    const code = readFileSync(join(root, file), "utf8");
    const imports = [
      ...code.matchAll(/\bfrom\s+["']([^"']+)["']/g),
      ...code.matchAll(/\bimport\s+["']([^"']+)["']/g),
      ...code.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g),
    ].map((m) => m[1]);
    return imports.some((s) => specifier.test(s));
  });
}

describe("analytics filter", () => {
  const view = (url: string) => ({ type: "pageview" as const, url });

  it("keeps a page view of the landing page", () => {
    expect(landingPageViewsOnly(view("https://redline.example/"))).toEqual(view("https://redline.example/"));
  });

  it("drops page views of every other page", () => {
    for (const path of ["/check", "/documents/abc", "/library", "/red-lines", "/sign-in", "/sign-up"]) {
      expect(landingPageViewsOnly(view(`https://redline.example${path}`)), path).toBeNull();
    }
  });

  it("strips the query string and hash from a landing page view", () => {
    expect(landingPageViewsOnly(view("https://redline.example/?x=1#y"))).toEqual(
      view("https://redline.example/"),
    );
  });

  it("drops custom events, even on the landing page", () => {
    expect(landingPageViewsOnly({ type: "event", url: "https://redline.example/" })).toBeNull();
  });

  it("drops a URL it cannot parse", () => {
    expect(landingPageViewsOnly(view("not a url"))).toBeNull();
  });
});

describe("analytics placement", () => {
  it("the landing page renders Vercel's analytics through the filter", () => {
    const onPage = elements(Landing()).filter((el) => el.type === LandingAnalytics);
    expect(onPage).toHaveLength(1);

    const rendered = LandingAnalytics();
    expect(rendered.type).toBe(Analytics);
    expect((rendered.props as { beforeSend?: unknown }).beforeSend).toBe(landingPageViewsOnly);
  });

  it("no other file in the product imports Vercel's analytics or the landing page's analytics component", () => {
    const product = [
      ...sourceFiles(join(root, "app")),
      ...sourceFiles(join(root, "lib")),
      ...["proxy.ts"].filter((f) => {
        try {
          return statSync(join(root, f)).isFile();
        } catch {
          return false;
        }
      }),
    ];
    expect(product).toContain("app/page.js");
    expect(product).toContain("app/layout.js");

    // Only the landing page's own analytics component touches the package...
    expect(importers(product, /^@vercel\/analytics(\/|$)/)).toEqual(["app/landing-analytics.tsx"]);
    // ...and only the landing page renders that component. The root layout, /check, /sign-in,
    // /sign-up, /library, /red-lines and /documents/* do not.
    expect(importers(product, /(^|\/)landing-analytics(\.tsx)?$/)).toEqual(["app/page.js"]);
  });
});
