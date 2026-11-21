// segmentText (ticket 12): the pieces the full-text view renders. Joined, they give back the stored
// text exactly; each span's pieces give back text.slice(start, end) exactly, so a highlight is the
// cited sentence and nothing else.
import { describe, expect, it } from "vitest";
import {
  paragraphs,
  segmentText,
  sentenceSpan,
  spanId,
  spanText,
  SpanOutOfRangeError,
  type Segment,
  type Span,
} from "../../lib/analysis/segments.ts";
import { loadContract } from "../support/fake-model.ts";

const joined = (segments: Segment[]) => segments.map((s) => s.text).join("");
const marked = (segments: Segment[]) => segments.filter((s) => s.ids.length > 0).map((s) => [s.text, s.ids]);

function expectFaithful(text: string, spans: Span[]) {
  const segments = segmentText(text, spans);
  expect(joined(segments)).toBe(text);
  for (const span of spans) expect(spanText(segments, span.id)).toBe(text.slice(span.start, span.end));
  // Every piece is non-empty and the pieces tile the text in order.
  let at = 0;
  for (const segment of segments) {
    expect(segment.start).toBe(at);
    expect(segment.end).toBeGreaterThan(segment.start);
    at = segment.end;
  }
  expect(at).toBe(text.length);
  return segments;
}

const TEXT = "Alpha one. Beta two. Gamma three.";
const at = (sentence: string, id = sentence) => {
  const start = TEXT.indexOf(sentence);
  return { id, start, end: start + sentence.length };
};

describe("segmentText", () => {
  it("returns the text as one plain piece when there are no spans", () => {
    const segments = expectFaithful(TEXT, []);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ kind: "text", text: TEXT, ids: [] });
  });

  it("returns nothing for empty text", () => {
    expect(segmentText("", [])).toEqual([]);
  });

  it("marks a span at the start", () => {
    const segments = expectFaithful(TEXT, [at("Alpha one.", "a")]);
    expect(marked(segments)).toEqual([["Alpha one.", ["a"]]]);
    expect(segments[0]).toMatchObject({ starts: ["a"], ends: ["a"] });
    expect(segments[1].text).toBe(" Beta two. Gamma three.");
  });

  it("marks a span in the middle", () => {
    const segments = expectFaithful(TEXT, [at("Beta two.", "b")]);
    expect(segments.map((s) => s.text)).toEqual(["Alpha one. ", "Beta two.", " Gamma three."]);
    expect(marked(segments)).toEqual([["Beta two.", ["b"]]]);
  });

  it("marks a span at the end", () => {
    const segments = expectFaithful(TEXT, [at("Gamma three.", "c")]);
    expect(segments.at(-1)).toMatchObject({ text: "Gamma three.", ids: ["c"], starts: ["c"], ends: ["c"] });
  });

  it("keeps adjacent spans as separate pieces", () => {
    const first = { id: "x", start: 0, end: 5 };
    const second = { id: "y", start: 5, end: 10 };
    const segments = expectFaithful(TEXT, [second, first]);
    expect(marked(segments)).toEqual([
      ["Alpha", ["x"]],
      [" one.", ["y"]],
    ]);
  });

  it("merges identical ranges into one piece carrying every id", () => {
    const flag = at("Beta two.", "flag");
    const answer = at("Beta two.", "answer");
    const segments = expectFaithful(TEXT, [flag, answer]);
    expect(marked(segments)).toEqual([["Beta two.", ["answer", "flag"]]]);
    const piece = segments.find((s) => s.ids.length > 0)!;
    expect(piece.starts).toEqual(["answer", "flag"]);
    expect(piece.ends).toEqual(["answer", "flag"]);
  });

  it("treats the same sentence passed twice under one offset-derived id as one span", () => {
    const span = sentenceSpan("Beta two.", TEXT.indexOf("Beta two."));
    const segments = expectFaithful(TEXT, [span, { ...span }]);
    expect(marked(segments)).toEqual([["Beta two.", [span.id]]]);
  });

  it("splits a partial overlap at both edges, the same way whatever order the spans come in", () => {
    const a = { id: "a", start: 6, end: 20 }; // "one. Beta two."
    const b = { id: "b", start: 11, end: 26 }; // "Beta two. Gamma"
    const segments = expectFaithful(TEXT, [a, b]);
    expect(marked(segments)).toEqual([
      ["one. ", ["a"]],
      ["Beta two.", ["a", "b"]],
      [" Gamma", ["b"]],
    ]);
    expect(segmentText(TEXT, [b, a])).toEqual(segments);
    expect(segments.find((s) => s.text === "one. ")!.starts).toEqual(["a"]);
    expect(segments.find((s) => s.text === "Beta two.")).toMatchObject({ starts: ["b"], ends: ["a"] });
  });

  it("splits a nested span inside a longer one", () => {
    const outer = { id: "outer", start: 0, end: TEXT.length };
    const inner = at("Beta two.", "inner");
    const segments = expectFaithful(TEXT, [inner, outer]);
    expect(marked(segments)).toEqual([
      ["Alpha one. ", ["outer"]],
      ["Beta two.", ["outer", "inner"]],
      [" Gamma three.", ["outer"]],
    ]);
  });

  it("gives two spans that start together both an anchor on the first piece", () => {
    const long = { id: "long", start: 0, end: 20 };
    const short = { id: "short", start: 0, end: 10 };
    const segments = expectFaithful(TEXT, [long, short]);
    expect(segments[0]).toMatchObject({ text: "Alpha one.", starts: ["short", "long"], ends: ["short"] });
  });

  it("turns paragraph breaks into break pieces and paragraphs", () => {
    const text = "First paragraph.\n\nSecond one.\n\nThird.";
    const segments = expectFaithful(text, []);
    expect(segments.map((s) => s.kind)).toEqual(["text", "break", "text", "break", "text"]);
    expect(paragraphs(segments).map((p) => p.segments.map((s) => s.text).join(""))).toEqual([
      "First paragraph.",
      "Second one.",
      "Third.",
    ]);
  });

  it("keeps a span across a paragraph break whole, split into a piece on each side", () => {
    const text = "Ends here. Runs on\n\ninto the next. Done.";
    const span = { id: "across", start: text.indexOf("Runs"), end: text.indexOf(" Done") };
    const segments = expectFaithful(text, [span]);
    expect(segments.filter((s) => s.ids.includes("across")).map((s) => [s.kind, s.text])).toEqual([
      ["text", "Runs on"],
      ["break", "\n\n"],
      ["text", "into the next."],
    ]);
    const shown = paragraphs(segments);
    expect(shown).toHaveLength(2);
    expect(shown[0].segments.at(-1)).toMatchObject({ text: "Runs on", starts: ["across"], ends: [] });
    expect(shown[1].segments[0]).toMatchObject({ text: "into the next.", starts: [], ends: ["across"] });
  });

  it("rejects a span outside the text, empty or reversed", () => {
    const bad: Span[] = [
      { id: "past-end", start: 30, end: TEXT.length + 1 },
      { id: "negative", start: -1, end: 4 },
      { id: "empty", start: 4, end: 4 },
      { id: "reversed", start: 8, end: 4 },
      { id: "fraction", start: 1.5, end: 4 },
    ];
    for (const span of bad) expect(() => segmentText(TEXT, [span])).toThrow(SpanOutOfRangeError);
  });

  it("rejects one id used for two different ranges", () => {
    expect(() => segmentText(TEXT, [{ id: "x", start: 0, end: 5 }, { id: "x", start: 6, end: 9 }])).toThrow();
  });

  it("derives span ids from the offset and length", () => {
    expect(spanId(120, 45)).toBe("text-120-165");
    expect(sentenceSpan("Beta two.", 11)).toEqual({ id: "text-11-20", start: 11, end: 20 });
  });

  describe("over the fixtures, with every sidecar sentence as a span", () => {
    for (const name of ["one-sided-services-agreement", "benign-services-agreement"] as const) {
      it(`joins back to the stored text of ${name}, and each span's pieces equal its slice`, () => {
        const { text, sidecar } = loadContract(name);
        const sentences = [
          ...sidecar.flags.map((flag) => flag.sentence),
          ...sidecar.receipt.map((line) => line.addressingSentence),
        ].filter((sentence): sentence is string => typeof sentence === "string" && sentence !== "");
        expect(sentences.length).toBeGreaterThan(0);
        const spans = sentences.map((sentence) => {
          const offset = text.indexOf(sentence);
          expect(offset, sentence).toBeGreaterThanOrEqual(0);
          return sentenceSpan(sentence, offset);
        });
        // Add overlapping spans too: each sentence's first half, and a span across every second
        // pair of neighbouring sentences, so the property is tested on overlaps in real text.
        const extra = spans.flatMap((span, i): Span[] => {
          const half = { id: `half-${i}`, start: span.start, end: span.start + Math.ceil((span.end - span.start) / 2) };
          const next = spans[i + 1];
          return next && i % 2 === 0
            ? [half, { id: `pair-${i}`, start: Math.min(span.start, next.start), end: Math.max(span.end, next.end) }]
            : [half];
        });
        const all = [...spans, ...extra];
        const segments = expectFaithful(text, all);
        for (const span of spans) {
          expect(spanText(segments, span.id)).toBe(text.slice(span.start, span.end));
        }
        // The paragraphs drop only the breaks.
        const kept = paragraphs(segments).flatMap((p) => p.segments.map((s) => s.text)).join("");
        expect(kept).toBe(text.replace(/\n{2,}/g, ""));
      });
    }
  });
});
