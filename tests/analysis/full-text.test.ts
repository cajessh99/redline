// The full-text view (ticket 12) rendered to HTML from a real analysis of the one-sided fixture
// (fake model): each flag's highlight is exactly its source sentence, under its offset-derived id,
// and the link under each flag points at that id. Also the pure click logic and the copy.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FullTextSheet } from "../../app/analysis/full-text.tsx";
import { ReadingDesk } from "../../app/analysis/reading-desk.tsx";
import { citedSources } from "../../app/analysis/result-view.tsx";
import {
  FULL_TEXT_COPY,
  flagOriginId,
  INITIAL_REVEAL,
  isActive,
  jumpTarget,
  questionOriginId,
  receiptOriginId,
  reveal,
  type CitedSource,
} from "../../app/analysis/source-jump.ts";
import { analyse, type Flag } from "../../lib/analysis/analyse.ts";
import { findBannedWord } from "../../lib/copy/banned-words.ts";
import { defaultEnabledRedLines } from "../../lib/red-lines/defaults.ts";
import { analysisPayload, candidateFromSidecar, fakeModel, loadContract, sidecarPayload } from "../support/fake-model.ts";

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

async function analysed(payload: unknown = sidecarPayload(sidecar)) {
  const result = await analyse({ text, party: "Contractor", redLines }, { model: fakeModel(payload) });
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

function renderDesk(flags: Flag[], receipt: Awaited<ReturnType<typeof analysed>>["receipt"] = []) {
  return renderToStaticMarkup(
    createElement(ReadingDesk, {
      storedText: text,
      party: "Contractor",
      flags,
      receipt,
      checkedRedLines: checked,
      questions: null,
    }),
  );
}

/** The text inside the element with this id, tags removed. */
function elementText(html: string, id: string): string | null {
  const match = new RegExp(`<mark id="${id}"[^>]*>([\\s\\S]*?)</mark>`).exec(html);
  return match ? decode(match[1].replace(/<[^>]+>/g, "")) : null;
}

describe("the full-text view", () => {
  it("highlights each of the fixture's 7 flags as exactly its source sentence, linked from the flag", async () => {
    const { flags } = await analysed();
    expect(flags).toHaveLength(7);
    const html = renderDesk(flags);

    for (const flag of flags) {
      const id = jumpTarget({ sentence: flag.sourceSentence, offset: flag.offset });
      expect(id).toBe(`text-${flag.offset}-${flag.offset + flag.sourceSentence.length}`);
      // The highlighted element holds the source sentence and nothing else.
      expect(elementText(html, id)).toBe(flag.sourceSentence);
      expect(text.slice(flag.offset, flag.offset + flag.sourceSentence.length)).toBe(flag.sourceSentence);
      // The flag's link points at that id.
      const origin = flagOriginId(flag.redLineId, flag.offset);
      expect(html).toContain(`<a id="${origin}" href="#${id}">${FULL_TEXT_COPY.jump}</a>`);
    }
    // Each id appears once as an element id.
    const ids = [...html.matchAll(/ id="(text-\d+-\d+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(flags.length);
  });

  it("puts the link under each flag inside that flag's slip", async () => {
    const { flags } = await analysed();
    const html = renderDesk(flags);
    const items = [...html.matchAll(/<li class="flag" data-tier="\w+">([\s\S]*?)<\/li>/g)].map((m) => decode(m[1]));
    expect(items).toHaveLength(flags.length);
    flags.forEach((flag, i) => {
      expect(items[i]).toContain(flag.sourceSentence);
      expect(items[i]).toContain(`href="#${jumpTarget({ sentence: flag.sourceSentence, offset: flag.offset })}"`);
    });
  });

  it("renders the whole stored text, paragraph by paragraph", async () => {
    const { flags } = await analysed();
    const html = renderDesk(flags);
    const body = /<div id="[^"]*-body" class="full-text-body"[^>]*>([\s\S]*?)<\/div><\/div><\/section>/.exec(html)?.[1];
    expect(body).toBeTruthy();
    const paragraphsShown = [...body!.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, "")));
    expect(paragraphsShown).toEqual(text.split("\n\n"));
  });

  it("highlights the receipt's addressing sentences, linked from their receipt lines", async () => {
    const addressing = sidecar.receipt.find((line) => line.addressingSentence)!;
    // Leave out the flags for the receipt line's red line so it appears on the receipt.
    const candidates = sidecar.flags
      .filter((flag) => flag.redLineId !== addressing.redLineId)
      .map((flag) => candidateFromSidecar(flag));
    const result = await analysed(analysisPayload(redLines.map((r) => r.id), candidates, sidecar.receipt));
    const line = result.receipt.find((l) => l.redLineId === addressing.redLineId);
    expect(line?.kind).toBe("addressed");
    if (line?.kind !== "addressed") return;
    const html = renderDesk(result.flags, result.receipt);
    const id = jumpTarget(line);
    expect(elementText(html, id)).toBe(line.sentence);
    expect(html).toContain(`<a id="${receiptOriginId(line.redLineId)}" href="#${id}">`);
  });

  it("marks only the active span, with a link back to where the reader came from", async () => {
    const { flags } = await analysed();
    const sources = citedSources(text, flags, [], checked);
    const target = sources[2];
    const active = { spanId: jumpTarget(target), originId: target.originId, kind: target.kind };
    const html = renderToStaticMarkup(createElement(FullTextSheet, { storedText: text, sources, active, open: true }));

    const activeMarks = [...html.matchAll(/<mark id="([^"]+)"[^>]*data-active=""/g)].map((m) => m[1]);
    expect(activeMarks).toEqual([active.spanId]);
    expect(html).toContain(`<a class="back-link" href="#${target.originId}">${FULL_TEXT_COPY.back.flag}</a>`);
    // The back link follows the active sentence.
    const after = html.slice(html.indexOf(`id="${active.spanId}"`));
    expect(after.indexOf("back-link")).toBeLessThan(after.indexOf("</p>"));
    expect(html).toContain('data-open="true"');
    expect(html).toContain('aria-expanded="true"');
  });

  it("shows a question citation that is also a flag sentence as one highlight", async () => {
    const { flags } = await analysed();
    const flag = flags[0];
    const question: CitedSource = { kind: "question", originId: questionOriginId("q1"), sentence: flag.sourceSentence, offset: flag.offset };
    const sources = [...citedSources(text, flags, [], checked), question];
    const active = { spanId: jumpTarget(question), originId: question.originId, kind: question.kind };
    const html = renderToStaticMarkup(createElement(FullTextSheet, { storedText: text, sources, active, open: false }));
    expect(elementText(html, active.spanId)).toBe(flag.sourceSentence);
    expect(html.match(new RegExp(`id="${active.spanId}"`, "g"))).toHaveLength(1);
    expect(html).toContain(`>${FULL_TEXT_COPY.back.question}</a>`);
    expect(html).toContain('data-open="false"');
    expect(html).toContain(`>${FULL_TEXT_COPY.open}</button>`);
  });

  it("never highlights a source that isn't verbatim at its offset", () => {
    const flag = sidecar.flags[0];
    const offset = text.indexOf(flag.sentence);
    const wrong: CitedSource = { kind: "flag", originId: "x", sentence: flag.sentence, offset: offset + 1 };
    const html = renderToStaticMarkup(createElement(FullTextSheet, { storedText: text, sources: [wrong], active: null, open: true }));
    expect(html).not.toContain("<mark");
  });
});

describe("following a source into the full text", () => {
  const source: CitedSource = { kind: "flag", originId: flagOriginId("non-compete", 120), sentence: "A sentence.", offset: 120 };

  it("targets the offset-derived id of the flag's sentence", () => {
    expect(jumpTarget(source)).toBe("text-120-131");
  });

  it("opens the folded text, makes the source active, and counts each jump", () => {
    const once = reveal(INITIAL_REVEAL, { type: "show", source });
    expect(once).toEqual({ open: true, active: { spanId: "text-120-131", originId: source.originId, kind: "flag" }, jumps: 1 });
    const twice = reveal(once, { type: "show", source });
    expect(twice.jumps).toBe(2);
    expect(isActive(twice.active, source)).toBe(true);
  });

  it("replaces the active span when another source is followed", () => {
    const other: CitedSource = { kind: "question", originId: questionOriginId("q"), sentence: "Other.", offset: 5 };
    const state = reveal(reveal(INITIAL_REVEAL, { type: "show", source }), { type: "show", source: other });
    expect(state.active).toEqual({ spanId: "text-5-11", originId: other.originId, kind: "question" });
    expect(isActive(state.active, source)).toBe(false);
  });

  it("toggles the disclosure without touching the active span", () => {
    const shown = reveal(INITIAL_REVEAL, { type: "show", source });
    const closed = reveal(shown, { type: "toggle" });
    expect(closed).toEqual({ ...shown, open: false });
    expect(reveal(closed, { type: "toggle" }).open).toBe(true);
  });

  it("clears the active span when its source leaves the page, and keeps it otherwise", () => {
    const shown = reveal(INITIAL_REVEAL, { type: "show", source });
    expect(reveal(shown, { type: "forget", known: [source] })).toBe(shown);
    expect(reveal(shown, { type: "forget", known: [] }).active).toBeNull();
    expect(reveal(INITIAL_REVEAL, { type: "forget", known: [] })).toBe(INITIAL_REVEAL);
  });
});

describe("full-text copy", () => {
  it("uses no banned word", () => {
    const lines = [
      FULL_TEXT_COPY.heading,
      FULL_TEXT_COPY.note,
      FULL_TEXT_COPY.open,
      FULL_TEXT_COPY.close,
      FULL_TEXT_COPY.regionLabel,
      FULL_TEXT_COPY.jump,
      ...Object.values(FULL_TEXT_COPY.back),
    ];
    for (const line of lines) expect(findBannedWord(line), line).toBeNull();
  });
});
