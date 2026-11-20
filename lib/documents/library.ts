// A signed-in reader's saved documents (ticket 10, spec stories 47 to 50): the library list, opening
// one stored result, and deleting a document with everything attached to it.
//
// Every call goes through a transport that runs as the signed-in reader, so row-level security
// decides what exists. Another reader's document looks exactly like one that does not exist:
// opening it gives null (the page answers 404) and deleting it removes nothing.
//
// Opening a stored result never calls the model. It reads the latest stored analysis and checks
// every quoted sentence against the stored text again (lib/analysis/stored.ts).
//
// The transport is injected, so this runs in tests over PGlite with the real migrations. It must
// not import server-only code; lib/server/library-store.ts is the Supabase transport.

import type { Flag, ReceiptLine } from "../analysis/analyse.ts";
import type { CheckedRedLine } from "../analysis/run.ts";
import { parseCheckedRedLines, parseStoredFlags, parseStoredReceipt } from "../analysis/stored.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `id` has the shape of a document id. Anything else is not found, without a query. */
export function isDocumentId(id: unknown): id is string {
  return typeof id === "string" && UUID.test(id);
}

/** One row of the library_entries view (supabase/migrations/0006). */
export type LibraryRow = {
  id: string;
  title: string;
  party: string;
  created_at: string | Date;
  severe_count: number;
  moderate_count: number;
  minor_count: number;
};

export type DocumentRow = { id: string; title: string; stored_text: string; party: string };

export type AnalysisRow = { flags: unknown; receipt: unknown; red_lines_snapshot: unknown };

/** The reader's documents, as the signed-in reader. Throws when the database can't be reached. */
export interface LibraryTransport {
  /** Every library_entries row the reader can see, newest document first. */
  listEntries(): Promise<LibraryRow[]>;
  /** The document, or null when the reader can't see it. */
  loadDocument(id: string): Promise<DocumentRow | null>;
  /** The document's most recent analysis, or null when there is none the reader can see. */
  loadLatestAnalysis(documentId: string): Promise<AnalysisRow | null>;
  /** Deletes the document (its analyses and questions go with it). False when nothing was deleted. */
  deleteDocument(id: string): Promise<boolean>;
}

export type TierCounts = { Severe: number; Moderate: number; Minor: number };

export type LibraryEntry = {
  id: string;
  title: string;
  party: string;
  /** When the document was first checked, as an ISO 8601 string. */
  createdAt: string;
  counts: TierCounts;
};

function count(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : 0;
}

function iso(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

/** The library, newest first, whatever order the transport returned. */
export async function listLibrary(transport: LibraryTransport): Promise<LibraryEntry[]> {
  const rows = await transport.listEntries();
  return rows
    .map((row) => ({
      id: row.id,
      title: row.title,
      party: row.party,
      createdAt: iso(row.created_at),
      counts: {
        Severe: count(row.severe_count),
        Moderate: count(row.moderate_count),
        Minor: count(row.minor_count),
      },
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** What the document page shows: the stored text and the latest stored analysis, verified again. */
export type StoredResult = {
  id: string;
  title: string;
  storedText: string;
  party: string;
  flags: Flag[];
  receipt: ReceiptLine[];
  checkedRedLines: CheckedRedLine[];
};

/**
 * A stored document and its latest analysis, exactly as stored, with no model call. Null when the
 * id is not a document this reader can see, or it has no analysis: the page answers 404 for both,
 * so another reader's id is indistinguishable from one that never existed.
 */
export async function openStoredResult(transport: LibraryTransport, id: unknown): Promise<StoredResult | null> {
  if (!isDocumentId(id)) return null;
  const document = await transport.loadDocument(id);
  if (!document) return null;
  const analysis = await transport.loadLatestAnalysis(id);
  if (!analysis) return null;
  return {
    id: document.id,
    title: document.title,
    storedText: document.stored_text,
    party: document.party,
    flags: parseStoredFlags(analysis.flags, document.stored_text),
    receipt: parseStoredReceipt(analysis.receipt, document.stored_text),
    checkedRedLines: parseCheckedRedLines(analysis.red_lines_snapshot),
  };
}

export type DeleteOutcome = { ok: true } | { ok: false; code: "not_found" | "failed" };

/**
 * Deletes one of the reader's documents and, through the database's cascades, its analyses and
 * questions. Another reader's document, or one already gone, is "not_found" and nothing changes.
 */
export async function deleteDocument(
  transport: LibraryTransport,
  id: unknown,
  log?: (message: string) => void,
): Promise<DeleteOutcome> {
  if (!isDocumentId(id)) return { ok: false, code: "not_found" };
  try {
    return (await transport.deleteDocument(id)) ? { ok: true } : { ok: false, code: "not_found" };
  } catch (error) {
    log?.(`deleting the document failed: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false, code: "failed" };
  }
}
