// The copy logic behind the counter-offer's copy button, kept apart from React so it can be tested
// with a stand-in clipboard. It copies exactly the string it is given, nothing added or trimmed.

/** The part of `navigator.clipboard` the copy button uses. */
export type ClipboardLike = { writeText(text: string): Promise<void> };

export type CopyOutcome = "copied" | "failed";

/**
 * Writes `text` to the clipboard. Returns "failed" when there is no clipboard (an insecure page, an
 * older browser) or when writing throws or rejects (permission refused). Never throws.
 */
export async function copyText(clipboard: ClipboardLike | null | undefined, text: string): Promise<CopyOutcome> {
  if (!clipboard || typeof clipboard.writeText !== "function") return "failed";
  try {
    await clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
