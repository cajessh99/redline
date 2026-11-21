// The question box's half of the analysis boundary (spec, "Analysis boundary"; stories 36 to 41;
// PRD T6; ADR-0001; BUILD-REPORT.md B14).
//
// answer() takes the stored text, the reader's party and one question, and asks the model for an
// answer that rests on one sentence quoted verbatim from the document, or for no answer when the
// document does not contain one. The trust rule is enforced here in code, not left to the prompt:
//
// - an answer with a citation that occurs verbatim in the stored text, and no banned word in the
//   answer, is shown with that citation and its offset;
// - a citation that fails verification, or a banned word in the answer, is sent back once with the
//   failure named, then checked again; anything that still fails becomes "does not say";
// - an answer with no citation, or no answer at all, is "does not say" with no second call.
//
// "Does not say" carries nothing from the model, so a misquote or a rejected answer can never
// reach the reader. A model error or malformed output is an error, never "does not say": the
// reader is told it failed, not that the document is silent.
//
// The module is pure apart from the injected model client. It must not import server-only code.

import { findBannedWord, type BannedWord } from "../copy/banned-words.ts";
import type { AnalysisError } from "./analyse.ts";
import { MalformedModelOutputError, type JsonSchema, type ModelClient } from "./model.ts";
import { verifySourceSentence } from "./verify.ts";

/** The longest question accepted, in characters. A question is a sentence or two. */
export const MAX_QUESTION_CHARS = 500;

/** What the reader sees when the document does not answer the question. Word for word. */
export const DOES_NOT_SAY = "The document does not say.";

export type QuestionInput = {
  /** The stored (normalised) document text. */
  text: string;
  /** The reader's side, as the reader chose it. */
  party: string;
  question: string;
};

export type AnswerDeps = { model: ModelClient };

/** A shown answer. "answered" always carries a citation verbatim at `offset` in the stored text. */
export type QuestionAnswer =
  | { kind: "answered"; answer: string; citation: string; offset: number }
  | { kind: "does_not_say" };

export type AnswerErrorKind = AnalysisError["kind"] | "empty_question" | "question_too_long";

export type AnswerError = { kind: AnswerErrorKind; message: string };

/** Counts from one call, for logs and the smoke script. Never shown to readers; carries no text. */
export type AnswerDiagnostics = {
  /** Model calls made: 1, or 2 when the first answer was sent back. */
  calls: number;
  /** Why the first answer was sent back, when it was. */
  regeneratedFor: "not_verbatim" | "banned_word" | null;
  /** Why the result is "does not say", when it is. */
  doesNotSayBecause: "no_answer" | "no_citation" | "failed_after_regeneration" | null;
};

export type AnswerOutcome =
  | { ok: true; result: QuestionAnswer; diagnostics: AnswerDiagnostics }
  | { ok: false; error: AnswerError };

/**
 * The question as it is asked and stored: trimmed, non-empty, at most MAX_QUESTION_CHARS. Refused
 * otherwise, before any model call.
 */
export function checkQuestion(
  question: unknown,
): { ok: true; question: string } | { ok: false; code: "empty_question" | "question_too_long" | "bad_request" } {
  if (question === undefined || question === null) return { ok: false, code: "empty_question" };
  if (typeof question !== "string") return { ok: false, code: "bad_request" };
  const trimmed = question.trim();
  if (trimmed === "") return { ok: false, code: "empty_question" };
  if (trimmed.length > MAX_QUESTION_CHARS) return { ok: false, code: "question_too_long" };
  return { ok: true, question: trimmed };
}

// ---------------------------------------------------------------------------------------------
// Schema and prompts

const answerSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "citation"],
  properties: {
    answer: { type: ["string", "null"] },
    citation: { type: ["string", "null"] },
  },
};

function systemPrompt(party: string): string {
  const reader = JSON.stringify(party);
  return [
    `You answer one question about a contract for one party to it, ${reader}, called the reader's party.`,
    `Read the question from ${reader}'s side: "I", "me", "my" and "we" mean ${reader}.`,
    "Answer only from the document text you are given. Use no outside knowledge of law, markets, industries or common practice.",
    "answer is one or two plain declarative sentences that state only what the document says. No hedging. Never use these words: safe, standard, normal, unusual, clean, no issues, might, may, could possibly.",
    "citation is the one sentence the answer rests on, copied verbatim from the document, character for character, with the same punctuation, quotation marks, capitalisation and spacing. Do not paraphrase, shorten, join or tidy it.",
    "When the document does not contain the answer, set both answer and citation to null. That includes questions about whether a term is normal, standard, common, fair or reasonable; whether it is enforceable or legal anywhere, including where the reader lives; what the reader should do; and anything else that needs knowledge from outside the document.",
    "When in doubt, set both to null.",
    "Answer with JSON that follows the schema.",
  ].join("\n");
}

function userPrompt(input: QuestionInput): string {
  return [
    `The reader's party: ${input.party}`,
    `The question: ${input.question}`,
    "",
    "Document text, in full, between the markers:",
    "<<<DOCUMENT",
    input.text,
    "DOCUMENT>>>",
  ].join("\n");
}

type Failure = { kind: "not_verbatim" } | { kind: "banned_word"; word: BannedWord };

function regenerationPrompt(input: QuestionInput, previous: Reply, failure: Failure): string {
  const why =
    failure.kind === "banned_word"
      ? `the answer uses the banned word "${failure.word}"`
      : "the citation was not found verbatim in the document";
  return [
    userPrompt(input),
    "",
    "Your previous reply failed the check.",
    `Previous answer: ${JSON.stringify(previous.answer)}`,
    `Previous citation: ${JSON.stringify(previous.citation)}`,
    `Why it failed: ${why}.`,
    "",
    "Answer the question again. Copy the citation verbatim from the document and keep the answer free of the banned words. If the document does not contain the answer, set both answer and citation to null.",
  ].join("\n");
}

// ---------------------------------------------------------------------------------------------
// Output validation (hand-written; BUILD-REPORT.md B1 adds no schema validator)

type Reply = { answer: string | null; citation: string | null };

class OutputShapeError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(record: Record<string, unknown>, field: string): string | null {
  if (!(field in record)) throw new OutputShapeError(`${field} is missing`);
  const value = record[field];
  if (value !== null && typeof value !== "string") throw new OutputShapeError(`${field} is not a string or null`);
  return value;
}

function parseReply(value: unknown): Reply {
  if (!isRecord(value)) throw new OutputShapeError("output is not an object");
  const answer = stringOrNull(value, "answer");
  const citation = stringOrNull(value, "citation");
  // An empty or blank string says nothing; it counts as absent.
  return {
    answer: answer === null || answer.trim() === "" ? null : answer,
    citation: citation === null || citation.trim() === "" ? null : citation,
  };
}

async function callModel(
  model: ModelClient,
  request: Parameters<ModelClient["completeJson"]>[0],
): Promise<{ ok: true; reply: Reply } | { ok: false; error: AnswerError }> {
  let raw: unknown;
  try {
    raw = await model.completeJson(request);
  } catch (error) {
    if (error instanceof MalformedModelOutputError) {
      return { ok: false, error: { kind: "malformed_output", message: error.message } };
    }
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, error: { kind: "model_failed", message: `The model call failed: ${detail}` } };
  }
  try {
    return { ok: true, reply: parseReply(raw) };
  } catch (error) {
    if (error instanceof OutputShapeError) {
      return { ok: false, error: { kind: "malformed_output", message: `Model output has the wrong shape: ${error.message}` } };
    }
    throw error;
  }
}

type Check =
  | { kind: "answered"; answer: QuestionAnswer & { kind: "answered" } }
  | { kind: "no_answer" }
  | { kind: "no_citation" }
  | { kind: "failed"; failure: Failure };

function check(text: string, reply: Reply): Check {
  if (reply.answer === null) return { kind: "no_answer" };
  if (reply.citation === null) return { kind: "no_citation" };
  const verified = verifySourceSentence(text, reply.citation);
  if (!verified.ok) return { kind: "failed", failure: { kind: "not_verbatim" } };
  const word = findBannedWord(reply.answer);
  if (word) return { kind: "failed", failure: { kind: "banned_word", word } };
  return {
    kind: "answered",
    answer: { kind: "answered", answer: reply.answer, citation: reply.citation, offset: verified.offset },
  };
}

const DOES_NOT_SAY_RESULT: QuestionAnswer = { kind: "does_not_say" };

/**
 * Answers one question from the document. Returns an answer with a verified citation, or "does not
 * say"; returns an error when the question is refused or the model fails.
 */
export async function answer(input: QuestionInput, deps: AnswerDeps): Promise<AnswerOutcome> {
  const checked = checkQuestion(input.question);
  if (!checked.ok) {
    const kind = checked.code === "question_too_long" ? "question_too_long" : "empty_question";
    return { ok: false, error: { kind, message: kind === "question_too_long" ? "The question is too long." : "The question is empty." } };
  }
  const question: QuestionInput = { ...input, question: checked.question };
  const metadata = { party: input.party, question: checked.question };
  const diagnostics: AnswerDiagnostics = { calls: 1, regeneratedFor: null, doesNotSayBecause: null };

  const first = await callModel(deps.model, {
    system: systemPrompt(input.party),
    user: userPrompt(question),
    schemaName: "redline_answer",
    jsonSchema: answerSchema,
    metadata,
  });
  if (!first.ok) return first;

  const firstCheck = check(input.text, first.reply);
  if (firstCheck.kind === "answered") return { ok: true, result: firstCheck.answer, diagnostics };
  if (firstCheck.kind === "no_answer" || firstCheck.kind === "no_citation") {
    diagnostics.doesNotSayBecause = firstCheck.kind;
    return { ok: true, result: DOES_NOT_SAY_RESULT, diagnostics };
  }

  // One regeneration, naming the failure.
  diagnostics.calls = 2;
  diagnostics.regeneratedFor = firstCheck.failure.kind;
  const second = await callModel(deps.model, {
    system: systemPrompt(input.party),
    user: regenerationPrompt(question, first.reply, firstCheck.failure),
    schemaName: "redline_answer",
    jsonSchema: answerSchema,
    metadata,
  });
  if (!second.ok) return second;

  const secondCheck = check(input.text, second.reply);
  if (secondCheck.kind === "answered") return { ok: true, result: secondCheck.answer, diagnostics };
  diagnostics.doesNotSayBecause =
    secondCheck.kind === "failed" ? "failed_after_regeneration" : secondCheck.kind;
  return { ok: true, result: DOES_NOT_SAY_RESULT, diagnostics };
}
