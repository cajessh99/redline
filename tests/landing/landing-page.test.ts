import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Landing from "../../app/page.js";
import { metadata } from "../../app/layout.js";
import { clauses, flags, parties } from "../../app/sample.js";
import { findBannedWord } from "../../lib/copy/banned-words.ts";

const html = renderToStaticMarkup(createElement(Landing));

function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Everything a reader sees or hears: element text plus aria-label values, entities decoded. */
function readerText(markup: string): string {
  const labels = [...markup.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
  const text = markup.replace(/<[^>]+>/g, " ");
  return decode([text, ...labels].join(" ")).replace(/\s+/g, " ");
}

const text = readerText(html);

// The sample contract's own clauses (and the source sentences quoted from them) are contract
// wording, not Redline's copy; a real contract says "may" all the time. They are cut out before
// the banned-word scan. Everything Redline says about them (statements, counter-offers, red lines)
// stays in.
const contractWording = [parties, ...clauses.map((c) => c.text), ...flags.map((f) => f.source)].sort(
  (a, b) => b.length - a.length,
);
const redlineCopy = contractWording.reduce((rest, quote) => rest.split(quote).join(" "), text);

describe("landing page", () => {
  it("leads to sign-up and sign-in", () => {
    expect(html).toContain('href="/sign-up"');
    expect(html).toContain('href="/sign-in"');
    expect(html).toMatch(/<a[^>]*href="\/sign-up"[^>]*>Check a contract<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/sign-in"[^>]*>Sign in<\/a>/);
  });

  it("names the four accepted document types", () => {
    for (const type of [
      "Client contracts",
      "Vendor and supplier contracts",
      "Employment offers and non-competes",
      "Leases",
    ]) {
      expect(text).toContain(type);
    }
  });

  it("says scanned documents and terms of service are not accepted", () => {
    expect(text).toContain("Won't read");
    expect(text).toMatch(/Scanned or photographed documents\./);
    expect(text).toMatch(/Terms of service and memberships\./);
  });

  it("says every flag quotes the sentence it came from", () => {
    expect(text).toContain("quotes the sentence word for word");
  });

  it("says it is not legal advice and makes no claim about the law where the reader lives", () => {
    expect(text).toContain("Redline isn't legal advice.");
    expect(text).toContain("It doesn't say what the law allows where you live");
  });

  it("shows each sample flag with its source sentence taken word for word from its clause", () => {
    for (const flag of flags) {
      const clause = clauses.find((c) => c.id === flag.clause);
      expect(clause?.text, flag.key).toContain(flag.source);
      expect(text).toContain(flag.statement);
      expect(text).toContain(flag.counter);
      expect(text).toContain(flag.source);
    }
  });

  it("prints the tier word on every tab", () => {
    const tabs = [...html.matchAll(/<button[^>]*class="tab"[^>]*>(.*?)<\/button>/g)];
    expect(tabs).toHaveLength(flags.length);
    tabs.forEach((tab, i) => expect(tab[1]).toContain(`<span class="tab-word">${flags[i].tier}</span>`));
  });

  it("uses no banned word in Redline's own copy", () => {
    // The scan still covers every statement and counter-offer after the contract wording is cut.
    for (const flag of flags) {
      expect(redlineCopy).toContain(flag.statement);
      expect(redlineCopy).toContain(flag.counter);
    }
    expect(findBannedWord(redlineCopy)).toBeNull();
    expect(findBannedWord(`${metadata.title} ${metadata.description}`)).toBeNull();
  });

  it("shows no prices, counts, testimonials, or accuracy figures", () => {
    expect(text).not.toMatch(/[$€£]\s?\d/);
    expect(text).not.toMatch(/\d\s?%/);
    expect(text).not.toMatch(/\b(pric(e|ing)|per month|testimonial|customers|accura(te|cy))\b/i);
    expect(text).not.toMatch(/\b\d[\d,]*\+?\s+(users|freelancers|contracts checked|people)\b/i);
  });

  it("loads no analytics or tracking script", () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/analytics|gtag|googletagmanager|plausible|segment/i);
  });
});
