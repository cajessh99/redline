// The analysis boundary (spec, "Analysis boundary (seam 1, server side)"; ADR-0001; D7, D8, D9).
//
// analyse() takes the stored text, the reader's party, and the enabled red lines (the whole
// rulebook for the run), asks the model for candidate matches, and returns only flags whose source
// sentence occurs verbatim in the stored text. A candidate that fails verification, or whose
// statement uses a banned word (BUILD-REPORT.md B10), is sent back once for regeneration with the
// failure named, and dropped if it fails again.
//
// Every enabled red line with no surviving flag gets one receipt line (D9, T4): the sentence that
// addresses the red line's subject, verified the same way as a flag's source, or "not mentioned".
// An addressing sentence that fails verification goes into the same single regeneration call; if
// it fails again the line becomes "not mentioned" and the unverified sentence is discarded.
//
// A model error or malformed output fails the whole run with no partial flags or receipt.
//
// The module is pure apart from the injected model client. It must not import server-only code,
// so tests and Node scripts can import it directly.

import { findBannedWord, type BannedWord } from "../copy/banned-words.ts";
import { TIERS, type RedLine, type Tier } from "../red-lines/defaults.ts";
import { MalformedModelOutputError, type JsonSchema, type ModelClient } from "./model.ts";
import { verifySourceSentence } from "./verify.ts";

export type AnalysisInput = {
  /** The stored (normalised) document text. */
  text: string;
  /** The reader's side, as the reader chose it (never inferred). */
  party: string;
  /** The enabled red lines. They are the whole rulebook for this run. */
  redLines: RedLine[];
};

export type AnalysisDeps = { model: ModelClient };

export type Flag = {
  redLineId: string;
  redLineTitle: string;
  tier: Tier;
  /** One plain declarative sentence on what the clause does to the reader's party. */
  statement: string;
  /** Verbatim from the stored text: text.slice(offset, offset + sourceSentence.length). */
  sourceSentence: string;
  /** Character offset of the first occurrence of sourceSentence in the stored text. */
  offset: number;
  counterOffer: string;
};

/**
 * One line of the receipt: an enabled red line with no surviving flag. "addressed" carries the
 * sentence that deals with the red line's subject, verbatim at `offset` in the stored text.
 * "not_mentioned" means the model found no sentence on the subject (the one claim that rests on
 * the model alone; spec, Further Notes).
 */
export type ReceiptLine =
  | { redLineId: string; redLineTitle: string; kind: "addressed"; sentence: string; offset: number }
  | { redLineId: string; redLineTitle: string; kind: "not_mentioned" };

export type AnalysisErrorKind = "model_failed" | "malformed_output";

export type AnalysisError = { kind: AnalysisErrorKind; message: string };

/**
 * Counts from one run, for the smoke script and logs. Never shown to readers.
 *
 * Candidates (each first-pass candidate has exactly one fate):
 * - candidates: first-pass candidates for enabled red lines.
 * - verifiedFirstPass: passed the source and banned-word checks first time.
 * - regenerated: failed first time and were sent back once (one correction asked for each).
 * - verifiedAfterRegeneration: of those, how many came back corrected and passed.
 * - dropped: of those, how many came back failing again, or did not come back.
 *   candidates = verifiedFirstPass + verifiedAfterRegeneration + dropped
 *   regenerated = verifiedAfterRegeneration + dropped
 * - extrasIgnored: extra matches returned for one correction; never checked, never shown.
 * - duplicates: verified candidates that repeat a flag already kept (same red line and offset).
 * - flags: flags returned. flags = verifiedFirstPass + verifiedAfterRegeneration - duplicates
 *
 * Addressing sentences (only for red lines with no first-pass flag; same accounting):
 * - addressing: non-null addressing sentences checked.
 *   addressing = addressingVerifiedFirstPass + addressingVerifiedAfterRegeneration + addressingDropped
 *   addressingRegenerated = addressingVerifiedAfterRegeneration + addressingDropped
 *
 * Receipt: receiptAddressed + receiptNotMentioned = enabled red lines with no flag.
 */
export type AnalysisDiagnostics = {
  candidates: number;
  verifiedFirstPass: number;
  regenerated: number;
  verifiedAfterRegeneration: number;
  dropped: number;
  extrasIgnored: number;
  duplicates: number;
  flags: number;
  addressing: number;
  addressingVerifiedFirstPass: number;
  addressingRegenerated: number;
  addressingVerifiedAfterRegeneration: number;
  addressingDropped: number;
  receiptAddressed: number;
  receiptNotMentioned: number;
};

export type AnalysisResult =
  | {
      ok: true;
      flags: Flag[];
      receipt: ReceiptLine[];
      checkedRedLineIds: string[];
      diagnostics: AnalysisDiagnostics;
    }
  | { ok: false; error: AnalysisError };

// ---------------------------------------------------------------------------------------------
// Model output types (internal)

type Candidate = {
  tier: Tier;
  statement: string;
  sourceSentence: string;
  counterOffer: string;
};

type CandidateEntry = {
  redLineId: string;
  matches: Candidate[];
  addressingSentence: string | null;
};

type FailureProblem =
  | { kind: "not_verbatim" }
  | { kind: "empty_source" }
  | { kind: "banned_word"; word: BannedWord };

type CandidateFailure = {
  /** `${redLineId}#${n}`, n counting this red line's failures from 1 in first-pass order. */
  failureId: string;
  redLineId: string;
  candidate: Candidate;
  problem: FailureProblem;
};

type AddressingFailure = { redLineId: string; sentence: string };

type CheckOutcome = { ok: true; flag: Flag } | { ok: false; problem: FailureProblem };

type Regeneration = {
  /** First correction per failure id; null when the model returned no match for it. */
  corrections: Map<string, Candidate | null>;
  extrasIgnored: number;
  /** First addressing answer per red line id. */
  addressing: Map<string, string | null>;
};

class OutputShapeError extends Error {}

// ---------------------------------------------------------------------------------------------
// Schemas

const matchSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tier", "statement", "sourceSentence", "counterOffer"],
  properties: {
    tier: { type: "string", enum: [...TIERS] },
    statement: { type: "string" },
    sourceSentence: { type: "string" },
    counterOffer: { type: "string" },
  },
};

function analysisSchema(redLineIds: string[]): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["redLines"],
    properties: {
      redLines: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["redLineId", "matches", "addressingSentence"],
          properties: {
            redLineId: { type: "string", enum: redLineIds },
            matches: { type: "array", items: matchSchema },
            addressingSentence: { type: ["string", "null"] },
          },
        },
      },
    },
  };
}

/** Asks only for what failed: one correction per failed candidate, one answer per failed addressing sentence. */
function regenerationSchema(failureIds: string[], addressingIds: string[]): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  if (failureIds.length > 0) {
    properties.corrections = {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["failureId", "matches"],
        properties: {
          failureId: { type: "string", enum: failureIds },
          matches: { type: "array", items: matchSchema },
        },
      },
    };
  }
  if (addressingIds.length > 0) {
    properties.addressing = {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["redLineId", "addressingSentence"],
        properties: {
          redLineId: { type: "string", enum: addressingIds },
          addressingSentence: { type: ["string", "null"] },
        },
      },
    };
  }
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
}

// ---------------------------------------------------------------------------------------------
// Prompts

const ADDRESSING_RULE =
  "addressingSentence is one sentence copied verbatim from the document, character for character, that deals with the red line's subject, or null when no sentence in the document deals with it. Never invent or tidy a sentence; when in doubt, use null.";

function systemPrompt(party: string): string {
  const reader = JSON.stringify(party);
  return [
    "You read a contract for one party to it, called the reader's party, and find clauses that match the reader's red lines.",
    "The red lines you are given are the whole rulebook. Match nothing that is not described by one of them, and flag only clauses that work against the reader's party.",
    "Return only matches you are certain of. Omit anything doubtful. There is no confidence field: doubt is expressed by leaving a match out.",
    "For each match:",
    "- tier is one of the tiers the red line describes: Severe, Moderate or Minor.",
    "- sourceSentence is one sentence copied verbatim from the document, character for character, with the same punctuation, quotation marks, capitalisation and spacing. Do not paraphrase, shorten, join or tidy it.",
    "- statement is one plain declarative sentence saying what the clause does to the reader's party. No hedging. Never use these words: safe, standard, normal, unusual, clean, no issues, might, may, could possibly.",
    `- counterOffer is replacement wording for that one sentence only, for ${reader} to propose, changing the sentence in ${reader}'s favour. It states no fact about the parties, the law or the market that the sentence does not contain, and never says anything is normal, standard, customary or required by law. Use a number only in place of a number in the sentence (proposing 30 days instead of 75 days is fine).`,
    `For every red line, whether or not it has a match, also give addressingSentence. ${ADDRESSING_RULE}`,
    "Never judge whether a clause is normal, standard or common, and make no legal claims. State only what the document says.",
    "Answer with JSON that follows the schema.",
  ].join("\n");
}

function describeRedLine(redLine: RedLine): string {
  const tiers = TIERS.filter((tier) => redLine.tiers[tier])
    .map((tier) => `  - ${tier}: ${redLine.tiers[tier]}`)
    .join("\n");
  return [
    `Red line id: ${redLine.id}`,
    `Title: ${redLine.title}`,
    `What matches: ${redLine.description}`,
    "Tiers:",
    tiers,
  ].join("\n");
}

function userPrompt(input: AnalysisInput, redLines: RedLine[]): string {
  return [
    `The reader's party: ${input.party}`,
    "",
    "Red lines:",
    redLines.map(describeRedLine).join("\n\n"),
    "",
    "Document text, in full, between the markers:",
    "<<<DOCUMENT",
    input.text,
    "DOCUMENT>>>",
  ].join("\n");
}

function describeFailure(failure: CandidateFailure): string {
  const why =
    failure.problem.kind === "banned_word"
      ? `the statement uses the banned word "${failure.problem.word}"`
      : failure.problem.kind === "empty_source"
        ? "the source sentence is empty"
        : "the source sentence was not found verbatim in the document";
  return [
    `Failure id: ${failure.failureId}`,
    `Red line id: ${failure.redLineId}`,
    `Quoted source sentence: ${JSON.stringify(failure.candidate.sourceSentence)}`,
    `Statement: ${JSON.stringify(failure.candidate.statement)}`,
    `Why it failed: ${why}.`,
  ].join("\n");
}

function describeAddressingFailure(failure: AddressingFailure): string {
  return [
    `Red line id: ${failure.redLineId}`,
    `Quoted addressing sentence: ${JSON.stringify(failure.sentence)}`,
    "Why it failed: the sentence was not found verbatim in the document.",
  ].join("\n");
}

function regenerationPrompt(
  input: AnalysisInput,
  redLines: RedLine[],
  failures: CandidateFailure[],
  addressingFailures: AddressingFailure[],
): string {
  const parts = [userPrompt(input, redLines), ""];
  if (failures.length > 0) {
    parts.push(
      "Your previous answer contained candidates that failed the check. Each is listed below with its failure id and the reason.",
      failures.map(describeFailure).join("\n\n"),
      "",
      "In corrections, give one entry per failure id. Its matches list holds at most one corrected candidate for that failure: copy the source sentence verbatim from the document and keep the statement free of the banned words. If you cannot give a corrected candidate you are certain of, return an empty matches list. Do not add candidates that were not asked for.",
      "",
    );
  }
  if (addressingFailures.length > 0) {
    parts.push(
      "Your previous answer contained addressing sentences that failed the check. Each is listed below.",
      addressingFailures.map(describeAddressingFailure).join("\n\n"),
      "",
      `In addressing, give one entry per red line id listed here. ${ADDRESSING_RULE}`,
    );
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------------------------
// Output validation (hand-written; BUILD-REPORT.md B1 adds no schema validator)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(record: Record<string, unknown>, field: string, path: string): string {
  const value = record[field];
  if (typeof value !== "string") throw new OutputShapeError(`${path}.${field} is missing or not a string`);
  if (value.trim() === "") throw new OutputShapeError(`${path}.${field} is empty`);
  return value;
}

function stringOrNull(record: Record<string, unknown>, field: string, path: string): string | null {
  const value = record[field];
  if (value !== null && typeof value !== "string") {
    throw new OutputShapeError(`${path}.${field} is missing or not a string or null`);
  }
  return value;
}

function parseCandidate(value: unknown, path: string): Candidate {
  if (!isRecord(value)) throw new OutputShapeError(`${path} is not an object`);
  const tier = value.tier;
  if (typeof tier !== "string" || !(TIERS as readonly string[]).includes(tier)) {
    throw new OutputShapeError(`${path}.tier is ${JSON.stringify(tier)}, not Severe, Moderate or Minor`);
  }
  return {
    tier: tier as Tier,
    statement: requiredText(value, "statement", path),
    sourceSentence: requiredText(value, "sourceSentence", path),
    counterOffer: requiredText(value, "counterOffer", path),
  };
}

function parseMatches(entry: Record<string, unknown>, path: string): Candidate[] {
  if (!Array.isArray(entry.matches)) throw new OutputShapeError(`${path}.matches is missing or not an array`);
  return entry.matches.map((match, j) => parseCandidate(match, `${path}.matches[${j}]`));
}

function parseOutput(value: unknown): CandidateEntry[] {
  if (!isRecord(value)) throw new OutputShapeError("output is not an object");
  const redLines = value.redLines;
  if (!Array.isArray(redLines)) throw new OutputShapeError("redLines is missing or not an array");

  return redLines.map((entry, i): CandidateEntry => {
    const path = `redLines[${i}]`;
    if (!isRecord(entry)) throw new OutputShapeError(`${path} is not an object`);
    return {
      redLineId: requiredText(entry, "redLineId", path),
      matches: parseMatches(entry, path),
      addressingSentence: stringOrNull(entry, "addressingSentence", path),
    };
  });
}

function parseRegeneration(value: unknown, askedCorrections: boolean, askedAddressing: boolean): Regeneration {
  if (!isRecord(value)) throw new OutputShapeError("output is not an object");
  const result: Regeneration = { corrections: new Map(), extrasIgnored: 0, addressing: new Map() };

  if (askedCorrections) {
    const corrections = value.corrections;
    if (!Array.isArray(corrections)) throw new OutputShapeError("corrections is missing or not an array");
    corrections.forEach((entry, i) => {
      const path = `corrections[${i}]`;
      if (!isRecord(entry)) throw new OutputShapeError(`${path} is not an object`);
      const failureId = requiredText(entry, "failureId", path);
      const matches = parseMatches(entry, path);
      if (result.corrections.has(failureId)) {
        result.extrasIgnored += matches.length;
        return;
      }
      result.corrections.set(failureId, matches[0] ?? null);
      result.extrasIgnored += Math.max(0, matches.length - 1);
    });
  }

  if (askedAddressing) {
    const addressing = value.addressing;
    if (!Array.isArray(addressing)) throw new OutputShapeError("addressing is missing or not an array");
    addressing.forEach((entry, i) => {
      const path = `addressing[${i}]`;
      if (!isRecord(entry)) throw new OutputShapeError(`${path} is not an object`);
      const redLineId = requiredText(entry, "redLineId", path);
      const sentence = stringOrNull(entry, "addressingSentence", path);
      if (!result.addressing.has(redLineId)) result.addressing.set(redLineId, sentence);
    });
  }

  return result;
}

// ---------------------------------------------------------------------------------------------
// The run

type CallResult<T> = { ok: true; value: T } | { ok: false; error: AnalysisError };

async function callModel<T>(
  model: ModelClient,
  request: Parameters<ModelClient["completeJson"]>[0],
  parse: (raw: unknown) => T,
): Promise<CallResult<T>> {
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
    return { ok: true, value: parse(raw) };
  } catch (error) {
    if (error instanceof OutputShapeError) {
      return {
        ok: false,
        error: { kind: "malformed_output", message: `Model output has the wrong shape: ${error.message}` },
      };
    }
    throw error;
  }
}

function checkCandidate(text: string, redLine: RedLine, candidate: Candidate): CheckOutcome {
  const verified = verifySourceSentence(text, candidate.sourceSentence);
  if (!verified.ok) {
    return { ok: false, problem: { kind: verified.reason === "empty" ? "empty_source" : "not_verbatim" } };
  }
  const word = findBannedWord(candidate.statement);
  if (word) return { ok: false, problem: { kind: "banned_word", word } };
  return {
    ok: true,
    flag: {
      redLineId: redLine.id,
      redLineTitle: redLine.title,
      tier: candidate.tier,
      statement: candidate.statement,
      sourceSentence: candidate.sourceSentence,
      offset: verified.offset,
      counterOffer: candidate.counterOffer,
    },
  };
}

function orderFlags(flags: Flag[], redLineOrder: string[]): { flags: Flag[]; duplicates: number } {
  const seen = new Set<string>();
  const unique = flags.filter((flag) => {
    const key = `${flag.redLineId}\u0000${flag.offset}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort(
    (a, b) =>
      TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) ||
      a.offset - b.offset ||
      redLineOrder.indexOf(a.redLineId) - redLineOrder.indexOf(b.redLineId),
  );
  return { flags: unique, duplicates: flags.length - unique.length };
}

function emptyDiagnostics(): AnalysisDiagnostics {
  return {
    candidates: 0,
    verifiedFirstPass: 0,
    regenerated: 0,
    verifiedAfterRegeneration: 0,
    dropped: 0,
    extrasIgnored: 0,
    duplicates: 0,
    flags: 0,
    addressing: 0,
    addressingVerifiedFirstPass: 0,
    addressingRegenerated: 0,
    addressingVerifiedAfterRegeneration: 0,
    addressingDropped: 0,
    receiptAddressed: 0,
    receiptNotMentioned: 0,
  };
}

/**
 * Runs one analysis. Returns verified flags ordered Severe, Moderate, Minor, then by position in
 * the document, and one receipt line for each enabled red line with no flag, in the order of the
 * enabled list. Returns an error with neither when the model fails or returns malformed output.
 */
export async function analyse(input: AnalysisInput, deps: AnalysisDeps): Promise<AnalysisResult> {
  const enabled = new Map<string, RedLine>();
  for (const redLine of input.redLines) {
    if (!enabled.has(redLine.id)) enabled.set(redLine.id, redLine);
  }
  const redLines = [...enabled.values()];
  const checkedRedLineIds = redLines.map((redLine) => redLine.id);
  const diagnostics = emptyDiagnostics();
  if (redLines.length === 0) {
    return { ok: true, flags: [], receipt: [], checkedRedLineIds, diagnostics };
  }

  const first = await callModel(
    deps.model,
    {
      system: systemPrompt(input.party),
      user: userPrompt(input, redLines),
      schemaName: "redline_analysis",
      jsonSchema: analysisSchema(checkedRedLineIds),
    },
    parseOutput,
  );
  if (!first.ok) return first;

  // Candidates, first pass.
  const kept: Flag[] = [];
  const failures: CandidateFailure[] = [];
  const failuresPerRedLine = new Map<string, number>();
  const firstAddressing = new Map<string, string>();
  for (const entry of first.value) {
    const redLine = enabled.get(entry.redLineId);
    if (!redLine) continue;
    if (entry.addressingSentence !== null && !firstAddressing.has(redLine.id)) {
      firstAddressing.set(redLine.id, entry.addressingSentence);
    }
    for (const candidate of entry.matches) {
      diagnostics.candidates++;
      const outcome = checkCandidate(input.text, redLine, candidate);
      if (outcome.ok) {
        kept.push(outcome.flag);
        diagnostics.verifiedFirstPass++;
        continue;
      }
      const n = (failuresPerRedLine.get(redLine.id) ?? 0) + 1;
      failuresPerRedLine.set(redLine.id, n);
      failures.push({ failureId: `${redLine.id}#${n}`, redLineId: redLine.id, candidate, problem: outcome.problem });
    }
  }

  // Addressing sentences, first pass: only red lines that have no flag yet can need one.
  const flaggedFirstPass = new Set(kept.map((flag) => flag.redLineId));
  const addressed = new Map<string, { sentence: string; offset: number }>();
  const addressingFailures: AddressingFailure[] = [];
  for (const redLine of redLines) {
    if (flaggedFirstPass.has(redLine.id)) continue;
    const sentence = firstAddressing.get(redLine.id);
    if (sentence === undefined) continue;
    diagnostics.addressing++;
    const verified = verifySourceSentence(input.text, sentence);
    if (verified.ok) {
      addressed.set(redLine.id, { sentence, offset: verified.offset });
      diagnostics.addressingVerifiedFirstPass++;
    } else {
      addressingFailures.push({ redLineId: redLine.id, sentence });
    }
  }

  // One regeneration call for everything that failed.
  diagnostics.regenerated = failures.length;
  diagnostics.addressingRegenerated = addressingFailures.length;
  if (failures.length > 0 || addressingFailures.length > 0) {
    const failureIds = failures.map((failure) => failure.failureId);
    const addressingIds = addressingFailures.map((failure) => failure.redLineId);
    const involved = new Set([...failures.map((f) => f.redLineId), ...addressingIds]);
    const second = await callModel(
      deps.model,
      {
        system: systemPrompt(input.party),
        user: regenerationPrompt(
          input,
          redLines.filter((redLine) => involved.has(redLine.id)),
          failures,
          addressingFailures,
        ),
        schemaName: "redline_regeneration",
        jsonSchema: regenerationSchema(failureIds, addressingIds),
      },
      (raw) => parseRegeneration(raw, failureIds.length > 0, addressingIds.length > 0),
    );
    if (!second.ok) return second;
    diagnostics.extrasIgnored = second.value.extrasIgnored;

    for (const failure of failures) {
      const correction = second.value.corrections.get(failure.failureId) ?? null;
      const redLine = enabled.get(failure.redLineId) as RedLine;
      const outcome = correction ? checkCandidate(input.text, redLine, correction) : null;
      if (outcome?.ok) {
        kept.push(outcome.flag);
        diagnostics.verifiedAfterRegeneration++;
      } else {
        diagnostics.dropped++;
      }
    }

    for (const failure of addressingFailures) {
      const sentence = second.value.addressing.get(failure.redLineId) ?? null;
      const verified = sentence === null ? null : verifySourceSentence(input.text, sentence);
      if (sentence !== null && verified?.ok) {
        addressed.set(failure.redLineId, { sentence, offset: verified.offset });
        diagnostics.addressingVerifiedAfterRegeneration++;
      } else {
        diagnostics.addressingDropped++;
      }
    }
  }

  const ordered = orderFlags(kept, checkedRedLineIds);
  diagnostics.duplicates = ordered.duplicates;
  diagnostics.flags = ordered.flags.length;

  const flagged = new Set(ordered.flags.map((flag) => flag.redLineId));
  const receipt: ReceiptLine[] = redLines
    .filter((redLine) => !flagged.has(redLine.id))
    .map((redLine): ReceiptLine => {
      const found = addressed.get(redLine.id);
      if (found) {
        diagnostics.receiptAddressed++;
        return { redLineId: redLine.id, redLineTitle: redLine.title, kind: "addressed", ...found };
      }
      diagnostics.receiptNotMentioned++;
      return { redLineId: redLine.id, redLineTitle: redLine.title, kind: "not_mentioned" };
    });

  return { ok: true, flags: ordered.flags, receipt, checkedRedLineIds, diagnostics };
}
