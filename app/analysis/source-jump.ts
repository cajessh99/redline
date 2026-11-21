// What happens when a reader follows a quoted sentence into the full contract (ticket 12). Pure:
// the ids each source and its link use, and the reveal state. The DOM work (scroll and focus)
// lives in source-links.tsx and acts on what this decides.

import { sentenceSpan, type Span } from "../../lib/analysis/segments.ts";

export type SourceKind = "flag" | "receipt" | "question";

/** Every line the full-text view and its links show. Run through the humanizer skill; checked for banned words in tests. */
export const FULL_TEXT_COPY = {
  heading: "The full contract",
  note: "Redline highlights every sentence it quotes.",
  open: "Read the full contract",
  close: "Hide the full contract",
  regionLabel: "Full contract text",
  jump: "Find it in the contract",
  back: {
    flag: "Back to the flag",
    receipt: "Back to the red line",
    question: "Back to your question",
  },
} as const satisfies { back: Record<SourceKind, string> } & Record<string, unknown>;

/** A quoted sentence shown on the result page, and the link that leads from it into the full text. */
export type CitedSource = {
  kind: SourceKind;
  /** The DOM id of the link beside the quote. "Back to the flag" returns here. */
  originId: string;
  sentence: string;
  /** Where the sentence sits in the stored text. Already checked verbatim there before it is shown. */
  offset: number;
};

export function flagOriginId(redLineId: string, offset: number): string {
  return `source-flag-${redLineId}-${offset}`;
}

export function receiptOriginId(redLineId: string): string {
  return `source-receipt-${redLineId}`;
}

export function questionOriginId(key: string): string {
  return `source-question-${key}`;
}

/** The span a source highlights: offset-derived, so the same sentence always gets the same id. */
export function sourceSpan(source: Pick<CitedSource, "sentence" | "offset">): Span {
  return sentenceSpan(source.sentence, source.offset);
}

/** The DOM id the link from a source points at. */
export function jumpTarget(source: Pick<CitedSource, "sentence" | "offset">): string {
  return sourceSpan(source).id;
}

export type Active = { spanId: string; originId: string; kind: SourceKind };

export type RevealState = {
  /** Whether the full text is shown where it sits behind a disclosure (narrow screens). */
  open: boolean;
  /** The one span shown as the active highlight, and where the reader came from. */
  active: Active | null;
  /** Counts jumps, so following the same source twice still scrolls and focuses again. */
  jumps: number;
};

export type RevealAction =
  | { type: "show"; source: CitedSource }
  | { type: "toggle" }
  | { type: "forget"; known: readonly CitedSource[] };

export const INITIAL_REVEAL: RevealState = { open: false, active: null, jumps: 0 };

export function reveal(state: RevealState, action: RevealAction): RevealState {
  switch (action.type) {
    case "show":
      return {
        open: true,
        active: { spanId: jumpTarget(action.source), originId: action.source.originId, kind: action.source.kind },
        jumps: state.jumps + 1,
      };
    case "toggle":
      return { ...state, open: !state.open };
    case "forget":
      // After a new result replaces the old one, an active highlight whose source is no longer on
      // the page is cleared, so "Back to the flag" never points at a flag that has gone.
      return state.active && !action.known.some((source) => isActive(state.active, source))
        ? { ...state, active: null }
        : state;
  }
}

/** True when `source` is the one the active highlight came from. */
export function isActive(active: Active | null, source: CitedSource): boolean {
  return active !== null && active.originId === source.originId && active.spanId === jumpTarget(source);
}
