# 0001. Every flag cites its source

Status: Accepted

## Decision
Every risk flag Redline produces must cite the exact sentence from the uploaded document that
it came from, shown alongside the flag. The citation must match the stored document text
exactly. A flag whose source sentence cannot be shown is a bug, not a formatting preference,
and it is never displayed without its source.

## Alternatives
- **Model describes risks in its own words, no quotation.** Simplest to build and reads
  smoothly, but nothing ties a flag to the text. A reader cannot tell a real clause from an
  invention.
- **Paraphrase plus a section or page reference.** Points the reader to a place, but the
  claim itself is still the model's wording, and it cannot be checked mechanically.
- **Quote where convenient, optional otherwise.** Makes citation a style choice, so
  unsupported flags would appear in exactly the cases where they are least trustworthy.
- **Model-reported quotes accepted unchecked.** Models can misquote, so a quote on screen
  would not prove the sentence exists.

## Why
A reader of the output can verify each flag for themselves:
- Find the quoted sentence in their own document and read it in context.
- Judge whether the flag's severity and summary follow from those exact words.
- Tell a flag the document supports from one it does not, because the second has no quote.
Without that, the user must trust the model. With it, they only have to read one sentence.

## Consequences
- **Product:** Anything we cannot quote, we cannot flag. Risks that come from what a document
  leaves out, or from reading several clauses together, need a quotable anchor or they are not
  shown. Expect fewer flags than a free-text approach would give.
- **Build:** Analysis output must carry a source sentence per flag. Code checks that sentence
  as an exact match against the stored text before anything is shown. A flag that fails is
  dropped or regenerated.
- **Text fidelity:** The check is only meaningful if stored text is what the document says,
  which is one reason OCR is excluded.
- **Testing:** Tests must assert that every displayed flag has a source present verbatim in
  the document, and include cases where the model returns a misquote and it is rejected.
- **Counter-offers and answers:** These must not assert anything the cited text does not support.
