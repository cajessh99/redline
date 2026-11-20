// The banned-word list from PRODUCT.md (Brand Commitments). That file is the source of truth; this
// is its copy for code. Matching is whole-word (or whole-phrase) and case-insensitive, so "may"
// matches "May" but not "mayor".

export const BANNED_WORDS = [
  "safe",
  "standard",
  "normal",
  "unusual",
  "clean",
  "no issues",
  "might",
  "may",
  "could possibly",
] as const;

export type BannedWord = (typeof BANNED_WORDS)[number];

const patterns: ReadonlyArray<[BannedWord, RegExp]> = BANNED_WORDS.map((word) => [
  word,
  new RegExp(`\\b${word.replace(/ /g, "\\s+")}\\b`, "i"),
]);

/** The first banned word or phrase found in `text`, or null when there is none. */
export function findBannedWord(text: string): BannedWord | null {
  for (const [word, pattern] of patterns) {
    if (pattern.test(text)) return word;
  }
  return null;
}
