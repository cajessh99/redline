// Splitting the stored text into what the full-text view renders (ticket 12, story 27, ADR-0001).
//
// segmentText() cuts the text at every span edge and every paragraph break, and returns the pieces
// in order. Joining every piece's text gives back the stored text exactly, and joining the pieces
// that carry a span's id gives back text.slice(start, end) exactly, so a highlighted sentence is
// the cited sentence and nothing else.
//
// Spans may overlap. A flag and a receipt line never share a sentence by construction, but a
// question citation can be the same sentence as a flag, or part of one. Overlaps are split at
// every edge, so each piece is covered by a fixed set of spans; identical ranges therefore come
// out as one piece carrying every id. The order of ids on a piece is fixed (start, then end, then
// id), so the output does not depend on the order the spans were passed in.
//
// Pure: no DOM, no React. Lives under lib/ so tests and Node can import it directly.

export type Span = { id: string; start: number; end: number };

export type Segment =
  | {
      kind: "text";
      text: string;
      start: number;
      end: number;
      /** The spans covering this piece, in a fixed order. Empty for plain text. */
      ids: string[];
      /** The spans whose first piece this is: where each span's anchor goes. */
      starts: string[];
      /** The spans whose last piece this is. */
      ends: string[];
    }
  | {
      /** A paragraph break (two or more line breaks). Its text is kept so the pieces join back exactly. */
      kind: "break";
      text: string;
      start: number;
      end: number;
      ids: string[];
      starts: string[];
      ends: string[];
    };

export type Paragraph = { start: number; segments: Segment[] };

export class SpanOutOfRangeError extends Error {
  constructor(span: Span, length: number) {
    super(`Span ${span.id} (${span.start} to ${span.end}) is not inside a text of length ${length}.`);
    this.name = "SpanOutOfRangeError";
  }
}

/** The DOM id for the sentence at text.slice(offset, offset + length). Derived from the offset, so the same sentence always has the same id. */
export function spanId(offset: number, length: number): string {
  return `text-${offset}-${offset + length}`;
}

/** A span for a sentence quoted at `offset`, with its offset-derived id. */
export function sentenceSpan(sentence: string, offset: number): Span {
  return { id: spanId(offset, sentence.length), start: offset, end: offset + sentence.length };
}

const BREAK = /\n{2,}/g;

function checkSpan(span: Span, length: number): void {
  const ok =
    Number.isInteger(span.start) &&
    Number.isInteger(span.end) &&
    span.start >= 0 &&
    span.end <= length &&
    span.start < span.end &&
    span.id !== "";
  if (!ok) throw new SpanOutOfRangeError(span, length);
}

function bySpanOrder(a: Span, b: Span): number {
  return a.start - b.start || a.end - b.end || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * The ordered pieces of `text`: plain text, highlighted text and paragraph breaks. Throws
 * SpanOutOfRangeError for a span that is empty, reversed or outside the text. Spans with the same
 * id are treated as one; two different ranges under one id are rejected.
 */
export function segmentText(text: string, spans: readonly Span[]): Segment[] {
  const unique = new Map<string, Span>();
  for (const span of spans) {
    checkSpan(span, text.length);
    const seen = unique.get(span.id);
    if (seen && (seen.start !== span.start || seen.end !== span.end)) {
      throw new Error(`Span id ${span.id} is used for two different ranges.`);
    }
    unique.set(span.id, span);
  }
  const ordered = [...unique.values()].sort(bySpanOrder);

  const breaks: Array<[number, number]> = [];
  for (const match of text.matchAll(BREAK)) breaks.push([match.index, match.index + match[0].length]);

  const edges = new Set<number>([0, text.length]);
  for (const span of ordered) edges.add(span.start).add(span.end);
  for (const [start, end] of breaks) edges.add(start).add(end);
  const cuts = [...edges].sort((a, b) => a - b);

  const segments: Segment[] = [];
  const started = new Set<string>();
  for (let i = 0; i + 1 < cuts.length; i++) {
    const start = cuts[i];
    const end = cuts[i + 1];
    const covering = ordered.filter((span) => span.start <= start && span.end >= end);
    const ids = covering.map((span) => span.id);
    const starts = ids.filter((id) => !started.has(id));
    for (const id of starts) started.add(id);
    const ends = covering.filter((span) => span.end === end).map((span) => span.id);
    const isBreak = breaks.some(([s, e]) => s <= start && e >= end);
    segments.push({ kind: isBreak ? "break" : "text", text: text.slice(start, end), start, end, ids, starts, ends });
  }
  return segments;
}

/** The segments grouped into paragraphs, splitting at each break. Breaks are dropped here; the renderer draws them as paragraph edges. */
export function paragraphs(segments: readonly Segment[]): Paragraph[] {
  const result: Paragraph[] = [{ start: 0, segments: [] }];
  for (const segment of segments) {
    if (segment.kind === "break") {
      result.push({ start: segment.end, segments: [] });
    } else {
      result[result.length - 1].segments.push(segment);
    }
  }
  return result.filter((paragraph) => paragraph.segments.length > 0);
}

/** The text a span's pieces carry, joined. Equals text.slice(start, end) for every span passed to segmentText. */
export function spanText(segments: readonly Segment[], id: string): string {
  return segments
    .filter((segment) => segment.ids.includes(id))
    .map((segment) => segment.text)
    .join("");
}
