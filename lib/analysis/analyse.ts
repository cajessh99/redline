// The analysis boundary (spec, "Analysis boundary (seam 1, server side)"; ADR-0001; D7, D8).
//
// analyse() takes the stored text, the reader's party, and the enabled red lines (the whole
// rulebook for the run), asks the model for candidate matches, and returns only flags whose source
// sentence occurs verbatim in the stored text. A candidate that fails verification, or whose
// statement uses a banned word (BUILD-REPORT.md B10), is sent back once for regeneration with the
// failure named, and dropped if it fails again. A model error or malformed output fails the whole
// run with no partial flags.
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

export type AnalysisErrorKind = "model_failed" | "malformed_output";

export type AnalysisError = { kind: AnalysisErrorKind; message: string };

/**
 * Counts from one run, for the smoke script and logs. Never shown to readers.
 * - candidates: first-pass candidates for enabled red lines.
 * - verifiedFirstPass: of those, how many passed the source and banned-word checks.
 * - regenerated: first-pass candidates that failed and were sent back once.
 * - verifiedAfterRegeneration: regenerated candidates that passed on the second try.
 * - dropped: failures not recovered by regeneration (regenerated - verifiedAfterRegeneration, min 0).
 */
export type AnalysisDiagnostics = {
  candidates: number;
  verifiedFirstPass: number;
  regenerated: number;
  verifiedAfterRegeneration: number;
  dropped: number;
};

export type AnalysisResult =
  | { ok: true; flags: Flag[]; checkedRedLineIds: string[]; diagnostics: AnalysisDiagnostics }
  | { ok: false; error: AnalysisError };

// ---------------------------------------------------------------------------------------------
// Model output types (internal). addressingSentence is requested now for the receipt (ticket 04)
// and kept here; nothing from it reaches this ticket's result.

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

type CandidateFailure = {
  redLineId: string;
  candidate: Candidate;
  problem: { kind: "not_verbatim" } | { kind: "empty_source" } | { kind: "banned_word"; word: BannedWord };
};

type CheckOutcome = { ok: true; flag: Flag } | { ok: false; failure: CandidateFailure };

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

function regenerationSchema(redLineIds: string[]): JsonSchema {
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
          required: ["redLineId", "matches"],
          properties: {
            redLineId: { type: "string", enum: redLineIds },
            matches: { type: "array", items: matchSchema },
          },
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Prompts

function systemPrompt(askForAddressing: boolean): string {
  const lines = [
    "You read a contract for one party to it, called the reader's party, and find clauses that match the reader's red lines.",
    "The red lines you are given are the whole rulebook. Match nothing that is not described by one of them, and flag only clauses that work against the reader's party.",
    "Return only matches you are certain of. Omit anything doubtful. There is no confidence field: doubt is expressed by leaving a match out.",
    "For each match:",
    "- tier is one of the tiers the red line describes: Severe, Moderate or Minor.",
    "- sourceSentence is one sentence copied verbatim from the document, character for character, with the same punctuation, quotation marks, capitalisation and spacing. Do not paraphrase, shorten, join or tidy it.",
    "- statement is one plain declarative sentence saying what the clause does to the reader's party. No hedging. Never use these words: safe, standard, normal, unusual, clean, no issues, might, may, could possibly.",
    "- counterOffer is replacement wording for that sentence, written from the reader's party's side. It asserts nothing the sentence does not support.",
    "Never judge whether a clause is normal, standard or common, and make no legal claims. State only what the document says.",
  ];
  if (askForAddressing) {
    lines.push(
      "For every red line, also give addressingSentence: if the red line has no match but one sentence of the document addresses its subject, copy that sentence verbatim; otherwise null.",
    );
  }
  lines.push("Answer with JSON that follows the schema.");
  return lines.join("\n");
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
    `Red line id: ${failure.redLineId}`,
    `Quoted source sentence: ${JSON.stringify(failure.candidate.sourceSentence)}`,
    `Statement: ${JSON.stringify(failure.candidate.statement)}`,
    `Why it failed: ${why}.`,
  ].join("\n");
}

function regenerationPrompt(
  input: AnalysisInput,
  redLines: RedLine[],
  failures: CandidateFailure[],
): string {
  return [
    userPrompt(input, redLines),
    "",
    "Your previous answer contained candidates that failed the check. Each is listed below with the reason.",
    failures.map(describeFailure).join("\n\n"),
    "",
    "Return corrected candidates for these red lines only. Copy each source sentence verbatim from the document and keep every statement free of the banned words. If you cannot give a corrected candidate you are certain of, return an empty matches list for that red line.",
  ].join("\n");
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

function parseOutput(value: unknown, requireAddressing: boolean): CandidateEntry[] {
  if (!isRecord(value)) throw new OutputShapeError("output is not an object");
  const redLines = value.redLines;
  if (!Array.isArray(redLines)) throw new OutputShapeError("redLines is missing or not an array");

  return redLines.map((entry, i): CandidateEntry => {
    const path = `redLines[${i}]`;
    if (!isRecord(entry)) throw new OutputShapeError(`${path} is not an object`);
    const redLineId = requiredText(entry, "redLineId", path);
    if (!Array.isArray(entry.matches)) throw new OutputShapeError(`${path}.matches is missing or not an array`);
    const matches = entry.matches.map((match, j) => parseCandidate(match, `${path}.matches[${j}]`));

    let addressingSentence: string | null = null;
    if (requireAddressing) {
      const addressing = entry.addressingSentence;
      if (addressing !== null && typeof addressing !== "string") {
        throw new OutputShapeError(`${path}.addressingSentence is missing or not a string or null`);
      }
      addressingSentence = addressing;
    }
    return { redLineId, matches, addressingSentence };
  });
}

// ---------------------------------------------------------------------------------------------
// The run

type CallResult = { ok: true; entries: CandidateEntry[] } | { ok: false; error: AnalysisError };

async function callModel(
  model: ModelClient,
  request: Parameters<ModelClient["completeJson"]>[0],
  requireAddressing: boolean,
): Promise<CallResult> {
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
    return { ok: true, entries: parseOutput(raw, requireAddressing) };
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
    const kind = verified.reason === "empty" ? "empty_source" : "not_verbatim";
    return { ok: false, failure: { redLineId: redLine.id, candidate, problem: { kind } } };
  }
  const word = findBannedWord(candidate.statement);
  if (word) {
    return {
      ok: false,
      failure: { redLineId: redLine.id, candidate, problem: { kind: "banned_word", word } },
    };
  }
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

function orderFlags(flags: Flag[], redLineOrder: string[]): Flag[] {
  const seen = new Set<string>();
  const unique = flags.filter((flag) => {
    const key = `${flag.redLineId}\u0000${flag.offset}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.sort(
    (a, b) =>
      TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) ||
      a.offset - b.offset ||
      redLineOrder.indexOf(a.redLineId) - redLineOrder.indexOf(b.redLineId),
  );
}

/**
 * Runs one analysis. Returns verified flags ordered Severe, Moderate, Minor, then by position in
 * the document, or an error with no flags when the model fails or returns malformed output.
 */
export async function analyse(input: AnalysisInput, deps: AnalysisDeps): Promise<AnalysisResult> {
  const enabled = new Map<string, RedLine>();
  for (const redLine of input.redLines) {
    if (!enabled.has(redLine.id)) enabled.set(redLine.id, redLine);
  }
  const redLines = [...enabled.values()];
  const checkedRedLineIds = redLines.map((redLine) => redLine.id);
  const diagnostics: AnalysisDiagnostics = {
    candidates: 0,
    verifiedFirstPass: 0,
    regenerated: 0,
    verifiedAfterRegeneration: 0,
    dropped: 0,
  };
  if (redLines.length === 0) return { ok: true, flags: [], checkedRedLineIds, diagnostics };

  const first = await callModel(
    deps.model,
    {
      system: systemPrompt(true),
      user: userPrompt(input, redLines),
      schemaName: "redline_analysis",
      jsonSchema: analysisSchema(checkedRedLineIds),
    },
    true,
  );
  if (!first.ok) return first;

  const flags: Flag[] = [];
  const failures: CandidateFailure[] = [];
  for (const entry of first.entries) {
    const redLine = enabled.get(entry.redLineId);
    if (!redLine) continue;
    for (const candidate of entry.matches) {
      diagnostics.candidates++;
      const outcome = checkCandidate(input.text, redLine, candidate);
      if (outcome.ok) {
        flags.push(outcome.flag);
        diagnostics.verifiedFirstPass++;
      } else failures.push(outcome.failure);
    }
  }

  if (failures.length > 0) {
    diagnostics.regenerated = failures.length;
    const failedIds = [...new Set(failures.map((failure) => failure.redLineId))];
    const failedRedLines = failedIds.map((id) => enabled.get(id) as RedLine);
    const second = await callModel(
      deps.model,
      {
        system: systemPrompt(false),
        user: regenerationPrompt(input, failedRedLines, failures),
        schemaName: "redline_regeneration",
        jsonSchema: regenerationSchema(failedIds),
      },
      false,
    );
    if (!second.ok) return second;

    for (const entry of second.entries) {
      if (!failedIds.includes(entry.redLineId)) continue;
      const redLine = enabled.get(entry.redLineId) as RedLine;
      for (const candidate of entry.matches) {
        const outcome = checkCandidate(input.text, redLine, candidate);
        if (outcome.ok) {
          flags.push(outcome.flag);
          diagnostics.verifiedAfterRegeneration++;
        }
      }
    }
    diagnostics.dropped = Math.max(0, diagnostics.regenerated - diagnostics.verifiedAfterRegeneration);
  }

  return { ok: true, flags: orderFlags(flags, checkedRedLineIds), checkedRedLineIds, diagnostics };
}
