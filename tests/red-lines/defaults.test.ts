import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RED_LINE_IDS,
  OFFERED_RED_LINE_IDS,
  PRODUCT_RED_LINES,
  TIERS,
  defaultEnabledRedLines,
} from "../../lib/red-lines/defaults.ts";

// PRD.md wraps lines, so compare against its text with every whitespace run collapsed.
const prd = readFileSync(new URL("../../PRD.md", import.meta.url), "utf8").replace(/\s+/g, " ");
const section5 = prd.slice(prd.indexOf("## 5. My red lines"), prd.indexOf("## 6."));

describe("product red lines", () => {
  it("has the eleven fixed ids, five on by default and six offered and off", () => {
    expect(PRODUCT_RED_LINES.map((r) => r.id)).toEqual([...DEFAULT_RED_LINE_IDS, ...OFFERED_RED_LINE_IDS]);
    expect(defaultEnabledRedLines().map((r) => r.id)).toEqual([...DEFAULT_RED_LINE_IDS]);
    for (const redLine of PRODUCT_RED_LINES) {
      const isDefault = (DEFAULT_RED_LINE_IDS as readonly string[]).includes(redLine.id);
      expect(redLine.kind).toBe(isDefault ? "default" : "offered");
      expect(redLine.enabledByDefault).toBe(isDefault);
    }
  });

  it("gives each default all three tiers, and their sentences appear verbatim in PRD.md section 5", () => {
    for (const redLine of defaultEnabledRedLines()) {
      expect(Object.keys(redLine.tiers)).toEqual([...TIERS]);
      for (const tier of TIERS) {
        const sentence = redLine.tiers[tier] as string;
        expect(sentence.startsWith(`${tier} when `)).toBe(true);
        expect(section5).toContain(sentence);
      }
      expect(section5).toContain(`. ${redLine.description}**`);
      expect(redLine.description).toBe(`${redLine.title}.`);
    }
  });

  it("takes every offered item's title, description and tier text from PRD.md section 5", () => {
    for (const redLine of PRODUCT_RED_LINES.filter((r) => r.kind === "offered")) {
      expect(section5).toContain(`**${redLine.title}.**`);
      expect(section5).toContain(redLine.description);
      const tiers = Object.entries(redLine.tiers);
      expect(tiers.length).toBeGreaterThan(0);
      for (const [, text] of tiers) expect(section5).toContain(text);
    }
  });
});
