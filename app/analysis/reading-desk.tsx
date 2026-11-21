"use client";

import { useMemo, type ReactNode } from "react";
import { FullText } from "./full-text.tsx";
import { citedSources, ResultView, type ResultViewProps } from "./result-view.tsx";
import { SourceProvider } from "./source-links.tsx";

/**
 * The result page's desk (ticket 12): the result sheet and the question box, with the full
 * contract beside them on wide screens and folded between them on narrow ones. Every quoted
 * sentence on the page links to its highlight in the full text.
 */
export function ReadingDesk({ questions, ...result }: ResultViewProps & { questions: ReactNode }) {
  const { storedText, flags, receipt, checkedRedLines } = result;
  const sources = useMemo(
    () => citedSources(storedText, flags, receipt, checkedRedLines),
    [storedText, flags, receipt, checkedRedLines],
  );
  return (
    <SourceProvider sources={sources}>
      <div className="reading-desk">
        <div className="check-sheet reading-result">
          <ResultView {...result} />
        </div>
        <FullText storedText={storedText} sources={sources} />
        <div className="check-sheet question-sheet reading-questions">{questions}</div>
      </div>
    </SourceProvider>
  );
}
