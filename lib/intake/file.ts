// The one way a chosen file becomes stored text (spec stories 1 to 3 and 6; ticket 06). It decides
// the format from the file's extension and type, hands the file to the matching reader, and returns
// either the normalised text or a refusal with the message the reader sees. Everything happens in
// the browser: nothing here sends or stores anything, so a refused file leaves nothing behind.
//
// Accepted: PDF, Word (.docx), plain text. Refused: everything else, including the older Word
// .doc, RTF, Pages, OpenDocument and images. Scanned PDFs are refused, never read with OCR.
import { readDocx } from "./docx.ts";
import { detectFormat, type ContractFormat } from "./formats.ts";
import { readPdf } from "./pdf.ts";
import { INTAKE_REFUSAL_MESSAGES, MAX_DOCUMENT_CHARS, readPlainTextFile } from "./text-file.ts";

export { CONTRACT_FILE_ACCEPT, detectFormat, type ContractFormat } from "./formats.ts";

export type ContractRefusal = "unsupported" | "scanned" | "empty" | "unreadable" | "too_long";
export type ContractFileResult =
  | { ok: true; text: string; format: ContractFormat }
  | { ok: false; reason: ContractRefusal; message: string };

/** What the reader is told for each refusal. Every message names a next step. */
export const CONTRACT_REFUSAL_MESSAGES = {
  unsupported: INTAKE_REFUSAL_MESSAGES.unsupported_format,
  scanned:
    "This PDF has almost no text in it, so it's a scan or a photo of the pages. Redline doesn't read those: it would have to guess at the words, and a quote from a misread page can't be checked against your contract. Ask for the original file, or a PDF saved from the program it was written in. If you have the text, paste it below.",
  password: "That PDF is locked with a password. Save a copy without the password, or paste the text below.",
  damaged:
    "Redline couldn't read that file. Check that it opens on your computer and try again, or paste the text below.",
  notText: INTAKE_REFUSAL_MESSAGES.not_text,
  empty: INTAKE_REFUSAL_MESSAGES.empty,
  tooLong: INTAKE_REFUSAL_MESSAGES.too_long,
} as const;

const refuse = (reason: ContractRefusal, message: string): ContractFileResult => ({ ok: false, reason, message });

function accepted(text: string, format: ContractFormat): ContractFileResult {
  if (text.length > MAX_DOCUMENT_CHARS) return refuse("too_long", CONTRACT_REFUSAL_MESSAGES.tooLong);
  return { ok: true, text, format };
}

/** Reads a chosen file in the browser and returns its normalised text, or why it was refused. */
export async function readContractFile(file: File): Promise<ContractFileResult> {
  const format = detectFormat(file);
  if (!format) return refuse("unsupported", CONTRACT_REFUSAL_MESSAGES.unsupported);
  if (file.size === 0) return refuse("empty", CONTRACT_REFUSAL_MESSAGES.empty);

  if (format === "txt") {
    const result = await readPlainTextFile(new File([file], "contract.txt", { type: "text/plain" }));
    if (result.ok) return accepted(result.text, "txt");
    if (result.reason === "not_text") return refuse("unreadable", CONTRACT_REFUSAL_MESSAGES.notText);
    if (result.reason === "too_long") return refuse("too_long", CONTRACT_REFUSAL_MESSAGES.tooLong);
    return refuse("empty", CONTRACT_REFUSAL_MESSAGES.empty);
  }

  const bytes = await file.arrayBuffer();
  if (format === "pdf") {
    const result = await readPdf(bytes);
    if (result.ok) return accepted(result.text, "pdf");
    if (result.reason === "scanned") return refuse("scanned", CONTRACT_REFUSAL_MESSAGES.scanned);
    return refuse(
      "unreadable",
      result.cause === "password" ? CONTRACT_REFUSAL_MESSAGES.password : CONTRACT_REFUSAL_MESSAGES.damaged,
    );
  }

  const result = await readDocx(bytes);
  if (result.ok) return accepted(result.text, "docx");
  if (result.reason === "empty") return refuse("empty", CONTRACT_REFUSAL_MESSAGES.empty);
  return refuse("unreadable", CONTRACT_REFUSAL_MESSAGES.damaged);
}

/**
 * Reads a chosen file and passes its text on only when it was accepted. A refused file reaches
 * `onRefused` with its message and never reaches `onText`, which is the only way text moves on
 * towards the preview and, from there, the server.
 */
export async function takeContractFile(
  file: File,
  handlers: {
    onText: (text: string, format: ContractFormat) => void;
    onRefused: (message: string, reason: ContractRefusal) => void;
  },
): Promise<ContractFileResult> {
  const result = await readContractFile(file);
  if (result.ok) handlers.onText(result.text, result.format);
  else handlers.onRefused(result.message, result.reason);
  return result;
}
