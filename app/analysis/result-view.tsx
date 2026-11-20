import type { Flag, ReceiptLine } from "../../lib/analysis/analyse.ts";
import type { CheckedRedLine } from "../../lib/analysis/run.ts";
import { isVerbatimAt } from "../../lib/analysis/stored.ts";

/** The fixed statement from the spec (story 54). Word for word; the one use of a banned word. */
export const PROOF_STATEMENT =
  "Redline shows only what it can prove. A receipt means no red line matched, not that the document is safe.";

/** The not-legal-advice line (story 55), worded as on the landing page. */
export const LEGAL_STATEMENT =
  "Redline isn't legal advice. It reports what your contract says. It doesn't say what the law allows where you live, or whether you should sign.";

/** The receipt line for a red line nothing in the document addresses (story 44, D9). */
export const DOES_NOT_MENTION = "The document does not mention this.";

/** Shown for a checked red line whose stored result no longer verifies against the text. */
export const RESULT_UNAVAILABLE =
  "The saved sentence for this red line no longer matches the document text, so Redline isn't showing it.";

type Props = {
  /** The stored text the flags were checked against. Every quoted sentence is checked against it again here. */
  storedText: string;
  party: string;
  flags: Flag[];
  receipt: ReceiptLine[];
  checkedRedLines: CheckedRedLine[];
};

type ReceiptRow =
  | { kind: "addressed"; id: string; title: string; sentence: string }
  | { kind: "not_mentioned"; id: string; title: string }
  | { kind: "unavailable"; id: string; title: string };

function flagCount(n: number): string {
  return n === 1 ? "1 flag" : `${n} flags`;
}

function noneMatched(n: number): string {
  return n === 1
    ? "Your one red line didn't match a sentence in this document."
    : `None of your ${n} red lines matched a sentence in this document.`;
}

/**
 * One row per checked red line with no shown flag, in the order the red lines were checked. A
 * quoted sentence must still be verbatim in the stored text at its offset. A red line with neither
 * a shown flag nor a verified receipt line is shown as unavailable: never as "not mentioned", and
 * never left off, so every checked red line is accounted for.
 */
function receiptRows(storedText: string, flagged: Set<string>, receipt: ReceiptLine[], checked: CheckedRedLine[]): ReceiptRow[] {
  const valid = receipt.filter(
    (line) => line.kind === "not_mentioned" || isVerbatimAt(storedText, line.sentence, line.offset),
  );
  const order: CheckedRedLine[] =
    checked.length > 0 ? checked : receipt.map((line) => ({ id: line.redLineId, title: line.redLineTitle }));
  return order
    .filter((redLine) => !flagged.has(redLine.id))
    .map((redLine): ReceiptRow => {
      const line = valid.find((l) => l.redLineId === redLine.id);
      if (!line) return { kind: "unavailable", id: redLine.id, title: redLine.title };
      if (line.kind === "addressed") {
        return { kind: "addressed", id: redLine.id, title: redLine.title, sentence: line.sentence };
      }
      return { kind: "not_mentioned", id: redLine.id, title: redLine.title };
    });
}

/**
 * The result of one analysis: flags ranked Severe, Moderate, Minor, each with its red line, tier
 * word, plain statement and verified source sentence; then the receipt, one row for every checked
 * red line with no flag; then the two fixed statements. A flag or receipt sentence that is not
 * verbatim in the stored text at its offset is not rendered (ADR-0001). Counter-offers arrive in
 * ticket 05.
 */
export function ResultView({ storedText, party, flags, receipt, checkedRedLines }: Props) {
  const shown = flags.filter((flag) => isVerbatimAt(storedText, flag.sourceSentence, flag.offset));
  const flagged = new Set(shown.map((flag) => flag.redLineId));
  const rows = receiptRows(storedText, flagged, receipt, checkedRedLines);

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
      ) : rows.length > 0 ? (
        <p className="result-empty">{noneMatched(rows.length)}</p>
      ) : null}

      {rows.length > 0 ? (
        <>
          <h3 className="receipt-heading" id="receipt-heading">
            Red lines with no flag
          </h3>
          <ul className="receipt-list" aria-labelledby="receipt-heading">
            {rows.map((row) => (
              <li key={row.id} className="receipt-line" data-kind={row.kind}>
                <div className="receipt-head">
                  {row.kind === "unavailable" ? null : <span className="stamp stamp-plain">No flag</span>}
                  <h4 className="receipt-title">{row.title}</h4>
                </div>
                {row.kind === "addressed" ? (
                  <>
                    <p className="slip-label">What the document says</p>
                    <blockquote className="receipt-source">
                      <p>{row.sentence}</p>
                    </blockquote>
                  </>
                ) : (
                  <p className="receipt-note">{row.kind === "not_mentioned" ? DOES_NOT_MENTION : RESULT_UNAVAILABLE}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="proof-statement">{PROOF_STATEMENT}</p>
      <p className="legal result-legal">{LEGAL_STATEMENT}</p>
    </section>
  );
}
