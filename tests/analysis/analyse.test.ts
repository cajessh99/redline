import { describe, expect, it } from "vitest";
import { analyse, type AnalysisResult, type Flag } from "../../lib/analysis/analyse.ts";
import { verifySourceSentence } from "../../lib/analysis/verify.ts";
import { DEFAULT_RED_LINE_IDS, TIERS, defaultEnabledRedLines } from "../../lib/red-lines/defaults.ts";
import {
  FakeModel,
  analysisPayload,
  candidateFromSidecar,
  fakeModel,
  loadContract,
  regenerationPayload,
  sidecarPayload,
  type SidecarFlag,
} from "../support/fake-model.ts";

const { text, sidecar } = loadContract("one-sided-services-agreement");
const benign = loadContract("benign-services-agreement");
const party = sidecar.readerParty;
const redLines = defaultEnabledRedLines();

function planted(redLineId: string, tier: string): SidecarFlag {
  const flag = sidecar.flags.find((f) => f.redLineId === redLineId && f.tier === tier);
  if (!flag) throw new Error(`no planted ${redLineId} ${tier}`);
  return flag;
}

const ipSevere = planted("ip-assignment", "Severe");
const misquotedIp = ipSevere.sentence.replace("hereby assigns", "assigns");
const allCandidates = () => sidecar.flags.map((flag) => candidateFromSidecar(flag));
const othersThan = (flag: SidecarFlag) =>
  sidecar.flags.filter((f) => f !== flag).map((f) => candidateFromSidecar(f));

function flagsOf(result: AnalysisResult): Flag[] {
  if (!result.ok) throw new Error(`expected flags, got ${result.error.kind}: ${result.error.message}`);
  return result.flags;
}

/** Every shown flag cites a sentence present verbatim at its offset in the stored text. */
function expectEveryFlagCitesTheText(storedText: string, flags: Flag[]) {
  for (const flag of flags) {
    expect(storedText.slice(flag.offset, flag.offset + flag.sourceSentence.length)).toBe(flag.sourceSentence);
    expect(verifySourceSentence(storedText, flag.sourceSentence)).toEqual({ ok: true, offset: flag.offset });
  }
}

function run(model: FakeModel, enabled = redLines, storedText = text) {
  return analyse({ text: storedText, party, redLines: enabled }, { model });
}

describe("analyse: verified flags from the fixture contract", () => {
  it("yields all seven planted flags, verified, with offsets, ordered by tier then position", async () => {
    const model = fakeModel(sidecarPayload(sidecar));
    const result = await run(model);
    const flags = flagsOf(result);

    expect(flags.map((f) => [f.tier, f.redLineId])).toEqual([
      ["Severe", "discretionary-payment"],
      ["Severe", "ip-assignment"],
      ["Severe", "uncapped-indemnity"],
      ["Severe", "non-compete"],
      ["Moderate", "discretionary-payment"],
      ["Minor", "ip-assignment"],
      ["Minor", "non-compete"],
    ]);
    for (const flag of flags) {
      const source = sidecar.flags.find((f) => f.sentence === flag.sourceSentence) as SidecarFlag;
      expect(flag).toEqual({
        redLineId: source.redLineId,
        redLineTitle: redLines.find((r) => r.id === source.redLineId)?.title,
        tier: source.tier,
        statement: source.statement,
        sourceSentence: source.sentence,
        offset: text.indexOf(source.sentence),
        counterOffer: source.counterOffer,
      });
    }
    for (let i = 1; i < flags.length; i++) {
      const [a, b] = [flags[i - 1], flags[i]];
      const byTier = TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier);
      expect(byTier < 0 || (byTier === 0 && a.offset < b.offset)).toBe(true);
    }
    expectEveryFlagCitesTheText(text, flags);
    expect(result.ok && result.checkedRedLineIds).toEqual([...DEFAULT_RED_LINE_IDS]);
    expect(model.calls).toHaveLength(1);
  });

  it("orders flags the same way whatever order the model returns them in", async () => {
    const reversed = analysisPayload(DEFAULT_RED_LINE_IDS.toReversed(), allCandidates().toReversed());
    const inOrder = flagsOf(await run(fakeModel(sidecarPayload(sidecar))));
    expect(flagsOf(await run(fakeModel(reversed)))).toEqual(inOrder);
  });

  it("yields one flag with its id, tier, statement, source sentence and offset for one correct candidate", async () => {
    const model = fakeModel(analysisPayload(DEFAULT_RED_LINE_IDS, [candidateFromSidecar(ipSevere)]));
    const flags = flagsOf(await run(model));
    expect(flags).toEqual([
      {
        redLineId: "ip-assignment",
        redLineTitle: "Assignment of IP I created before or outside this engagement",
        tier: "Severe",
        statement: ipSevere.statement,
        sourceSentence: ipSevere.sentence,
        offset: text.indexOf(ipSevere.sentence),
        counterOffer: ipSevere.counterOffer,
      },
    ]);
  });

  it("de-duplicates flags with the same red line and offset", async () => {
    const twice = [candidateFromSidecar(ipSevere), candidateFromSidecar(ipSevere, { statement: "Contractor gives up all prior work." })];
    const flags = flagsOf(await run(fakeModel(analysisPayload(DEFAULT_RED_LINE_IDS, twice))));
    expect(flags).toHaveLength(1);
    expect(flags[0].statement).toBe(ipSevere.statement);
  });

  it("yields no flags on the benign contract when the model returns no matches", async () => {
    const model = fakeModel(sidecarPayload(benign.sidecar));
    const result = await run(model, redLines, benign.text);
    expect(result).toMatchObject({ ok: true, flags: [], checkedRedLineIds: [...DEFAULT_RED_LINE_IDS] });
    expect(model.calls).toHaveLength(1);
  });

  it("asks for a schema with no confidence field anywhere", async () => {
    const model = fakeModel(analysisPayload(DEFAULT_RED_LINE_IDS, [candidateFromSidecar(ipSevere, { sourceSentence: misquotedIp })]), regenerationPayload());
    await run(model);
    expect(model.calls).toHaveLength(2);
    const keys = (value: unknown): string[] =>
      typeof value === "object" && value !== null
        ? Object.entries(value).flatMap(([k, v]) => [k, ...keys(v)])
        : [];
    for (const call of model.calls) {
      expect(keys(call.jsonSchema).some((k) => /confidence/i.test(k))).toBe(false);
      expect(JSON.stringify(call.jsonSchema)).not.toMatch(/confidence/i);
    }
  });
});

describe("analyse: misquotes are regenerated once, then dropped", () => {
  it("yields the corrected flag when a misquote is followed by a correct regeneration", async () => {
    const model = fakeModel(
      analysisPayload(DEFAULT_RED_LINE_IDS, [
        candidateFromSidecar(ipSevere, { sourceSentence: misquotedIp }),
        ...othersThan(ipSevere),
      ]),
      regenerationPayload([candidateFromSidecar(ipSevere)]),
    );
    const flags = flagsOf(await run(model));
    expect(model.calls).toHaveLength(2);
    expect(flags).toHaveLength(7);
    const ip = flags.find((f) => f.redLineId === "ip-assignment" && f.tier === "Severe");
    expect(ip?.sourceSentence).toBe(ipSevere.sentence);
    expect(ip?.offset).toBe(text.indexOf(ipSevere.sentence));
    expect(flags.some((f) => f.sourceSentence === misquotedIp)).toBe(false);
    expectEveryFlagCitesTheText(text, flags);
  });

  it("drops the candidate after two misquotes and keeps every other flag", async () => {
    const model = fakeModel(
      analysisPayload(DEFAULT_RED_LINE_IDS, [
        candidateFromSidecar(ipSevere, { sourceSentence: misquotedIp }),
        ...othersThan(ipSevere),
      ]),
      regenerationPayload([
        candidateFromSidecar(ipSevere, { sourceSentence: ipSevere.sentence.toUpperCase() }),
      ]),
    );
    const result = await run(model);
    const flags = flagsOf(result);
    expect(model.calls).toHaveLength(2);
    expect(flags).toHaveLength(6);
    expect(result.ok && result.diagnostics).toEqual({
      candidates: 7,
      verifiedFirstPass: 6,
      regenerated: 1,
      verifiedAfterRegeneration: 0,
      dropped: 1,
      extrasIgnored: 0,
      duplicates: 0,
      flags: 6,
      addressing: 0,
      addressingVerifiedFirstPass: 0,
      addressingRegenerated: 0,
      addressingVerifiedAfterRegeneration: 0,
      addressingDropped: 0,
      receiptAddressed: 0,
      receiptNotMentioned: 1,
    });
    expect(flags.some((f) => f.redLineId === "ip-assignment" && f.tier === "Severe")).toBe(false);
    expect(flags.some((f) => f.redLineId === "ip-assignment" && f.tier === "Minor")).toBe(true);
    expectEveryFlagCitesTheText(text, flags);
  });

  it("drops the candidate when the regeneration returns no matches", async () => {
    const model = fakeModel(
      analysisPayload(DEFAULT_RED_LINE_IDS, [candidateFromSidecar(ipSevere, { sourceSentence: misquotedIp })]),
      regenerationPayload(),
    );
    expect(flagsOf(await run(model))).toEqual([]);
    expect(model.calls).toHaveLength(2);
  });

  it("ignores corrections for failures it did not send back, and extra matches for one failure", async () => {
    const nonCompete = planted("non-compete", "Severe");
    const payload = regenerationPayload([candidateFromSidecar(ipSevere), candidateFromSidecar(nonCompete)]);
    // A second match under the one failure id: asked for at most one, so never checked or shown.
    const minor = planted("ip-assignment", "Minor");
    payload.corrections[0].matches.push({
      tier: minor.tier,
      statement: minor.statement,
      sourceSentence: minor.sentence,
      counterOffer: minor.counterOffer,
    });
    const model = fakeModel(
      analysisPayload(DEFAULT_RED_LINE_IDS, [candidateFromSidecar(ipSevere, { sourceSentence: misquotedIp })]),
      payload,
    );
    const result = await run(model);
    const flags = flagsOf(result);
    expect(flags.map((f) => [f.redLineId, f.tier])).toEqual([["ip-assignment", "Severe"]]);
    expect(result.ok && result.diagnostics).toMatchObject({
      candidates: 1,
      verifiedFirstPass: 0,
      regenerated: 1,
      verifiedAfterRegeneration: 1,
      dropped: 0,
      extrasIgnored: 1,
      flags: 1,
    });
  });

  it("makes no second call when every candidate verifies", async () => {
    const model = fakeModel(sidecarPayload(sidecar));
    await run(model);
    expect(model.calls).toHaveLength(1);
  });
});

describe("analyse: banned words in a statement are treated like a misquote", () => {
  const hedged = candidateFromSidecar(ipSevere, {
    statement: "Contractor may lose ownership of work made before this Agreement.",
  });

  it("regenerates a statement that uses a banned word and shows the corrected one", async () => {
    const model = fakeModel(
      analysisPayload(DEFAULT_RED_LINE_IDS, [hedged]),
      regenerationPayload([candidateFromSidecar(ipSevere)]),
    );
    const flags = flagsOf(await run(model));
    expect(model.calls).toHaveLength(2);
    expect(flags).toHaveLength(1);
    expect(flags[0].statement).toBe(ipSevere.statement);
  });

  it("drops the candidate when the banned word comes back", async () => {
    const model = fakeModel(
      analysisPayload(DEFAULT_RED_LINE_IDS, [hedged]),
      regenerationPayload([
        candidateFromSidecar(ipSevere, { statement: "This clause is not Standard for freelancers." }),
      ]),
    );
    expect(flagsOf(await run(model))).toEqual([]);
    expect(model.calls).toHaveLength(2);
  });

  it("does not check the counter-offer for banned words", async () => {
    const drafted = candidateFromSidecar(ipSevere, {
      counterOffer: "Contractor may keep and reuse its pre-existing materials.",
    });
    const model = fakeModel(analysisPayload(DEFAULT_RED_LINE_IDS, [drafted]));
    const flags = flagsOf(await run(model));
    expect(model.calls).toHaveLength(1);
    expect(flags[0].counterOffer).toBe(drafted.counterOffer);
  });
});

describe("analyse: the enabled red lines are the whole rulebook", () => {
  it("ignores candidates for a red line that is not enabled", async () => {
    const enabled = redLines.filter((r) => r.id !== "non-compete");
    const model = fakeModel(sidecarPayload(sidecar));
    const result = await run(model, enabled);
    const flags = flagsOf(result);
    expect(flags).toHaveLength(5);
    expect(flags.some((f) => f.redLineId === "non-compete")).toBe(false);
    expect(result.ok && result.checkedRedLineIds).not.toContain("non-compete");
    expect(model.calls).toHaveLength(1);
  });

  it("ignores candidates for an id the rulebook does not contain at all", async () => {
    const stray = { ...candidateFromSidecar(ipSevere), redLineId: "auto-renewal" };
    const flags = flagsOf(await run(fakeModel(analysisPayload(DEFAULT_RED_LINE_IDS, [stray]))));
    expect(flags).toEqual([]);
  });

  it("makes no model call when no red line is enabled", async () => {
    const model = new FakeModel([]);
    expect(await run(model, [])).toMatchObject({ ok: true, flags: [], checkedRedLineIds: [] });
    expect(model.calls).toHaveLength(0);
  });
});

describe("analyse: model failures give an error and no partial flags", () => {
  const withIp = (overrides: Record<string, unknown>) => {
    const payload = sidecarPayload(sidecar);
    const entry = payload.redLines.find((e) => e.redLineId === "ip-assignment");
    Object.assign(entry!.matches[0], overrides);
    return payload;
  };

  const cases: Array<[string, FakeModel, "model_failed" | "malformed_output"]> = [
    ["the model throws", new FakeModel([{ throws: new Error("timeout") }]), "model_failed"],
    ["the response is not JSON", new FakeModel([{ raw: '{"redLines": [' }]), "malformed_output"],
    ["the response is not an object", fakeModel(["just text"]), "malformed_output"],
    ["the response is null", fakeModel(null), "malformed_output"],
    ["redLines is missing", fakeModel({ flags: [] }), "malformed_output"],
    ["a tier is unknown", fakeModel(withIp({ tier: "High" })), "malformed_output"],
    ["a counterOffer is missing", fakeModel(withIp({ counterOffer: undefined })), "malformed_output"],
    ["a counterOffer is empty", fakeModel(withIp({ counterOffer: "  " })), "malformed_output"],
    ["a statement is not a string", fakeModel(withIp({ statement: 42 })), "malformed_output"],
    ["a sourceSentence is empty", fakeModel(withIp({ sourceSentence: "" })), "malformed_output"],
    [
      "addressingSentence is missing",
      fakeModel({ redLines: [{ redLineId: "ip-assignment", matches: [] }] }),
      "malformed_output",
    ],
    [
      "matches is not an array",
      fakeModel({ redLines: [{ redLineId: "ip-assignment", matches: {}, addressingSentence: null }] }),
      "malformed_output",
    ],
  ];

  for (const [name, model, kind] of cases) {
    it(`returns ${kind} when ${name}`, async () => {
      const result = await run(model);
      expect(result.ok).toBe(false);
      expect(result).not.toHaveProperty("flags");
      if (!result.ok) {
        expect(result.error.kind).toBe(kind);
        expect(result.error.message.length).toBeGreaterThan(0);
      }
    });
  }

  it("fails the whole run when the regeneration is malformed, keeping none of the verified flags", async () => {
    const model = new FakeModel([
      {
        json: analysisPayload(DEFAULT_RED_LINE_IDS, [
          candidateFromSidecar(ipSevere, { sourceSentence: misquotedIp }),
          ...othersThan(ipSevere),
        ]),
      },
      { json: { redLines: [{ redLineId: "ip-assignment", matches: [{ tier: "Severe" }] }] } },
    ]);
    const result = await run(model);
    expect(result).toMatchObject({ ok: false, error: { kind: "malformed_output" } });
    expect(result).not.toHaveProperty("flags");
    expect(model.calls).toHaveLength(2);
  });

  it("fails the whole run when the regeneration call throws", async () => {
    const model = new FakeModel([
      { json: analysisPayload(DEFAULT_RED_LINE_IDS, [candidateFromSidecar(ipSevere, { sourceSentence: misquotedIp })]) },
      { throws: new Error("connection reset") },
    ]);
    expect(await run(model)).toMatchObject({ ok: false, error: { kind: "model_failed" } });
  });
});
