// Browser-side Word (.docx) intake (spec, "Document intake"; ticket 06). Mammoth's raw-text
// extraction ends every Word paragraph with a blank line, which is exactly the paragraph boundary
// normaliseText keeps. Mammoth is loaded only when a .docx is read (dynamic import).
import { normaliseText } from "./normalise.ts";

export type DocxReadResult =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "unreadable" };

/** Reads a .docx and returns its normalised text, or why it was refused. */
export async function readDocx(bytes: ArrayBuffer): Promise<DocxReadResult> {
  let raw: string;
  try {
    const { default: mammoth } = await import("mammoth");
    // In a browser bundle mammoth's unzip reads `arrayBuffer`; its Node build (used by the tests)
    // reads `buffer`. Both hand the same bytes to the same zip reader.
    const input = { arrayBuffer: bytes, buffer: bytes as unknown as Buffer };
    raw = (await mammoth.extractRawText(input)).value;
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  const text = normaliseText(raw);
  if (text === "") return { ok: false, reason: "empty" };
  return { ok: true, text };
}
