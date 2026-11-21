// One question from the question box, end to end (ticket 11, stories 36 to 41).
//
// askAboutStoredDocument: a signed-in reader asks about one of their saved documents. The text and
// party come from the store, read as that reader under row-level security, never from the request.
// The question and its result are stored together and returned.
//
// askAboutUnsavedText: a reader on /check with nothing saved (signed out, or accounts not open)
// sends the text they were shown, their party and the question. The text is checked exactly as
// /api/analyse checks it, the question is answered, and nothing is stored (BUILD-REPORT.md B3, B14).
//
// A model failure stores nothing and is reported as an error, never as "does not say".
//
// Reading stored questions back checks every answered row's citation against the stored text at
// its offset again. A row that no longer verifies is shown as "does not say", never with its
// citation (ADR-0001).
//
// The model client and the store are injected, so this runs in tests with the fake model and
// PGlite. It must not import server-only code; lib/server/question-store.ts is the Supabase store.

import { normaliseText } from "../intake/normalise.ts";
import { MAX_DOCUMENT_CHARS } from "../intake/text-file.ts";
import { answer, checkQuestion, MAX_QUESTION_CHARS, type AnswerDiagnostics, type QuestionAnswer } from "./answer.ts";
import type { ModelClient } from "./model.ts";
import { checkParty, RUN_ERROR_MESSAGES } from "./run.ts";
import { isVerbatimAt } from "./stored.ts";

/** A question as the question box shows it. */
export type AskedQuestion = {
  /** The stored row's id; absent when nothing was stored. */
  id?: string;
  question: string;
  /** The party the question was answered for. */
  party: string;
  /** When it was asked, as an ISO 8601 string; absent when nothing was stored. */
  createdAt?: string;
  result: QuestionAnswer;
};

export type QuestionDocument = { id: string; storedText: string; party: string };

/** What is stored for one answered question. */
export type QuestionRecord = { documentId: string; question: string; party: string; result: QuestionAnswer };

/** One row of public.questions (supabase/migrations/0007). */
export type QuestionRow = {
  id: string;
  question: string;
  party: string;
  kind: string;
  answer: string | null;
  citation: string | null;
  citation_offset: number | null;
  created_at: string | Date;
};

/** A signed-in reader's questions, read and written as that reader. */
export interface QuestionStore {
  /** The document's stored text and current party, or null when the reader can't see it. */
  loadDocument(documentId: string): Promise<QuestionDocument | null>;
  /** Stores one question with its result and returns the stored row. Throws when nothing was written. */
  save(record: QuestionRecord): Promise<QuestionRow>;
  /** Every question on the document the reader can see. */
  list(documentId: string): Promise<QuestionRow[]>;
}

export type AskErrorCode =
  | "bad_request"
  | "empty_question"
  | "question_too_long"
  | "empty_text"
  | "text_too_long"
  | "not_normalised"
  | "missing_party"
  | "party_too_long"
  | "not_found"
  | "load_failed"
  | "model_unavailable"
  | "answer_failed";

export type AskOutcome =
  | {
      ok: true;
      asked: AskedQuestion;
      /** "kept": stored with the document. "not_kept": nothing stored. "save_failed": answered but not stored. */
      kept: "kept" | "not_kept" | "save_failed";
      /** For logs and the smoke script. Never shown. */
      diagnostics: AnswerDiagnostics;
    }
  | { ok: false; status: number; error: { code: AskErrorCode; message: string } };

export type AskDeps = {
  /** Null when the model is not configured. */
  model: ModelClient | null;
  /** Where a failure is reported for the operator. Never receives document text, questions or the key. */
  log?: (message: string) => void;
};

/** What the reader is told when a question is refused or can't be answered. */
export const ASK_ERROR_MESSAGES: Record<AskErrorCode, string> = {
  bad_request: RUN_ERROR_MESSAGES.bad_request,
  empty_question: "Type a question first.",
  question_too_long: `Keep your question to ${MAX_QUESTION_CHARS} characters or fewer.`,
  empty_text: RUN_ERROR_MESSAGES.empty_text,
  text_too_long: RUN_ERROR_MESSAGES.text_too_long,
  not_normalised:
    "The text Redline received doesn't match the text you were shown, so it hasn't answered. Reload the page and try again.",
  missing_party: RUN_ERROR_MESSAGES.missing_party,
  party_too_long: RUN_ERROR_MESSAGES.party_too_long,
  not_found: "Redline can't find this contract in your account.",
  load_failed: "Redline couldn't open this contract, so it hasn't answered. Try again in a minute.",
  model_unavailable: "Redline can't answer questions right now. Try again later.",
  answer_failed: "Redline couldn't finish answering that question. Nothing was saved. Try again in a minute.",
};

function refuse(status: number, code: AskErrorCode): AskOutcome {
  return { ok: false, status, error: { code, message: ASK_ERROR_MESSAGES[code] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function iso(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

/**
 * A stored row as the question box shows it. An answered row is shown answered only when its
 * citation still sits verbatim in the stored text at its offset; otherwise "does not say".
 * Null for a row whose shape is wrong.
 */
export function toAskedQuestion(row: QuestionRow, storedText: string): AskedQuestion | null {
  if (typeof row.id !== "string" || typeof row.question !== "string" || typeof row.party !== "string") return null;
  let result: QuestionAnswer = { kind: "does_not_say" };
  if (row.kind === "answered") {
    const { answer: text, citation } = row;
    const offset = typeof row.citation_offset === "number" ? row.citation_offset : Number(row.citation_offset);
    if (
      typeof text === "string" &&
      text.trim() !== "" &&
      typeof citation === "string" &&
      isVerbatimAt(storedText, citation, offset)
    ) {
      result = { kind: "answered", answer: text, citation, offset };
    }
  } else if (row.kind !== "does_not_say") {
    return null;
  }
  return { id: row.id, question: row.question, party: row.party, createdAt: iso(row.created_at), result };
}

/** A document's stored questions, newest first, each re-verified against the stored text. */
export async function loadStoredQuestions(
  store: QuestionStore,
  documentId: string,
  storedText: string,
): Promise<AskedQuestion[]> {
  const rows = await store.list(documentId);
  return rows
    .map((row) => toAskedQuestion(row, storedText))
    .filter((q): q is AskedQuestion => q !== null)
    .sort((a, b) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : (a.createdAt ?? "") > (b.createdAt ?? "") ? -1 : 0));
}

async function run(
  input: { text: string; party: string; question: string },
  deps: AskDeps,
): Promise<{ ok: true; result: QuestionAnswer; diagnostics: AnswerDiagnostics } | { ok: false; outcome: AskOutcome }> {
  if (!deps.model) return { ok: false, outcome: refuse(503, "model_unavailable") };
  const outcome = await answer(input, { model: deps.model });
  if (!outcome.ok) {
    deps.log?.(`answering failed (${outcome.error.kind}): ${outcome.error.message}`);
    return { ok: false, outcome: refuse(502, "answer_failed") };
  }
  return outcome;
}

/**
 * Answers a question about a saved document and stores it. The body's `question` is the only field
 * read; a `text` or `party` in it is ignored.
 */
export async function askAboutStoredDocument(
  documentId: string,
  body: unknown,
  deps: AskDeps & { store: QuestionStore },
): Promise<AskOutcome> {
  if (!isRecord(body)) return refuse(400, "bad_request");
  const question = checkQuestion(body.question);
  if (!question.ok) return refuse(400, question.code);

  let document: QuestionDocument | null;
  try {
    document = await deps.store.loadDocument(documentId);
  } catch (error) {
    deps.log?.(`loading the document failed: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(500, "load_failed");
  }
  if (!document) return refuse(404, "not_found");

  const answered = await run({ text: document.storedText, party: document.party, question: question.question }, deps);
  if (!answered.ok) return answered.outcome;

  const asked: AskedQuestion = { question: question.question, party: document.party, result: answered.result };
  try {
    const row = await deps.store.save({
      documentId: document.id,
      question: question.question,
      party: document.party,
      result: answered.result,
    });
    return {
      ok: true,
      asked: { ...asked, id: row.id, createdAt: iso(row.created_at) },
      kept: "kept",
      diagnostics: answered.diagnostics,
    };
  } catch (error) {
    deps.log?.(`saving the question failed: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: true, asked, kept: "save_failed", diagnostics: answered.diagnostics };
  }
}

/**
 * Answers a question about text that is not saved, and stores nothing. The text must be exactly
 * the normalised text the reader was shown, as /api/analyse requires.
 */
export async function askAboutUnsavedText(body: unknown, deps: AskDeps): Promise<AskOutcome> {
  if (!isRecord(body)) return refuse(400, "bad_request");
  const { text, party } = body;
  if (typeof text !== "string") return refuse(400, "bad_request");
  if (text.trim() === "") return refuse(400, "empty_text");
  if (text.length > MAX_DOCUMENT_CHARS) return refuse(413, "text_too_long");
  if (normaliseText(text) !== text) return refuse(400, "not_normalised");

  const checkedParty = checkParty(party);
  if (!checkedParty.ok) return refuse(400, checkedParty.code);

  const question = checkQuestion(body.question);
  if (!question.ok) return refuse(400, question.code);

  const answered = await run({ text, party: checkedParty.party, question: question.question }, deps);
  if (!answered.ok) return answered.outcome;

  return {
    ok: true,
    asked: { question: question.question, party: checkedParty.party, result: answered.result },
    kept: "not_kept",
    diagnostics: answered.diagnostics,
  };
}
