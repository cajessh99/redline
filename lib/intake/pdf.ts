// Browser-side PDF intake (spec, "Document intake"; ticket 06). Reads the text layer with pdf.js and
// rebuilds paragraphs from where the text sits on the page, then applies the same normalisation as
// plain text. Never OCR: a PDF without a usable text layer is refused as scanned, because a quote
// from misread text can't be checked against the reader's own copy (CLAUDE.md, Scope).
//
// pdf.js is loaded only when a PDF is read (dynamic import), so the check page stays light. In a
// browser its worker comes from this app's own bundle, never a CDN. In Node (the tests) pdf.js
// runs its worker code in-process. This uses pdf.js's "legacy" build in both places: it is the
// build pdf.js supports in Node, and in a browser it also runs on versions a year or two old,
// which the modern build drops. A reader on an older Safari still gets their PDF read.
import { normaliseText } from "./normalise.ts";

/**
 * A PDF averaging fewer non-whitespace characters than this per page is treated as scanned.
 *
 * A typed contract page holds roughly 2,000 to 4,000 characters; even a short signature or cover
 * page holds a few hundred, and the average across pages absorbs those. A scan or a phone photo
 * has none, or only what a scanner stamps on as text (a page number, a footer, a Bates number),
 * which stays well under 200. Recorded for revisiting in QUESTIONS.md (Q7).
 */
export const SCANNED_MIN_CHARS_PER_PAGE = 200;

/** The parts of a pdf.js text item this module reads. */
export type PdfTextItem = {
  str: string;
  /** [a, b, c, d, x, y]: the text matrix. x and y are the start of the baseline. */
  transform: number[];
  width: number;
  height: number;
  hasEOL: boolean;
};

/** One line of text on a page, in reading order as pdf.js returns it. */
export type PdfLine = { text: string; left: number; right: number; y: number; fontSize: number };

export type PdfReadResult =
  | { ok: true; text: string }
  | { ok: false; reason: "scanned" }
  | { ok: false; reason: "unreadable"; cause: "password" | "damaged" };

const fontSizeOf = (item: PdfTextItem) =>
  Math.hypot(item.transform[2], item.transform[3]) || Math.abs(item.height) || 1;

/**
 * Groups a page's text items into lines. A new line starts after an item that ends one (hasEOL)
 * or when the baseline moves by more than half the font size. Items on one line are joined with a
 * space where there is a visible gap between them and no space already, and run together where
 * they touch, so a word that the PDF draws in two pieces stays one word.
 */
export function linesFromItems(items: PdfTextItem[]): PdfLine[] {
  const lines: PdfLine[] = [];
  let line: PdfLine | null = null;
  const close = () => {
    if (line && line.text.trim()) lines.push(line);
    line = null;
  };
  for (const item of items) {
    if (item.str !== "") {
      const x = item.transform[4];
      const y = item.transform[5];
      const fontSize = fontSizeOf(item);
      const current: PdfLine | null = line;
      if (current && Math.abs(y - current.y) > 0.5 * Math.max(fontSize, current.fontSize)) close();
      if (!line) {
        line = { text: item.str, left: x, right: x + item.width, y, fontSize };
      } else {
        const l: PdfLine = line;
        const gap = x - l.right;
        const spaced = /\s$/.test(l.text) || /^\s/.test(item.str);
        l.text += !spaced && gap > 0.15 * fontSize ? ` ${item.str}` : item.str;
        l.left = Math.min(l.left, x);
        l.right = Math.max(l.right, x + item.width);
        l.fontSize = Math.max(l.fontSize, fontSize);
      }
    }
    if (item.hasEOL) close();
  }
  close();
  return lines;
}

const ENDS_SENTENCE = /[.:;!?]["'”’)\]]*$/;

/**
 * Rebuilds paragraphs from the lines of every page. Inside a page, a gap between baselines more
 * than 1.3 times the page's tightest line spacing (or more than 2.2 times the font size) starts a
 * new paragraph, as does a line that sits above the one before it. Wrapped lines of one paragraph
 * stay together. At a page break the paragraph continues unless the page's last line ends a
 * sentence or stops well short of the page's longest line.
 *
 * Returns text with one line break between wrapped lines and a blank line between paragraphs,
 * ready for normaliseText.
 */
export function paragraphText(pages: PdfLine[][]): string {
  let out = "";
  let previousPageEnded = true;
  for (const lines of pages) {
    if (lines.length === 0) continue;
    const gaps = lines
      .slice(1)
      .map((l, i) => lines[i].y - l.y)
      .filter((g, i) => g > 0.5 * Math.max(lines[i].fontSize, lines[i + 1].fontSize));
    const lineGap = gaps.length ? Math.min(...gaps) : Infinity;
    lines.forEach((l, i) => {
      if (i === 0) {
        if (out) out += previousPageEnded ? "\n\n" : "\n";
      } else {
        const gap = lines[i - 1].y - l.y;
        const size = Math.max(lines[i - 1].fontSize, l.fontSize);
        const newParagraph = gap < -0.5 * size || gap > 1.3 * lineGap || gap > 2.2 * size;
        out += newParagraph ? "\n\n" : "\n";
      }
      out += l.text;
    });
    const last = lines[lines.length - 1];
    const widest = Math.max(...lines.map((l) => l.right - l.left));
    previousPageEnded = ENDS_SENTENCE.test(last.text.trim()) || last.right - last.left < 0.8 * widest;
  }
  return out;
}

/** Characters that are not whitespace: what a page has to show to count as having text. */
export function countTextCharacters(text: string): number {
  return text.replace(/\s/g, "").length;
}

/** True when the text layer is too thin to be the document: none at all, or below the threshold. */
export function looksScanned(charactersPerPage: number[]): boolean {
  const total = charactersPerPage.reduce((sum, n) => sum + n, 0);
  if (total === 0 || charactersPerPage.length === 0) return true;
  return total / charactersPerPage.length < SCANNED_MIN_CHARS_PER_PAGE;
}

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsPromise: Promise<PdfJs> | null = null;

/** Loads pdf.js on first use. In a browser, its worker is a module from this app's own bundle. */
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    if (typeof window !== "undefined" && typeof Worker !== "undefined" && !pdfjs.GlobalWorkerOptions.workerPort) {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
        { type: "module" },
      );
    }
    return pdfjs;
  });
  return pdfjsPromise;
}

/** Reads the text layer of a PDF and returns its normalised text, or why it was refused. */
export async function readPdf(bytes: ArrayBuffer | Uint8Array): Promise<PdfReadResult> {
  const pdfjs = await loadPdfJs();
  // pdf.js takes ownership of the bytes it is given, so it gets a copy.
  const data = new Uint8Array(bytes).slice();
  const task = pdfjs.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (error) {
    await task.destroy().catch(() => {});
    const name = (error as { name?: string } | null)?.name;
    return { ok: false, reason: "unreadable", cause: name === "PasswordException" ? "password" : "damaged" };
  }
  try {
    const pages: PdfLine[][] = [];
    const characters: number[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items = content.items.filter((item): item is PdfTextItem & (typeof content.items)[number] => "str" in item);
      characters.push(countTextCharacters(items.map((item) => item.str).join("")));
      pages.push(linesFromItems(items));
      page.cleanup();
    }
    if (looksScanned(characters)) return { ok: false, reason: "scanned" };
    return { ok: true, text: normaliseText(paragraphText(pages)) };
  } catch {
    return { ok: false, reason: "unreadable", cause: "damaged" };
  } finally {
    await task.destroy().catch(() => {});
  }
}
