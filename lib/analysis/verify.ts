// Source verification (ADR-0001, spec "Analysis boundary"). A source sentence passes only when it
// occurs in the stored text as an exact substring: no trimming, no case folding, no whitespace
// tolerance. The only whitespace leniency anywhere in the pipeline is intake normalisation, which
// has already been applied to the stored text before this check runs.

export type VerifyFailureReason = "empty" | "not_found";

export type VerifyResult =
  | { ok: true; offset: number }
  | { ok: false; reason: VerifyFailureReason };

/**
 * Checks that `sentence` occurs verbatim in `storedText`. On success, `offset` is the character
 * index of its first occurrence. An empty or whitespace-only sentence always fails.
 */
export function verifySourceSentence(storedText: string, sentence: string): VerifyResult {
  if (sentence.trim() === "") return { ok: false, reason: "empty" };
  const offset = storedText.indexOf(sentence);
  if (offset === -1) return { ok: false, reason: "not_found" };
  return { ok: true, offset };
}
