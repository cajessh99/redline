// Changing the party on a stored document (spec story 10, D10). The analysis is run again over the
// text already stored for that document, as the newly chosen party, and the new party and the new
// analysis are stored together. The text comes from the store, never from the request, so the
// reader cannot change what was checked this way.
//
// Nothing is changed unless the new analysis finished and was stored: a model failure, or a failed
// save, leaves the document's party and its latest analysis as they were.
//
// The model client and the store are injected, so this runs in tests with the fake model and an
// in-memory store. It must not import server-only code.

import type { RedLine } from "../red-lines/defaults.ts";
import { analyse, type AnalysisDiagnostics, type Flag, type ReceiptLine } from "./analyse.ts";
import type { ModelClient } from "./model.ts";
import { checkParty, redLinesSnapshot, RUN_ERROR_MESSAGES, type CheckedRedLine } from "./run.ts";

export type StoredDocument = { id: string; title: string; storedText: string; party: string };

/** What a rerun stores: the new party and the new analysis, written together or not at all. */
export type RerunRecord = {
  documentId: string;
  party: string;
  redLinesSnapshot: RedLine[];
  flags: Flag[];
  receipt: ReceiptLine[];
};

/** A signed-in reader's stored documents. Only documents the reader owns are visible. */
export interface DocumentStore {
  /** The document, or null when it does not exist or belongs to someone else. */
  load(documentId: string): Promise<StoredDocument | null>;
  /** Updates the party and adds the new analysis atomically. Throws when nothing was written. */
  rerun(record: RerunRecord): Promise<void>;
}

export type RerunErrorCode =
  | "bad_request"
  | "missing_party"
  | "party_too_long"
  | "not_found"
  | "load_failed"
  | "no_red_lines"
  | "red_lines_unavailable"
  | "model_unavailable"
  | "analysis_failed"
  | "save_failed";

export type RerunOutcome =
  | {
      ok: true;
      title: string;
      party: string;
      flags: Flag[];
      receipt: ReceiptLine[];
      checkedRedLines: CheckedRedLine[];
      saved: { kind: "saved"; documentId: string };
      diagnostics: AnalysisDiagnostics;
    }
  | { ok: false; status: number; error: { code: RerunErrorCode; message: string } };

export type RerunDeps = {
  model: ModelClient | null;
  store: DocumentStore;
  /** The reader's enabled red lines. An empty list is refused before any model call. */
  redLines: RedLine[];
  /** Where a failure is reported for the operator. Never receives document text or the key. */
  log?: (message: string) => void;
};

export const RERUN_ERROR_MESSAGES: Record<RerunErrorCode, string> = {
  bad_request: RUN_ERROR_MESSAGES.bad_request,
  missing_party: "Pick or type your party before Redline checks the contract again.",
  party_too_long: RUN_ERROR_MESSAGES.party_too_long,
  not_found: "Redline can't find this contract in your account.",
  load_failed: "Redline couldn't open this contract. Nothing has changed. Try again in a minute.",
  no_red_lines: RUN_ERROR_MESSAGES.no_red_lines,
  red_lines_unavailable:
    "Redline couldn't load your red lines, so it hasn't checked the contract again. Your party and saved result haven't changed.",
  model_unavailable: "Redline can't check contracts right now. Your party and saved result haven't changed.",
  analysis_failed:
    "Redline couldn't finish the new check. Your party and saved result haven't changed. Try again in a minute.",
  save_failed: "Redline couldn't save the new result. Your party and saved result haven't changed.",
};

function refuse(status: number, code: RerunErrorCode): RerunOutcome {
  return { ok: false, status, error: { code, message: RERUN_ERROR_MESSAGES[code] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reruns the analysis of a stored document as the party in `body.party`. Any other field in the
 * body, a `text` included, is ignored.
 */
export async function rerunWithParty(documentId: string, body: unknown, deps: RerunDeps): Promise<RerunOutcome> {
  if (!isRecord(body)) return refuse(400, "bad_request");
  const checked = checkParty(body.party);
  if (!checked.ok) return refuse(400, checked.code);
  const party = checked.party;

  let document: StoredDocument | null;
  try {
    document = await deps.store.load(documentId);
  } catch (error) {
    deps.log?.(`loading the document failed: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(500, "load_failed");
  }
  if (!document) return refuse(404, "not_found");

  const snapshot = redLinesSnapshot(deps.redLines);
  if (snapshot.length === 0) return refuse(422, "no_red_lines");

  if (!deps.model) return refuse(503, "model_unavailable");

  const result = await analyse({ text: document.storedText, party, redLines: snapshot }, { model: deps.model });
  if (!result.ok) {
    deps.log?.(`rerun failed (${result.error.kind}): ${result.error.message}`);
    return refuse(502, "analysis_failed");
  }

  try {
    await deps.store.rerun({
      documentId: document.id,
      party,
      redLinesSnapshot: snapshot,
      flags: result.flags,
      receipt: result.receipt,
    });
  } catch (error) {
    deps.log?.(`saving the rerun failed: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(500, "save_failed");
  }

  return {
    ok: true,
    title: document.title,
    party,
    flags: result.flags,
    receipt: result.receipt,
    checkedRedLines: snapshot.map(({ id, title }) => ({ id, title })),
    saved: { kind: "saved", documentId: document.id },
    diagnostics: result.diagnostics,
  };
}
