// Browser-side intake for plain text (spec, "Document intake"; BUILD-REPORT.md B2). A chosen .txt
// file is read in the browser and normalised there; pasted text goes through the same
// normalisation. Only the normalised text is ever sent to the server. The file itself never leaves
// the machine. Ticket 06 adds PDF and Word beside this.
//
// Pure apart from reading the File, so tests run it in Node with Node's global File.

import { normaliseText } from "./normalise.ts";

/** The longest stored text Redline accepts, in characters (about 60 dense pages). */
export const MAX_DOCUMENT_CHARS = 200_000;

export type IntakeRefusal = "unsupported_format" | "empty" | "not_text" | "too_long";

export type IntakeResult = { ok: true; text: string } | { ok: false; reason: IntakeRefusal };

/** What the reader is told for each refusal. */
export const INTAKE_REFUSAL_MESSAGES: Record<IntakeRefusal, string> = {
  unsupported_format: "Redline reads plain text (.txt) files for now. You can also paste the text below.",
  empty: "There's no text in that. Choose another file or paste the contract.",
  not_text: "That file isn't plain text. Choose a .txt file or paste the contract.",
  too_long: `That's longer than Redline reads in one go (${MAX_DOCUMENT_CHARS.toLocaleString("en-US")} characters).`,
};

function isPlainTextFile(file: File): boolean {
  return file.type === "text/plain" || /\.txt$/i.test(file.name);
}

/** Normalises text the reader pasted, with the same rule as a file. */
export function normalisePastedText(raw: string): IntakeResult {
  return checked(normaliseText(raw));
}

function checked(text: string): IntakeResult {
  if (text === "") return { ok: false, reason: "empty" };
  if (text.length > MAX_DOCUMENT_CHARS) return { ok: false, reason: "too_long" };
  return { ok: true, text };
}

/** Reads a chosen .txt file in the browser and returns its normalised text, or why it was refused. */
export async function readPlainTextFile(file: File): Promise<IntakeResult> {
  if (!isPlainTextFile(file)) return { ok: false, reason: "unsupported_format" };
  if (file.size === 0) return { ok: false, reason: "empty" };
  const raw = await file.text();
  // A NUL byte means binary content under a .txt name. Its "text" would not be the document.
  if (raw.includes("\u0000")) return { ok: false, reason: "not_text" };
  return checked(normaliseText(raw));
}
