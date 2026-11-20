// The result view rendered to HTML from a real analysis of the fixture (fake model), and the copy
// the check flow shows. Asserts what a reader sees: every flag's red line, tier word, statement and
// verbatim source; nothing unverified; both fixed statements; no banned word in Redline's own copy.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResultView, LEGAL_STATEMENT, PROOF_STATEMENT } from "../../app/analysis/result-view.tsx";
import { CheckFlow } from "../../app/check/check-flow.tsx";
import { analyse, type Flag } from "../../lib/analysis/analyse.ts";
import { RUN_ERROR_MESSAGES } from "../../lib/analysis/run.ts";
import { parseCheckedRedLines, parseStoredFlags } from "../../lib/analysis/stored.ts";
import { findBannedWord } from "../../lib/copy/banned-words.ts";
import { INTAKE_REFUSAL_MESSAGES } from "../../lib/intake/text-file.ts";
import { defaultEnabledRedLines } from "../../lib/red-lines/defaults.ts";
import { fakeModel, loadContract, sidecarPayload } from "../support/fake-model.ts";

const { text, sidecar } = loadContract("one-sided-services-agreement");
const redLines = defaultEnabledRedLines();
const checked = redLines.map(({ id, title }) => ({ id, title }));

function decode(markup: string): string {
  return markup
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function readerText(markup: string): string {
  const labels = [...markup.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
  return decode([markup.replace(/<[^>]+>/g, " "), ...labels].join(" ")).replace(/\s+/g, " ");
}

/** Redline's own words: the reader text with quoted contract wording and the fixed statement cut out. */
function redlineCopy(markup: string, quoted: string[]): string {
  return [...quoted, PROOF_STATEMENT]
    .sort((a, b) => b.length - a.length)
    .reduce((rest, quote) => rest.split(quote).join(" "), readerText(markup));
}

async function analysedFlags(): Promise<Flag[]> {
  const result = await analyse({ text, party: "Contractor", redLines }, { model: fakeModel(sidecarPayload(sidecar)) });
  if (!result.ok) throw new Error(result.error.message);
  return result.flags;
}

function render(flags: Flag[]) {
  return renderToStaticMarkup(
    createElement(ResultView, { storedText: text, party: "Contractor", flags, checkedRedLines: checked }),
  );
}

describe("ResultView", () => {
  it("shows every flag's red line, tier word, statement and verbatim source sentence, in order", async () => {
    const flags = await analysedFlags();
    const html = render(flags);
    const seen = readerText(html);

    const items = [...html.matchAll(/<li class="flag" data-tier="(\w+)">([\s\S]*?)<\/li>/g)];
    expect(items).toHaveLength(flags.length);
    items.forEach((item, i) => {
      const flag = flags[i];
      const body = decode(item[2]);
      expect(item[1]).toBe(flag.tier.toLowerCase());
      expect(body).toContain(`<span class="stamp">${flag.tier}</span>`);
      expect(body).toContain(flag.redLineTitle);
      expect(body).toContain(flag.statement);
      expect(body).toContain(`<p>${flag.sourceSentence}</p>`);
      expect(text.slice(flag.offset, flag.offset + flag.sourceSentence.length)).toBe(flag.sourceSentence);
    });
    expect(seen).toContain("7 flags");
    expect(seen).not.toMatch(/\b\d+(\.\d+)?%/);
  });

  it("does not render a flag whose source sentence is not verbatim in the stored text", async () => {
    const [first, ...rest] = await analysedFlags();
    const misquoted = { ...first, sourceSentence: first.sourceSentence.replace("Client", "the Client") };
    const shifted = { ...rest[0], offset: rest[0].offset + 1 };
    const html = render([misquoted, shifted, ...rest.slice(1)]);
    expect(decode(html)).not.toContain(misquoted.sourceSentence);
    expect(decode(html)).not.toContain(shifted.statement);
    expect([...html.matchAll(/<li class="flag"/g)]).toHaveLength(rest.length - 1);
  });

  it("carries both fixed statements word for word", () => {
    const seen = readerText(render([]));
    expect(seen).toContain(
      "Redline shows only what it can prove. A receipt means no red line matched, not that the document is safe.",
    );
    expect(seen).toContain(LEGAL_STATEMENT);
    expect(LEGAL_STATEMENT).toMatch(/isn't legal advice/);
    expect(LEGAL_STATEMENT).toMatch(/law allows where you live/);
  });

  it("lists every red line that was checked, with its flag count", async () => {
    const seen = readerText(render(await analysedFlags()));
    for (const redLine of checked) expect(seen).toContain(redLine.title);
    const list = seen.slice(seen.indexOf("Red lines checked"));
    expect(list).toContain("Payment that depends on the client's discretion or on a third party paying first 2 flags");
    expect(list).toContain("Uncapped indemnity or unlimited liability on me 1 flag");
    expect(list).toContain("Termination without notice, or without pay for work already done No flag");
  });

  it("says plainly when no flag survived, with no banned word", () => {
    const html = render([]);
    expect(readerText(html)).toContain("No flags");
    expect(readerText(html)).toContain("None of the red lines below matched a sentence in this document.");
    expect(findBannedWord(redlineCopy(html, []))).toBeNull();
  });

  it("uses no banned word in its own copy when showing flags", async () => {
    const flags = await analysedFlags();
    const html = render(flags);
    expect(findBannedWord(redlineCopy(html, flags.map((f) => f.sourceSentence)))).toBeNull();
  });
});

describe("stored analyses read back", () => {
  it("round-trip through JSON and keep only flags verbatim at their offset", async () => {
    const flags = await analysedFlags();
    const stored = JSON.parse(JSON.stringify([...flags, { ...flags[0], offset: 3 }, { tier: "High" }]));
    expect(parseStoredFlags(stored, text)).toEqual(flags);
    expect(parseStoredFlags(null, text)).toEqual([]);
  });

  it("read the checked red lines from the snapshot", () => {
    const snapshot = JSON.parse(JSON.stringify(redLines));
    expect(parseCheckedRedLines(snapshot)).toEqual(checked);
  });
});

describe("check flow copy", () => {
  it("uses no banned word in the intake screen, refusals or errors", () => {
    const intake = readerText(renderToStaticMarkup(createElement(CheckFlow, { accountsOpen: true })));
    expect(intake).toContain("Check a contract");
    for (const copy of [intake, ...Object.values(INTAKE_REFUSAL_MESSAGES), ...Object.values(RUN_ERROR_MESSAGES)]) {
      expect(findBannedWord(copy), copy).toBeNull();
    }
  });
});
