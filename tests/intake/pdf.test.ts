// Paragraph reconstruction from pdf.js text items, on hand-built items that stand for the layouts
// real PDFs use. The fixture PDFs exercise the same code through pdf.js in file.test.ts.
import { describe, expect, it } from "vitest";
import { normaliseText } from "../../lib/intake/normalise.ts";
import { linesFromItems, paragraphText, type PdfTextItem } from "../../lib/intake/pdf.ts";

/** A text item at (x, y) in a 10pt font, with an approximate width of 5pt per character. */
const item = (str: string, x: number, y: number, hasEOL = false, size = 10): PdfTextItem => ({
  str,
  transform: [size, 0, 0, size, x, y],
  width: str.length * 5,
  height: size,
  hasEOL,
});

describe("linesFromItems", () => {
  it("puts a space between pieces of a line drawn with a gap and no space character", () => {
    const lines = linesFromItems([item("Client shall", 72, 700), item("pay", 72 + 60 + 3, 700, true)]);
    expect(lines.map((l) => l.text)).toEqual(["Client shall pay"]);
  });

  it("runs together pieces that touch, so a word drawn in two parts stays one word", () => {
    const lines = linesFromItems([item("Contr", 72, 700), item("actor", 72 + 25, 700, true)]);
    expect(lines.map((l) => l.text)).toEqual(["Contractor"]);
  });

  it("adds no second space when a piece already ends with one", () => {
    const lines = linesFromItems([item("Client ", 72, 700), item("shall", 72 + 40, 700, true)]);
    expect(lines.map((l) => l.text)).toEqual(["Client shall"]);
  });

  it("starts a new line at an end-of-line marker or a change of baseline", () => {
    const lines = linesFromItems([
      item("First line", 72, 700, true),
      item("Second", 72, 686),
      item("", 0, 0, true),
      item("Third", 72, 672),
      item("Fourth", 72, 658),
    ]);
    expect(lines.map((l) => l.text)).toEqual(["First line", "Second", "Third", "Fourth"]);
  });

  it("keeps a raised footnote mark on its line", () => {
    const lines = linesFromItems([item("Fees", 72, 700), item("1", 92, 703, false, 6), item(" are due.", 95, 700, true)]);
    expect(lines.map((l) => l.text)).toEqual(["Fees1 are due."]);
  });
});

describe("paragraphText", () => {
  const lines = (...rows: [string, number][]) => linesFromItems(rows.map(([s, y]) => item(s, 72, y, true)));

  it("keeps wrapped lines in one paragraph and breaks where the line spacing opens up", () => {
    const page = lines(
      ["1. Fees", 700],
      ["Client shall pay each invoice", 676],
      ["within thirty days.", 662],
      ["Late payments accrue", 638],
      ["interest.", 624],
    );
    expect(normaliseText(paragraphText([page]))).toBe(
      "1. Fees\n\nClient shall pay each invoice within thirty days.\n\nLate payments accrue interest.",
    );
  });

  it("breaks on a wide gap even when every gap on the page is wide", () => {
    const page = lines(["One.", 700], ["Two.", 670], ["Three.", 640]);
    expect(normaliseText(paragraphText([page]))).toBe("One.\n\nTwo.\n\nThree.");
  });

  it("continues a paragraph across a page break when the page ends mid-sentence on a full line", () => {
    const first = lines(["Contractor hereby assigns to Client all", 700], ["right, title, and interest in all", 686]);
    const second = lines(["work product.", 700], ["Next paragraph.", 676]);
    expect(normaliseText(paragraphText([first, second]))).toBe(
      "Contractor hereby assigns to Client all right, title, and interest in all work product.\n\nNext paragraph.",
    );
  });

  it("starts a new paragraph on the next page when the page ends a sentence or a short line", () => {
    const endsSentence = lines(["Client shall pay within thirty days.", 700]);
    const shortLast = lines(["A long line of text that sets the width", 700], ["8. Term", 676]);
    const next = lines(["This Agreement begins today.", 700]);
    expect(normaliseText(paragraphText([endsSentence, next]))).toBe(
      "Client shall pay within thirty days.\n\nThis Agreement begins today.",
    );
    expect(normaliseText(paragraphText([shortLast, next]))).toBe(
      "A long line of text that sets the width\n\n8. Term\n\nThis Agreement begins today.",
    );
  });

  it("skips pages with no text", () => {
    expect(normaliseText(paragraphText([[], lines(["Only text.", 700]), []]))).toBe("Only text.");
  });
});
