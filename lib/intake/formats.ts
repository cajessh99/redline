// Which files Redline reads (spec, "Document intake"): PDF, Word (.docx) and plain text. Kept apart
// from the readers so the check page can name the formats without loading any parser.

export type ContractFormat = "pdf" | "docx" | "txt";

const MIME: Record<string, ContractFormat> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};
const EXTENSIONS: Record<string, ContractFormat> = { pdf: "pdf", docx: "docx", txt: "txt" };

/** The file input's `accept` value: the three formats by extension and by type. */
export const CONTRACT_FILE_ACCEPT = [".pdf", ".docx", ".txt", ...Object.keys(MIME)].join(",");

/**
 * The format of a chosen file, or null when Redline does not read it. A file's extension decides
 * when it has one; the browser's type is used only for a name without an extension. A known
 * extension under a different type (a .pdf the system calls something else) is still read as the
 * extension says, and a file that isn't what its name claims fails in its reader instead.
 */
export function detectFormat(file: { name: string; type: string }): ContractFormat | null {
  const extension = /\.([A-Za-z0-9]{1,6})$/.exec(file.name.trim())?.[1]?.toLowerCase();
  if (extension) return EXTENSIONS[extension] ?? null;
  return MIME[file.type.toLowerCase()] ?? null;
}
