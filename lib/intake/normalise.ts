// Intake normalisation (spec, "Document intake"; BUILD-REPORT.md B11). The normalised text is the
// stored text: what the reader sees, what the model receives, and what every source sentence is
// checked against. Keeping those three the same string is what makes "exact match" mean one thing.
//
// Rule: line endings become LF. A paragraph boundary is one or more blank lines (empty or
// whitespace only). Inside a paragraph every whitespace run, including a single line break, a tab
// and a non-breaking space, becomes one space, and the paragraph is trimmed. Empty paragraphs are
// dropped and the rest are joined by one blank line. Every other character, typographic quotes
// included, is left exactly as it was. Running it twice gives the same string as running it once.

/** Normalises extracted document text into the stored text. Pure and idempotent. */
export function normaliseText(raw: string): string {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const paragraphs: string[] = [];
  let current: string[] = [];

  const close = () => {
    const paragraph = current.join(" ").replace(/\s+/g, " ").trim();
    if (paragraph) paragraphs.push(paragraph);
    current = [];
  };

  for (const line of lines) {
    if (/^\s*$/.test(line)) close();
    else current.push(line);
  }
  close();

  return paragraphs.join("\n\n");
}
