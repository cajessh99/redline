import type { Flag } from "../../lib/analysis/analyse.ts";
import type { CheckedRedLine } from "../../lib/analysis/run.ts";
import { isVerbatimAt } from "../../lib/analysis/stored.ts";

/** The fixed statement from the spec (story 54). Word for word; the one use of a banned word. */
export const PROOF_STATEMENT =
  "Redline shows only what it can prove. A receipt means no red line matched, not that the document is safe.";

/** The not-legal-advice line (story 55), worded as on the landing page. */
export const LEGAL_STATEMENT =
  "Redline isn't legal advice. It reports what your contract says. It doesn't say what the law allows where you live, or whether you should sign.";

type Props = {
  /** The stored text the flags were checked against. Every flag is checked against it again here. */
  storedText: string;
  party: string;
  flags: Flag[];
  checkedRedLines: CheckedRedLine[];
};

function flagCount(n: number): string {
  return n === 1 ? "1 flag" : `${n} flags`;
}

/**
 * The result of one analysis: flags ranked Severe, Moderate, Minor, each with its red line, tier
 * word, plain statement and verified source sentence; then the red lines that were checked; then
 * the two fixed statements. A flag whose source is not verbatim in the stored text at its offset is
 * not rendered (ADR-0001). Counter-offers arrive in ticket 05 and the receipt in ticket 04.
 */
export function ResultView({ storedText, party, flags, checkedRedLines }: Props) {
  const shown = flags.filter((flag) => isVerbatimAt(storedText, flag.sourceSentence, flag.offset));
  const perRedLine = new Map<string, number>();
  for (const flag of shown) perRedLine.set(flag.redLineId, (perRedLine.get(flag.redLineId) ?? 0) + 1);

  return (
    <section className="result-view" aria-labelledby="result-heading">
      <h2 id="result-heading">{shown.length === 0 ? "No flags" : flagCount(shown.length)}</h2>
      <p className="result-meta">
        Your party: <strong>{party}</strong>.
        {shown.length > 1 ? " Severe flags come first, then Moderate, then Minor." : null}
      </p>

      {shown.length > 0 ? (
        <ol className="flag-list">
          {shown.map((flag) => (
            <li key={`${flag.redLineId}-${flag.offset}`} className="flag" data-tier={flag.tier.toLowerCase()}>
              <div className="slip-head">
                <span className="stamp">{flag.tier}</span>
                <h3 className="flag-line">{flag.redLineTitle}</h3>
              </div>
              <p className="flag-statement">{flag.statement}</p>
              <p className="slip-label">Source sentence</p>
              <blockquote className="flag-source">
                <p>{flag.sourceSentence}</p>
              </blockquote>
            </li>
          ))}
        </ol>
      ) : (
        <p className="result-empty">None of the red lines below matched a sentence in this document.</p>
      )}

      <h3 className="checked-heading" id="checked-heading">
        Red lines checked
      </h3>
      <ul className="checked-list" aria-labelledby="checked-heading">
        {checkedRedLines.map((redLine) => {
          const n = perRedLine.get(redLine.id) ?? 0;
          return (
            <li key={redLine.id}>
              <span className="checked-title">{redLine.title}</span>
              <span className="checked-count">{n === 0 ? "No flag" : flagCount(n)}</span>
            </li>
          );
        })}
      </ul>

      <p className="proof-statement">{PROOF_STATEMENT}</p>
      <p className="legal result-legal">{LEGAL_STATEMENT}</p>
    </section>
  );
}
