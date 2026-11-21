"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { FULL_TEXT_COPY, INITIAL_REVEAL, jumpTarget, reveal, type CitedSource, type RevealState } from "./source-jump.ts";

type Reading = {
  state: RevealState;
  show: (source: CitedSource) => void;
  toggle: () => void;
  back: () => void;
  /** Sentences quoted by answers in the question box, which it reports as they change. */
  questionSources: CitedSource[];
  setQuestionSources: (sources: CitedSource[]) => void;
};

const ReadingContext = createContext<Reading | null>(null);

/** The reveal state, or null outside a SourceProvider (links then work as plain links). */
export function useReading(): Reading | null {
  return useContext(ReadingContext);
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function bringIntoView(element: HTMLElement): void {
  element.focus({ preventScroll: true });
  element.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
}

/**
 * Holds which sentence is the active highlight in the full text, and does the scrolling and
 * focusing once React has shown it. `sources` are the flags' and receipt lines' sentences.
 */
export function SourceProvider({ sources, children }: { sources: CitedSource[]; children: ReactNode }) {
  const [state, dispatch] = useReducer(reveal, INITIAL_REVEAL);
  const [questionSources, setQuestionSources] = useState<CitedSource[]>([]);
  const lastJump = useRef(0);

  // A rerun can replace the flags; a highlight whose source left the page is cleared.
  useEffect(() => {
    dispatch({ type: "forget", known: [...sources, ...questionSources] });
  }, [sources, questionSources]);

  useEffect(() => {
    if (state.jumps === lastJump.current || !state.active) return;
    lastJump.current = state.jumps;
    const target = document.querySelector<HTMLElement>(`[data-spans~="${CSS.escape(state.active.spanId)}"]`);
    if (target) bringIntoView(target);
  }, [state]);

  const show = useCallback((source: CitedSource) => dispatch({ type: "show", source }), []);
  const toggle = useCallback(() => dispatch({ type: "toggle" }), []);
  const back = useCallback(() => {
    const originId = state.active?.originId;
    const origin = originId ? document.getElementById(originId) : null;
    if (origin) bringIntoView(origin);
  }, [state.active]);

  const value = useMemo(
    () => ({ state, show, toggle, back, questionSources, setQuestionSources }),
    [state, show, toggle, back, questionSources],
  );
  return <ReadingContext.Provider value={value}>{children}</ReadingContext.Provider>;
}

/**
 * The link under a quoted sentence that shows it in the full contract. A real link to the
 * sentence's offset-derived id, so it works before scripts load; with scripts it also opens the
 * full text where it is folded away, marks the sentence and moves focus to it.
 */
export function SourceLink({ source }: { source: CitedSource }) {
  const reading = useReading();
  const follow = (event: MouseEvent<HTMLAnchorElement> | KeyboardEvent<HTMLAnchorElement>) => {
    if (!reading) return;
    event.preventDefault();
    reading.show(source);
  };
  return (
    <p className="source-jump">
      <a
        id={source.originId}
        href={`#${jumpTarget(source)}`}
        onClick={follow}
        onKeyDown={(event) => {
          // Links answer Enter natively; Space is added so the link acts like the button it resembles.
          if (event.key === " ") follow(event);
        }}
      >
        {FULL_TEXT_COPY.jump}
      </a>
    </p>
  );
}

/** Lets the question box tell the full text which sentences its answers quote. */
export function useReportQuestionSources(sources: CitedSource[]): void {
  const setQuestionSources = useReading()?.setQuestionSources;
  const key = sources.map((s) => `${s.originId}:${s.offset}:${s.sentence.length}`).join("|");
  const latest = useRef(sources);
  latest.current = sources;
  useEffect(() => {
    setQuestionSources?.(latest.current);
  }, [key, setQuestionSources]);
}
