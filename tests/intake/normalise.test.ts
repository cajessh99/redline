import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normaliseText } from "../../lib/intake/normalise.ts";

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");

describe("normaliseText", () => {
  it("converts CRLF and CR line endings to LF paragraph breaks", () => {
    expect(normaliseText("One.\r\n\r\nTwo.\r\rThree.")).toBe("One.\n\nTwo.\n\nThree.");
  });

  it("joins the lines of one paragraph with a single space", () => {
    expect(normaliseText("Client shall pay\neach invoice\r\nwithin 30 days.")).toBe(
      "Client shall pay each invoice within 30 days.",
    );
  });

  it("collapses tabs, non-breaking spaces and runs of spaces inside a paragraph", () => {
    expect(normaliseText("Fees\t\tare  due on  delivery .")).toBe("Fees are due on delivery .");
  });

  it("treats any run of blank or whitespace-only lines as one paragraph break", () => {
    expect(normaliseText("First.\n\n\n\nSecond.\n \t \nThird.")).toBe("First.\n\nSecond.\n\nThird.");
  });

  it("trims paragraphs and drops leading and trailing blank lines", () => {
    expect(normaliseText("\n\n   Heading   \n\n  Body text.  \n\n\n")).toBe("Heading\n\nBody text.");
  });

  it("returns an empty string for empty or whitespace-only input", () => {
    expect(normaliseText("")).toBe("");
    expect(normaliseText(" \n\t\r\n  ")).toBe("");
  });

  it("leaves typographic quotes and other characters untouched", () => {
    const text = "“Client” and the Contractor’s ‘Deliverables’ — § 4.";
    expect(normaliseText(text)).toBe(text);
  });

  it("is idempotent", () => {
    const inputs = [
      "A\r\n b \t c\n\n\n  d e \r\r\r f\n",
      fixture("one-sided-services-agreement.txt"),
      fixture("benign-services-agreement.txt"),
    ];
    for (const input of inputs) {
      const once = normaliseText(input);
      expect(normaliseText(once)).toBe(once);
    }
  });
});
