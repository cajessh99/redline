// A fake ModelClient for tests. The model is the external boundary and the only thing tests fake;
// verification, validation, regeneration and ordering run for real inside analyse().
//
// The fake answers from a scripted queue, one response per call, and records every request so a
// test can count calls. Payload builders turn the fixture sidecars and excerpts into the JSON the
// real model is asked for. Tests must not inspect prompt wording.
import { readFileSync } from "node:fs";
import { normaliseText } from "../../lib/intake/normalise.ts";
import { parseModelJson, type ModelClient, type ModelRequest } from "../../lib/analysis/model.ts";
import { DEFAULT_RED_LINE_IDS, type Tier } from "../../lib/red-lines/defaults.ts";

// ---------------------------------------------------------------------------------------------
// Fixtures

export type SidecarFlag = {
  redLineId: string;
  tier: Tier;
  sentence: string;
  hurts: string;
  statement: string;
  counterOffer: string;
};

export type Sidecar = {
  document: string;
  parties: string[];
  readerParty: string;
  flags: SidecarFlag[];
  receipt: { redLineId: string; addressingSentence: string }[];
};

export type ContractFixture = { text: string; sidecar: Sidecar };

export type Excerpt = {
  redLineId: string;
  tier: Tier;
  party: string;
  text: string;
  sentence: string;
};

export type ExcerptFixtures = {
  excerpts: Excerpt[];
  benign: { party: string; text: string };
};

const fixturesDir = new URL("../fixtures/", import.meta.url);

function readFixture(name: string): string {
  return readFileSync(new URL(name, fixturesDir), "utf8");
}

/** A fixture contract as stored (normalised at intake), with its sidecar of planted clauses. */
export function loadContract(
  name: "one-sided-services-agreement" | "benign-services-agreement",
): ContractFixture {
  return {
    text: normaliseText(readFixture(`${name}.txt`)),
    sidecar: JSON.parse(readFixture(`${name}.flags.json`)) as Sidecar,
  };
}

export function loadExcerpts(): ExcerptFixtures {
  return JSON.parse(readFixture("excerpts.json")) as ExcerptFixtures;
}

// ---------------------------------------------------------------------------------------------
// Payload builders

export type MatchPayload = {
  tier: string;
  statement: string;
  sourceSentence: string;
  counterOffer: string;
};

export type CandidatePayload = MatchPayload & { redLineId: string };

/** One sidecar flag as the model would return it. Override fields to plant a fault. */
export function candidateFromSidecar(
  flag: SidecarFlag,
  overrides: Partial<CandidatePayload> = {},
): CandidatePayload {
  return {
    redLineId: flag.redLineId,
    tier: flag.tier,
    statement: flag.statement,
    sourceSentence: flag.sentence,
    counterOffer: flag.counterOffer,
    ...overrides,
  };
}

function matchesFor(redLineId: string, candidates: CandidatePayload[]): MatchPayload[] {
  return candidates
    .filter((candidate) => candidate.redLineId === redLineId)
    .map(({ tier, statement, sourceSentence, counterOffer }) => ({
      tier,
      statement,
      sourceSentence,
      counterOffer,
    }));
}

/**
 * A first-call analysis payload: one entry per red line id, in the order given, carrying the
 * candidates for that id and an addressing sentence when the receipt has one.
 */
export function analysisPayload(
  redLineIds: readonly string[],
  candidates: CandidatePayload[],
  receipt: ReadonlyArray<{ redLineId: string; addressingSentence: string | null }> = [],
) {
  const ids = [...new Set([...redLineIds, ...candidates.map((candidate) => candidate.redLineId)])];
  return {
    redLines: ids.map((redLineId) => ({
      redLineId,
      matches: matchesFor(redLineId, candidates),
      addressingSentence:
        receipt.find((line) => line.redLineId === redLineId)?.addressingSentence ?? null,
    })),
  };
}

/** The payload a faithful model gives for a sidecar: every planted flag, verbatim. */
export function sidecarPayload(
  sidecar: Sidecar,
  redLineIds: readonly string[] = DEFAULT_RED_LINE_IDS,
) {
  return analysisPayload(redLineIds, sidecar.flags.map((flag) => candidateFromSidecar(flag)), sidecar.receipt);
}

/** A corrected candidate. failureId defaults to `${redLineId}#n`, n counting from 1 per red line in list order. */
export type CorrectionPayload = CandidatePayload & { failureId?: string };

export type AddressingPayload = { redLineId: string; addressingSentence: string | null };

/**
 * A regeneration payload: one correction per failed candidate (leave a failure out to have the
 * model return nothing for it), and corrected addressing sentences (null for "not addressed").
 * Failure ids follow analyse()'s numbering: a red line's failed first-pass candidates, in order.
 */
export function regenerationPayload(corrections: CorrectionPayload[] = [], addressing: AddressingPayload[] = []) {
  const counts = new Map<string, number>();
  return {
    corrections: corrections.map(({ failureId, redLineId, tier, statement, sourceSentence, counterOffer }) => {
      const n = (counts.get(redLineId) ?? 0) + 1;
      counts.set(redLineId, n);
      return { failureId: failureId ?? `${redLineId}#${n}`, matches: [{ tier, statement, sourceSentence, counterOffer }] };
    }),
    addressing,
  };
}

/** The candidate a faithful model gives for one excerpt. */
export function excerptCandidate(excerpt: Excerpt): CandidatePayload {
  return {
    redLineId: excerpt.redLineId,
    tier: excerpt.tier,
    statement: `This clause binds ${excerpt.party} at the ${excerpt.tier} tier of its red line.`,
    sourceSentence: excerpt.sentence,
    counterOffer: `${excerpt.party} proposes deleting this sentence.`,
  };
}

// ---------------------------------------------------------------------------------------------
// The fake client

export type FakeResponse =
  /** Returned as the parsed JSON response. */
  | { json: unknown }
  /** Raw response text, parsed the way a real client parses it (unparsable text is malformed). */
  | { raw: string }
  /** The call fails in transport. */
  | { throws: Error };

export class FakeModel implements ModelClient {
  readonly calls: ModelRequest[] = [];
  private readonly queue: FakeResponse[];

  constructor(responses: FakeResponse[]) {
    this.queue = [...responses];
  }

  async completeJson(request: ModelRequest): Promise<unknown> {
    this.calls.push(request);
    const next = this.queue.shift();
    if (!next) throw new Error(`FakeModel: no scripted response for call ${this.calls.length}`);
    if ("throws" in next) throw next.throws;
    if ("raw" in next) return parseModelJson(next.raw);
    return structuredClone(next.json);
  }
}

/** A fake that answers each call in turn with the given JSON payloads. */
export function fakeModel(...payloads: unknown[]): FakeModel {
  return new FakeModel(payloads.map((json) => ({ json })));
}

/**
 * A fake tuned per party (T5). It answers from the structured party on the request
 * (`request.metadata.party`), never from prompt wording, and fails a call for a party it has no
 * answer for. Records every request.
 */
export class PartyTunedModel implements ModelClient {
  readonly calls: ModelRequest[] = [];
  private readonly byParty: Readonly<Record<string, unknown>>;

  constructor(byParty: Readonly<Record<string, unknown>>) {
    this.byParty = byParty;
  }

  async completeJson(request: ModelRequest): Promise<unknown> {
    this.calls.push(request);
    const party = request.metadata?.party;
    if (party === undefined || !Object.hasOwn(this.byParty, party)) {
      throw new Error(`PartyTunedModel: no answer for party ${JSON.stringify(party)}`);
    }
    return structuredClone(this.byParty[party]);
  }
}

/**
 * The payload for the side a one-sided contract favours: no matches at all, and for each red line
 * the sentence that deals with its subject (the first planted sentence for that red line, or the
 * sidecar's receipt sentence), so the result is a full receipt.
 */
export function favouredSidePayload(
  sidecar: Sidecar,
  redLineIds: readonly string[] = DEFAULT_RED_LINE_IDS,
) {
  const addressing = redLineIds.map((redLineId) => ({
    redLineId,
    addressingSentence:
      sidecar.flags.find((flag) => flag.redLineId === redLineId)?.sentence ??
      sidecar.receipt.find((line) => line.redLineId === redLineId)?.addressingSentence ??
      null,
  }));
  return analysisPayload(redLineIds, [], addressing);
}
