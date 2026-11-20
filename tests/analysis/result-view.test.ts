// The result view rendered to HTML from a real analysis of the fixture (fake model), and the copy
// the check flow shows. Asserts what a reader sees: every flag's red line, tier word, statement and
// verbatim source; nothing unverified; both fixed statements; no banned word in Redline's own copy.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DOES_NOT_MENTION,
  LEGAL_STATEMENT,
  PROOF_STATEMENT,
  COUNTER_OFFER_HINT,
  RESULT_UNAVAILABLE,
  ResultView,
} from "../../app/analysis/result-view.tsx";
import { COPIED_MESSAGE, COPY_FAILED_MESSAGE, COPY_LABEL } from "../../app/analysis/copy-button.tsx";
import { CheckFlow } from "../../app/check/check-flow.tsx";
import { analyse, type Flag, type ReceiptLine } from "../../lib/analysis/analyse.ts";
import { RUN_ERROR_MESSAGES } from "../../lib/analysis/run.ts";
import { parseCheckedRedLines, parseStoredFlags, parseStoredReceipt } from "../../lib/analysis/stored.ts";
import { findBannedWord } from "../../lib/copy/banned-words.ts";
import { INTAKE_REFUSAL_MESSAGES } from "../../lib/intake/text-file.ts";
import { defaultEnabledRedLines } from "../../lib/red-lines/defaults.ts";
import { analysisPayload, fakeModel, loadContract, sidecarPayload } from "../support/fake-model.ts";

const { text, sidecar } = loadContract("one-sided-services-agreement");
const benign = loadContract("benign-services-agreement");
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

async function analysed(storedText = text, payload: unknown = sidecarPayload(sidecar)) {
  const result = await analyse({ text: storedText, party: "Contractor", redLines }, { model: fakeModel(payload) });
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

async function analysedFlags(): Promise<Flag[]> {
  return (await analysed()).flags;
}

function render(flags: Flag[], receipt: ReceiptLine[] = [], storedText = text) {
  return renderToStaticMarkup(
    createElement(ResultView, { storedText, party: "Contractor", flags, receipt, checkedRedLines: checked }),
  );
}

/** The receipt rows as rendered: [kind, inner html]. */
function receiptRows(html: string): Array<[string, string]> {
  return [...html.matchAll(/<li class="receipt-line" data-kind="(\w+)">([\s\S]*?)<\/li>/g)].map((m) => [m[1], m[2]]);
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

  it("shows every flag's counter-offer verbatim from the sidecar, after its source, with a labelled copy button", async () => {
    const flags = await analysedFlags();
    const html = render(flags);
    const items = [...html.matchAll(/<li class="flag" data-tier="\w+">([\s\S]*?)<\/li>/g)].map((m) => decode(m[1]));
    expect(items).toHaveLength(sidecar.flags.length);
    expect(readerText(html)).toContain(COUNTER_OFFER_HINT);

    for (const planted of sidecar.flags) {
      const body = items.find((item) => item.includes(`<p>${planted.sentence}</p>`));
      expect(body, planted.sentence).toBeDefined();
      const counter = body!.match(/<p class="flag-counter" id="([^"]+)">([\s\S]*?)<\/p>/);
      expect(counter?.[2]).toBe(planted.counterOffer);
      expect(body!.indexOf("Counter-offer</p>")).toBeGreaterThan(body!.indexOf(planted.sentence));
      // A real button with a text label, and a polite live region for the outcome.
      expect(body).toMatch(new RegExp(`<button type="button" class="copy-button">${COPY_LABEL}<span class="visually-hidden">`));
      expect(body).toContain('role="status" aria-live="polite"');
    }
    // Each counter-offer has its own id, so a failed copy can select the right one.
    const ids = [...html.matchAll(/class="flag-counter" id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(flags.length);
  });

  it("does not render a flag that has no counter-offer; its red line shows as unavailable", async () => {
    const { flags, receipt } = await analysed();
    // A red line with one flag, so dropping it leaves the red line with no shown flag.
    const first = flags.find((f) => flags.filter((g) => g.redLineId === f.redLineId).length === 1)!;
    const rest = flags.filter((f) => f !== first);
    const html = render([{ ...first, counterOffer: "  " }, ...rest], receipt);
    expect([...html.matchAll(/<li class="flag"/g)]).toHaveLength(rest.length);
    expect(decode(html)).not.toContain(first.statement);
    const rows = receiptRows(html);
    const row = rows.find(([, body]) => decode(body).includes(first.redLineTitle));
    expect(row?.[0]).toBe("unavailable");
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

  it("shows the receipt alongside the flags: every checked red line appears, the unflagged one with its sentence", async () => {
    const { flags, receipt } = await analysed();
    const html = render(flags, receipt);
    const seen = readerText(html);
    for (const redLine of checked) expect(seen).toContain(redLine.title);
    expect(seen).toContain("Red lines with no flag");
    expect(seen).not.toContain("Red lines checked");

    const rows = receiptRows(html);
    expect(rows).toHaveLength(1);
    const [kind, body] = rows[0];
    expect(kind).toBe("addressed");
    expect(decode(body)).toContain("Termination without notice, or without pay for work already done");
    expect(decode(body)).toContain('<span class="stamp stamp-plain">No flag</span>');
    const line = receipt[0];
    if (line.kind !== "addressed") throw new Error("expected an addressed line");
    expect(decode(body)).toContain(`<blockquote class="receipt-source"><p>${line.sentence}</p></blockquote>`);
    // The receipt comes after the flags.
    expect(html.indexOf('class="receipt-list"')).toBeGreaterThan(html.lastIndexOf('<li class="flag"'));
  });

  it("shows a document with no flags as a full receipt, one row per red line, never an empty page", async () => {
    const { flags, receipt } = await analysed(benign.text, sidecarPayload(benign.sidecar));
    expect(flags).toEqual([]);
    const html = render(flags, receipt, benign.text);
    const seen = readerText(html);
    expect(seen).toContain("No flags");
    expect(seen).toContain("Checked against your 5 red lines. None of them matched a sentence in this document.");
    const rows = receiptRows(html);
    expect(rows.map(([kind]) => kind)).toEqual(["addressed", "addressed", "addressed", "addressed", "addressed"]);
    rows.forEach(([, body], i) => {
      expect(decode(body)).toContain(checked[i].title);
      const sentence = benign.sidecar.receipt.find((r) => r.redLineId === checked[i].id)!.addressingSentence;
      expect(decode(body)).toContain(`<p>${sentence}</p>`);
    });
  });

  it("says the document does not mention a red line, word for word", async () => {
    const { flags, receipt } = await analysed(benign.text, analysisPayload(redLines.map((r) => r.id), [], []));
    expect(receipt.every((line) => line.kind === "not_mentioned")).toBe(true);
    const html = render(flags, receipt, benign.text);
    const rows = receiptRows(html);
    expect(rows).toHaveLength(5);
    for (const [kind, body] of rows) {
      expect(kind).toBe("not_mentioned");
      expect(decode(body)).toContain(`<p class="receipt-note">${DOES_NOT_MENTION}</p>`);
    }
    expect(DOES_NOT_MENTION).toBe("The document does not mention this.");
    expect(readerText(html)).toContain("The document does not mention this");
  });

  it("never renders a receipt sentence that is not verbatim at its offset, and never calls it not mentioned", async () => {
    const { flags, receipt } = await analysed();
    const line = receipt[0];
    if (line.kind !== "addressed") throw new Error("expected an addressed line");
    const html = render(flags, [{ ...line, offset: line.offset + 1 }]);
    const rows = receiptRows(html);
    expect(rows).toEqual([[expect.any(String), expect.any(String)]]);
    expect(rows[0][0]).toBe("unavailable");
    expect(decode(rows[0][1])).toContain(RESULT_UNAVAILABLE);
    expect(decode(rows[0][1])).not.toContain(line.sentence);
    expect(decode(rows[0][1])).not.toContain(DOES_NOT_MENTION);
    expect(decode(html)).not.toContain(line.sentence);
  });

  it("uses no banned word in its own copy, apart from the fixed statement, with flags and with a full receipt", async () => {
    const withFlags = await analysed();
    const benignResult = await analysed(benign.text, sidecarPayload(benign.sidecar));
    const silent = await analysed(benign.text, analysisPayload(redLines.map((r) => r.id), [], []));
    const quoted = (r: typeof withFlags) => [
      ...r.flags.map((f) => f.sourceSentence),
      // Counter-offers are contract drafting, exempt from the banned-word check (BUILD-REPORT.md B10).
      ...r.flags.map((f) => f.counterOffer),
      ...r.receipt.flatMap((l) => (l.kind === "addressed" ? [l.sentence] : [])),
    ];
    const cases: Array<[typeof withFlags, string]> = [
      [withFlags, text],
      [benignResult, benign.text],
      [silent, benign.text],
    ];
    for (const [result, storedText] of cases) {
      const html = render(result.flags, result.receipt, storedText);
      expect(readerText(html)).toContain(PROOF_STATEMENT);
      const own = redlineCopy(html, quoted(result));
      expect(findBannedWord(own), own).toBeNull();
      expect(own).not.toMatch(/\bno issues\b/i);
    }
    for (const copy of [DOES_NOT_MENTION, RESULT_UNAVAILABLE, COUNTER_OFFER_HINT, COPY_LABEL, COPIED_MESSAGE, COPY_FAILED_MESSAGE]) {
      expect(findBannedWord(copy), copy).toBeNull();
    }
  });
});

describe("stored analyses read back", () => {
  it("round-trip through JSON and keep only flags verbatim at their offset", async () => {
    const flags = await analysedFlags();
    const stored = JSON.parse(JSON.stringify([...flags, { ...flags[0], offset: 3 }, { tier: "High" }]));
    expect(parseStoredFlags(stored, text)).toEqual(flags);
    expect(parseStoredFlags(null, text)).toEqual([]);
  });

  it("keep every counter-offer through the round trip, so a reopened document shows the same ones", async () => {
    const flags = await analysedFlags();
    const reopened = parseStoredFlags(JSON.parse(JSON.stringify(flags)), text);
    expect(reopened.map((f) => f.counterOffer)).toEqual(flags.map((f) => f.counterOffer));
    expect(reopened.map((f) => f.counterOffer).sort()).toEqual(sidecar.flags.map((f) => f.counterOffer).sort());
    const counters = (html: string) => [...html.matchAll(/<p class="flag-counter" id="[^"]+">([\s\S]*?)<\/p>/g)].map((m) => m[1]);
    expect(counters(render(reopened))).toEqual(counters(render(flags)));
  });

  it("drop a stored flag whose counter-offer is missing, empty or not a string, as malformed", async () => {
    const flags = await analysedFlags();
    const [a, b, c, ...rest] = JSON.parse(JSON.stringify(flags));
    delete a.counterOffer;
    b.counterOffer = " ";
    c.counterOffer = 7;
    const read = parseStoredFlags([a, b, c, ...rest], text);
    expect(read).toEqual(flags.slice(3));
  });

  it("round-trip the receipt through JSON unchanged", async () => {
    for (const [storedText, payload] of [
      [text, sidecarPayload(sidecar)],
      [benign.text, sidecarPayload(benign.sidecar)],
      [benign.text, analysisPayload(redLines.map((r) => r.id), [], [])],
    ] as const) {
      const { receipt } = await analysed(storedText, payload);
      expect(receipt.length).toBeGreaterThan(0);
      expect(parseStoredReceipt(JSON.parse(JSON.stringify(receipt)), storedText)).toEqual(receipt);
    }
  });

  it("drop a stored receipt sentence that no longer verifies, and anything of the wrong shape", async () => {
    const { receipt } = await analysed(benign.text, sidecarPayload(benign.sidecar));
    const [first, second, ...rest] = receipt;
    if (first.kind !== "addressed" || second.kind !== "addressed") throw new Error("expected addressed lines");
    const stored = JSON.parse(
      JSON.stringify([
        { ...first, offset: first.offset + 1 },
        { ...second, sentence: second.sentence.replace("total liability", "whole liability") },
        ...rest,
        { redLineId: "x", redLineTitle: "X", kind: "addressed", sentence: "", offset: 0 },
        { redLineId: "y", redLineTitle: "Y", kind: "mentioned" },
        { redLineId: "z", kind: "not_mentioned" },
        "not a line",
      ]),
    );
    const read = parseStoredReceipt(stored, benign.text);
    expect(read).toEqual(rest);
    expect(JSON.stringify(read)).not.toContain(first.sentence);
    expect(parseStoredReceipt(null, benign.text)).toEqual([]);
    expect(parseStoredReceipt({}, benign.text)).toEqual([]);

    // On screen the corrupted red lines are still listed, as unavailable, never as not mentioned.
    const html = render([], read, benign.text);
    const rows = receiptRows(html);
    expect(rows.map(([kind]) => kind)).toEqual(["unavailable", "unavailable", "addressed", "addressed", "addressed"]);
    expect(decode(html)).not.toContain(first.sentence);
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
