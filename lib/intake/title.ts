// A document's title (spec story 5). Signed in, the reader sees a title suggested from the text and
// can change it before the check runs; the library lists the document under that title. Pure, so
// the check page, the server and the tests all use the same rules.
//
// The suggestion prefers the contract's own heading ("SERVICES AGREEMENT"), tidied out of capitals,
// and adds the names of the two sides when the opening names them in the usual
// "between X, ... and Y, ..." form, because two contracts often share a heading. It never calls a
// model, and it is only a suggestion: the reader's own title wins.

/** The longest title a reader can give, in characters. */
export const MAX_TITLE_CHARS = 120;

/** The longest suggested title, in characters. Shorter than the limit so it reads at a glance. */
export const MAX_SUGGESTED_TITLE_CHARS = 100;

/** The longest line treated as a heading, in characters. */
export const MAX_HEADING_CHARS = 80;

/** The most words a heading has. Anything longer is a sentence. */
const MAX_HEADING_WORDS = 12;

/** The longest party name used in a suggestion, in characters. */
const MAX_PARTY_NAME_CHARS = 50;

/** How much of the opening is searched for the parties' names, in characters. */
const NAME_SCAN_CHARS = 1500;

/** The title when the text gives nothing to go on. The database refuses an empty title. */
export const UNTITLED = "Untitled contract";

/** Lower-case in a tidied heading unless they open it. */
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

/** Kept in capitals when a heading is tidied. */
const ACRONYMS = new Set(["LLC", "LLP", "INC", "LTD", "NDA", "SOW", "MSA", "UK", "US", "USA", "IP", "HR"]);

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Cuts at a word boundary so the result, with an ellipsis, fits `max`. */
function cut(value: string, max: number): string {
  if (value.length <= max) return value;
  const room = value.slice(0, max - 1);
  const space = room.lastIndexOf(" ");
  const head = (space > max / 2 ? room.slice(0, space) : room).replace(/[\s,;:.–—-]+$/, "");
  return `${head}…`;
}

function hasLetter(word: string): boolean {
  return /\p{L}/u.test(word);
}

function isCapitals(word: string): boolean {
  return hasLetter(word) && word === word.toUpperCase() && word !== word.toLowerCase();
}

function capitalise(word: string): string {
  // "NON-COMPETE" becomes "Non-Compete": each hyphenated part starts with a capital.
  return word
    .toLowerCase()
    .replace(/(^|[-/(“"'‘])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
}

/** "INDEPENDENT CONTRACTOR SERVICES AGREEMENT" becomes "Independent Contractor Services Agreement". */
function tidyCapitals(heading: string): string {
  return heading
    .split(" ")
    .map((word, i) => {
      const bare = word.replace(/[^\p{L}]/gu, "");
      if (ACRONYMS.has(bare)) return word;
      const lower = word.toLowerCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return capitalise(word);
    })
    .join(" ");
}

function tidyHeading(heading: string): string {
  const trimmed = collapse(heading).replace(/[\s:;,.–—-]+$/, "");
  const words = trimmed.split(" ").filter(hasLetter);
  return words.length > 0 && words.every(isCapitals) ? tidyCapitals(trimmed) : trimmed;
}

function wordCount(value: string): number {
  return value.split(" ").filter(Boolean).length;
}

/**
 * The contract's heading, if it opens with one: a short first paragraph that is not a sentence, or
 * a run of capitalised words that a new sentence follows ("SERVICES AGREEMENT This Agreement is"),
 * which is how a heading looks once intake has joined it to the paragraph below.
 */
function headingOf(firstParagraph: string): string | null {
  const paragraph = collapse(firstParagraph);
  if (!hasLetter(paragraph)) return null;

  const short = paragraph.length <= MAX_HEADING_CHARS && wordCount(paragraph) <= MAX_HEADING_WORDS;
  if (short && !/[.;,]$/.test(paragraph)) return paragraph;

  const words = paragraph.split(" ");
  let n = 0;
  while (n < words.length && (isCapitals(words[n]) || (!hasLetter(words[n]) && n > 0))) n += 1;
  // A single capitalised word ("THIS") opening a sentence is not a heading.
  if (n < 2 || n === words.length) return null;
  const next = words[n];
  if (!/^\p{Lu}/u.test(next)) return null; // "THIS AGREEMENT is made" is a sentence.
  const heading = words.slice(0, n).join(" ");
  return heading.length <= MAX_HEADING_CHARS ? heading : null;
}

function isName(value: string): boolean {
  return (
    value.length > 1 &&
    value.length <= MAX_PARTY_NAME_CHARS &&
    /^\p{Lu}/u.test(value) &&
    wordCount(value) <= 6 &&
    !/^(?:the|this|each|either|both)\b/i.test(value)
  );
}

/**
 * The two sides' names from an opening like "by and between Quillmont Analytics LLC, a limited
 * liability company ... ("Client"), and Rowan Tellisford, an individual ... ("Contractor")". Null
 * unless both are found.
 */
export function partyNamesOf(text: string): [string, string] | null {
  const opening = text.slice(0, NAME_SCAN_CHARS);
  for (const paragraph of opening.split(/\n\s*\n/)) {
    const first = /\bbetween\s+([^,(;\n]+?)\s*[,(]/.exec(paragraph);
    if (!first) continue;
    const a = collapse(first[1]);
    if (!isName(a)) continue;
    const rest = paragraph.slice(first.index + first[0].length);
    for (const match of rest.matchAll(/\band\s+([^,(;\n]+?)\s*[,(]/g)) {
      const b = collapse(match[1]);
      if (isName(b) && b !== a) return [a, b];
    }
  }
  return null;
}

/**
 * A title suggested from the stored text: the heading with the two sides' names when they fit,
 * else the heading, else the names, else the opening words cut to length. Never longer than
 * MAX_SUGGESTED_TITLE_CHARS and never empty.
 */
export function suggestTitle(text: string): string {
  const trimmed = text.trim();
  if (!hasLetter(trimmed)) return UNTITLED;

  const firstParagraph = trimmed.split(/\n\s*\n/, 1)[0];
  const rawHeading = headingOf(firstParagraph);
  const heading = rawHeading ? tidyHeading(rawHeading) : null;
  const names = partyNamesOf(trimmed);
  const pair = names ? `${names[0]} and ${names[1]}` : null;

  const options = [
    heading && pair ? `${heading}: ${pair}` : null,
    heading,
    pair,
  ].filter((option): option is string => option !== null && option !== "");
  for (const option of options) {
    if (option.length <= MAX_SUGGESTED_TITLE_CHARS) return option;
  }
  if (heading) return cut(heading, MAX_SUGGESTED_TITLE_CHARS);
  return cut(collapse(firstParagraph), MAX_SUGGESTED_TITLE_CHARS);
}

export type TitleProblem = "missing_title" | "title_too_long" | "bad_request";

/**
 * A title the reader typed, as it will be stored: runs of whitespace become one space and the ends
 * are trimmed. Empty or over MAX_TITLE_CHARS is refused, never cut or filled in.
 */
export function checkTitle(value: unknown): { ok: true; title: string } | { ok: false; code: TitleProblem } {
  if (typeof value !== "string") return { ok: false, code: "bad_request" };
  const title = collapse(value);
  if (title === "") return { ok: false, code: "missing_title" };
  if (title.length > MAX_TITLE_CHARS) return { ok: false, code: "title_too_long" };
  return { ok: true, title };
}
