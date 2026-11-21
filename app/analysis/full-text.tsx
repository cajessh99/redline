"use client";

import { useId, useMemo, type ReactNode } from "react";
import { paragraphs, segmentText, type Segment } from "../../lib/analysis/segments.ts";
import { isVerbatimAt } from "../../lib/analysis/stored.ts";
import { useReading } from "./source-links.tsx";
import { FULL_TEXT_COPY, sourceSpan, type Active, type CitedSource } from "./source-jump.ts";

type SheetProps = {
  storedText: string;
  /** Every sentence quoted on the page: flags, receipt lines and answers. */
  sources: CitedSource[];
  active: Active | null;
  /** Whether the text is shown where it sits behind a disclosure (narrow screens). */
  open: boolean;
  onToggle?: () => void;
  onBack?: () => void;
};

function Piece({ segment, active, back }: { segment: Segment; active: Active | null; back: ReactNode }) {
  if (segment.ids.length === 0) return <>{segment.text}</>;
  const isActive = active !== null && segment.ids.includes(active.spanId);
  const [anchor, ...extraAnchors] = segment.starts;
  return (
    <>
      <mark
        id={anchor}
        data-spans={segment.ids.join(" ")}
        data-active={isActive ? "" : undefined}
        tabIndex={anchor ? -1 : undefined}
      >
        {/* A span that starts where another one does gets an empty anchor of its own, so its link still lands here. */}
        {extraAnchors.map((id) => (
          <span key={id} id={id} className="text-anchor" />
        ))}
        {segment.text}
      </mark>
      {active !== null && segment.ends.includes(active.spanId) ? back : null}
    </>
  );
}

/**
 * The stored text as a printed sheet, with every quoted sentence highlighted and addressable by
 * its offset-derived id (ticket 12). The active sentence carries a toner ring and underline as
 * well as the highlighter, so it doesn't rely on colour, and a link back to where the reader came
 * from follows it. Without hooks, so it renders the same on the server and in tests.
 */
export function FullTextSheet({ storedText, sources: given, active, open, onToggle, onBack, idBase = "full-text" }: SheetProps & { idBase?: string }) {
  // Every source was checked before it reached the page; checking again here means a sentence
  // that isn't verbatim at its offset is never highlighted (ADR-0001).
  const sources = given.filter((source) => isVerbatimAt(storedText, source.sentence, source.offset));
  const spans = sources.map(sourceSpan);
  const shown = paragraphs(segmentText(storedText, spans));
  const activeSource = active ? sources.find((s) => s.originId === active.originId) : undefined;
  const back =
    active && activeSource ? (
      <>
        {" "}
        <a
          className="back-link"
          href={`#${active.originId}`}
          onClick={(event) => {
            if (!onBack) return;
            event.preventDefault();
            onBack();
          }}
        >
          {FULL_TEXT_COPY.back[active.kind]}
        </a>
      </>
    ) : null;
  const ids = { heading: `${idBase}-heading`, body: `${idBase}-body` };

  return (
    <section className="full-text" data-open={open ? "true" : "false"} data-has-active={active ? "" : undefined} aria-labelledby={ids.heading}>
      <div className="sheet full-text-sheet">
        <div className="full-text-head">
          <h2 id={ids.heading} className="full-text-heading">
            {FULL_TEXT_COPY.heading}
          </h2>
          <p className="full-text-note">{FULL_TEXT_COPY.note}</p>
          <button
            type="button"
            className="quiet-button full-text-toggle"
            aria-expanded={open}
            aria-controls={ids.body}
            onClick={onToggle}
          >
            {open ? FULL_TEXT_COPY.close : FULL_TEXT_COPY.open}
          </button>
        </div>
        <div id={ids.body} className="full-text-body" tabIndex={0} role="region" aria-label={FULL_TEXT_COPY.regionLabel}>
          {shown.map((paragraph) => (
            <p key={paragraph.start}>
              {paragraph.segments.map((segment) => (
                <Piece key={segment.start} segment={segment} active={active} back={back} />
              ))}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The full-text sheet on the result page, wired to the links under each quoted sentence. */
export function FullText({ storedText, sources }: { storedText: string; sources: CitedSource[] }) {
  const reading = useReading();
  const idBase = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const all = useMemo(() => [...sources, ...(reading?.questionSources ?? [])], [sources, reading?.questionSources]);
  return (
    <FullTextSheet
      storedText={storedText}
      sources={all}
      active={reading?.state.active ?? null}
      open={reading?.state.open ?? false}
      onToggle={reading?.toggle}
      onBack={reading?.back}
      idBase={`full-text${idBase}`}
    />
  );
}
