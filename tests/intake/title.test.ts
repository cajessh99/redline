// suggestTitle and checkTitle (story 5): the title suggested from the stored text, and the rules a
// reader's own title is checked against. Pure functions over real text.
import { describe, expect, it } from "vitest";
import { normaliseText } from "../../lib/intake/normalise.ts";
import {
  checkTitle,
  MAX_SUGGESTED_TITLE_CHARS,
  MAX_TITLE_CHARS,
  partyNamesOf,
  suggestTitle,
  UNTITLED,
} from "../../lib/intake/title.ts";
import { loadContract } from "../support/fake-model.ts";

describe("suggestTitle", () => {
  it("takes the one-sided fixture's heading, out of capitals, with both parties' names", () => {
    const { text } = loadContract("one-sided-services-agreement");
    expect(suggestTitle(text)).toBe(
      "Independent Contractor Services Agreement: Quillmont Analytics LLC and Rowan Tellisford",
    );
  });

  it("tells the two fixtures apart although they share a heading", () => {
    const { text } = loadContract("benign-services-agreement");
    expect(suggestTitle(text)).toBe("Independent Contractor Services Agreement: Tallowfield Studio LLC and Dana Orlecki");
  });

  it("uses a short heading that is not in capitals as it is", () => {
    expect(suggestTitle("Lease Agreement\n\nThis lease is made on 1 May 2026.")).toBe("Lease Agreement");
  });

  it("finds a capitalised heading that intake joined to the paragraph below it", () => {
    const text = normaliseText("SERVICES AGREEMENT\nThis Agreement is made on 1 May 2026 between the parties named below.");
    expect(text.startsWith("SERVICES AGREEMENT This Agreement")).toBe(true);
    expect(suggestTitle(text)).toBe("Services Agreement");
  });

  it("does not take the capitalised opening of a sentence for a heading", () => {
    const text = "THIS AGREEMENT is made on 1 May 2026 by the landlord and the tenant for the flat at 4 Elm Row.";
    const title = suggestTitle(text);
    expect(title).not.toBe("This Agreement");
    expect(title.startsWith("THIS AGREEMENT is made")).toBe(true);
  });

  it("keeps acronyms and lower-cases small words when it tidies capitals", () => {
    expect(suggestTitle("MUTUAL NDA FOR THE SUPPLY OF GOODS\n\nBody text.")).toBe("Mutual NDA for the Supply of Goods");
    expect(suggestTitle("NON-COMPETE AGREEMENT\n\nBody text.")).toBe("Non-Compete Agreement");
  });

  it("drops the names when heading and names together are too long, keeping the heading", () => {
    const heading = "MASTER SERVICES AND DATA PROCESSING AGREEMENT FOR CONSULTING ENGAGEMENTS";
    const text = `${heading}\n\nThis Agreement is made by and between Northbridge Consolidated Holdings Limited, a company ("Company"), and Alexandra Wilhelmina Featherstonehaugh, an individual ("Consultant").`;
    const title = suggestTitle(text);
    expect(title).toBe("Master Services and Data Processing Agreement for Consulting Engagements");
    expect(title.length).toBeLessThanOrEqual(MAX_SUGGESTED_TITLE_CHARS);
  });

  it("uses the parties' names when there is no heading", () => {
    const text = 'This agreement is made between Brightwater Ltd, a company ("Client"), and Sam Okafor, of Leeds ("Contractor"). The work starts in June.';
    expect(suggestTitle(text)).toBe("Brightwater Ltd and Sam Okafor");
  });

  it("cuts a long opening sentence at a word boundary when nothing better exists", () => {
    const text = `${"The contractor agrees to deliver the work described in the schedule ".repeat(4)}by the end of June.`;
    const title = suggestTitle(text);
    expect(title.length).toBeLessThanOrEqual(MAX_SUGGESTED_TITLE_CHARS);
    expect(title.endsWith("…")).toBe(true);
    expect(text.startsWith(title.slice(0, -1))).toBe(true);
    expect(title.slice(0, -1).endsWith(" ")).toBe(false);
  });

  it("is never empty and never over the limit", () => {
    expect(suggestTitle("")).toBe(UNTITLED);
    expect(suggestTitle("   \n\n  ")).toBe(UNTITLED);
    expect(suggestTitle("1.2.3 4 5")).toBe(UNTITLED);
    for (const text of ["x".repeat(500), `${"WORD ".repeat(60)}`, "Short."]) {
      const title = suggestTitle(text);
      expect(title.length).toBeGreaterThan(0);
      expect(title.length).toBeLessThanOrEqual(MAX_SUGGESTED_TITLE_CHARS);
    }
  });

  it("always passes the title check, so a suggestion can be stored as it is", () => {
    const { text } = loadContract("one-sided-services-agreement");
    for (const sample of [text, "", "Lease Agreement", "x".repeat(500)]) {
      expect(checkTitle(suggestTitle(sample))).toEqual({ ok: true, title: suggestTitle(sample) });
    }
  });
});

describe("partyNamesOf", () => {
  it("returns null when the opening does not name two sides", () => {
    expect(partyNamesOf("This lease is for the flat at 4 Elm Row.")).toBeNull();
    expect(partyNamesOf("Made between the parties, as follows.")).toBeNull();
  });
});

describe("checkTitle", () => {
  it("trims the ends and joins runs of whitespace", () => {
    expect(checkTitle("  Quillmont \n  contract\t2026 ")).toEqual({ ok: true, title: "Quillmont contract 2026" });
  });

  it("refuses an empty or blank title", () => {
    expect(checkTitle("")).toEqual({ ok: false, code: "missing_title" });
    expect(checkTitle(" \n\t ")).toEqual({ ok: false, code: "missing_title" });
  });

  it("accepts the limit and refuses one character over, without cutting", () => {
    expect(checkTitle("a".repeat(MAX_TITLE_CHARS))).toEqual({ ok: true, title: "a".repeat(MAX_TITLE_CHARS) });
    expect(checkTitle("a".repeat(MAX_TITLE_CHARS + 1))).toEqual({ ok: false, code: "title_too_long" });
  });

  it("refuses anything that is not text", () => {
    for (const value of [null, undefined, 3, {}, ["a"]]) {
      expect(checkTitle(value)).toEqual({ ok: false, code: "bad_request" });
    }
  });
});
