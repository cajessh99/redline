// One analysis request from the check page, end to end: validate what the browser sent, run the
// analysis, store the document and analysis only when it succeeded and a reader is signed in.
//
// The model client and the store are injected, so this runs in tests with the fake model and an
// in-memory store. It must not import server-only code. The route handler (app/api/analyse) builds
// the real client and the Supabase store and passes them in.

import { normaliseText } from "../intake/normalise.ts";
import { MAX_DOCUMENT_CHARS } from "../intake/text-file.ts";
import type { RedLine } from "../red-lines/defaults.ts";
import { analyse, type AnalysisDiagnostics, type Flag } from "./analyse.ts";
import type { ModelClient } from "./model.ts";

/** The longest party name accepted, in characters. A role is a word or two. */
export const MAX_PARTY_CHARS = 120;

/** The longest document title taken from the text. Ticket 10 lets the reader set their own. */
export const MAX_TITLE_CHARS = 80;

/** What is stored for one successful analysis. Written together or not at all. */
export type AnalysisRecord = {
  title: string;
  storedText: string;
  party: string;
  /** The red lines checked in this run, as they were worded at the time. */
  redLinesSnapshot: RedLine[];
  flags: Flag[];
};

/** Where a signed-in reader's documents go. Saves atomically and returns the document id. */
export interface AnalysisStore {
  save(record: AnalysisRecord): Promise<string>;
}

export type CheckedRedLine = { id: string; title: string };

export type SavedState =
  | { kind: "not_kept" }
  | { kind: "saved"; documentId: string }
  | { kind: "save_failed" };

export type RunErrorCode =
  | "bad_request"
  | "empty_text"
  | "text_too_long"
  | "not_normalised"
  | "missing_party"
  | "party_too_long"
  | "model_unavailable"
  | "analysis_failed";

export type RunOutcome =
  | {
      ok: true;
      title: string;
      party: string;
      flags: Flag[];
      checkedRedLines: CheckedRedLine[];
      saved: SavedState;
      /** For logs and the smoke script. The check page does not show it. */
      diagnostics: AnalysisDiagnostics;
    }
  | { ok: false; status: number; error: { code: RunErrorCode; message: string } };

export type RunDeps = {
  /** Null when the model is not configured. */
  model: ModelClient | null;
  /** Null when nobody is signed in, or accounts are not configured. Then nothing is stored. */
  store: AnalysisStore | null;
  /** The enabled red lines for this run. */
  redLines: RedLine[];
  /** Where a failure is reported for the operator. Never receives document text or the key. */
  log?: (message: string) => void;
};

/** What the reader is told when a request is refused or the analysis fails. */
export const RUN_ERROR_MESSAGES: Record<RunErrorCode, string> = {
  bad_request: "Redline couldn't read that request. Reload the page and try again.",
  empty_text: "There's no contract text to check. Choose a file or paste the text first.",
  text_too_long: `That's longer than Redline reads in one go (${MAX_DOCUMENT_CHARS.toLocaleString("en-US")} characters).`,
  not_normalised:
    "The text Redline received doesn't match the text you were shown, so it hasn't checked it. Reload the page and try again.",
  missing_party: "Type which party you are before Redline checks the contract.",
  party_too_long: `Keep your party to ${MAX_PARTY_CHARS} characters or fewer.`,
  model_unavailable: "Redline can't check contracts right now. Nothing was saved. Try again later.",
  analysis_failed:
    "Redline couldn't finish reading this contract. It shows a result only when the whole check finishes. Nothing was saved. Try again in a minute.",
};

function refuse(status: number, code: RunErrorCode): RunOutcome {
  return { ok: false, status, error: { code, message: RUN_ERROR_MESSAGES[code] } };
}

/** The document's title for now: its first line, cut to MAX_TITLE_CHARS. */
export function titleFromText(text: string): string {
  const firstLine = text.split("\n", 1)[0].trim();
  if (firstLine.length <= MAX_TITLE_CHARS) return firstLine;
  return firstLine.slice(0, MAX_TITLE_CHARS).trimEnd();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Runs one check. Everything that can be refused is refused before the model is called. Nothing
 * is stored unless the analysis succeeded and a store was given.
 */
export async function runAnalysis(body: unknown, deps: RunDeps): Promise<RunOutcome> {
  if (!isRecord(body)) return refuse(400, "bad_request");
  const { text, party } = body;
  if (typeof text !== "string" || typeof party !== "string") {
    if (typeof text === "string" && party === undefined) return refuse(400, "missing_party");
    return refuse(400, "bad_request");
  }

  if (text.trim() === "") return refuse(400, "empty_text");
  if (text.length > MAX_DOCUMENT_CHARS) return refuse(413, "text_too_long");
  // Defence in depth: the browser normalised this already. If normalising again changes it, what
  // would be stored is not exactly what the reader was shown, so refuse rather than fix it up.
  if (normaliseText(text) !== text) return refuse(400, "not_normalised");

  const readerParty = party.trim();
  if (readerParty === "") return refuse(400, "missing_party");
  if (readerParty.length > MAX_PARTY_CHARS) return refuse(400, "party_too_long");

  if (!deps.model) return refuse(503, "model_unavailable");

  const result = await analyse({ text, party: readerParty, redLines: deps.redLines }, { model: deps.model });
  if (!result.ok) {
    deps.log?.(`analysis failed (${result.error.kind}): ${result.error.message}`);
    return refuse(502, "analysis_failed");
  }

  const checked = deps.redLines.filter((redLine) => result.checkedRedLineIds.includes(redLine.id));
  const uniqueChecked = checked.filter((redLine, i) => checked.findIndex((r) => r.id === redLine.id) === i);
  const title = titleFromText(text);

  let saved: SavedState = { kind: "not_kept" };
  if (deps.store) {
    try {
      const documentId = await deps.store.save({
        title,
        storedText: text,
        party: readerParty,
        redLinesSnapshot: uniqueChecked,
        flags: result.flags,
      });
      saved = { kind: "saved", documentId };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      deps.log?.(`saving the analysis failed: ${detail}`);
      saved = { kind: "save_failed" };
    }
  }

  return {
    ok: true,
    title,
    party: readerParty,
    flags: result.flags,
    checkedRedLines: uniqueChecked.map(({ id, title: redLineTitle }) => ({ id, title: redLineTitle })),
    saved,
    diagnostics: result.diagnostics,
  };
}
