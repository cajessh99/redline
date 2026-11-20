// The receipt (ticket 04; D9, T4, stories 42-46) and the run diagnostics, through the real
// analyse(). Only the model is faked; verification, regeneration, ordering and the receipt run
// for real.
import { describe, expect, it } from "vitest";
import { analyse, type AnalysisResult } from "../../lib/analysis/analyse.ts";
import { DEFAULT_RED_LINE_IDS, PRODUCT_RED_LINES, defaultEnabledRedLines } from "../../lib/red-lines/defaults.ts";
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
const redLines = defaultEnabledRedLines();

type Ok = Extract<AnalysisResult, { ok: true }>;

function planted(redLineId: string, tier: string): SidecarFlag {
  const flag = sidecar.flags.find((f) => f.redLineId === redLineId && f.tier === tier);
  if (!flag) throw new Error(`no planted ${redLineId} ${tier}`);
  return flag;
}

const ipSevere = planted("ip-assignment", "Severe");
const misquotedIp = ipSevere.sentence.replace("hereby assigns", "assigns");
const othersThan = (...flags: SidecarFlag[]) =>
  sidecar.flags.filter((f) => !flags.includes(f)).map((f) => candidateFromSidecar(f));

const termination = sidecar.receipt.find((line) => line.redLineId === "termination-without-pay")!;
const benignNonCompete = benign.sidecar.receipt.find((line) => line.redLineId === "non-compete")!;
const misquotedAddressing = benignNonCompete.addressingSentence.replace("Nothing in", "Nothing within");

function run(model: FakeModel, enabled = redLines, storedText = text) {
  return analyse({ text: storedText, party: "Contractor", redLines: enabled }, { model });
}

function okOf(result: AnalysisResult): Ok {
  if (!result.ok) throw new Error(`expected success, got ${result.error.kind}: ${result.error.message}`);
  return result;
}

/** The benign payload with the non-compete addressing sentence replaced. */
function benignWith(nonCompete: string | null) {
  return analysisPayload(
    DEFAULT_RED_LINE_IDS,
    [],
    benign.sidecar.receipt.map((line) =>
      line.redLineId === "non-compete" ? { ...line, addressingSentence: nonCompete } : line,
    ),
  );
}

/** Every enabled red line appears exactly once across flags and receipt, counted by red line. */
function expectEachRedLineOnce(result: Ok, enabledIds: readonly string[]) {
  const flagged = [...new Set(result.flags.map((f) => f.redLineId))];
  const receipted = result.receipt.map((line) => line.redLineId);
  expect(new Set(receipted).size).toBe(receipted.length);
  expect(flagged.filter((id) => receipted.includes(id))).toEqual([]);
  expect([...flagged, ...receipted].sort()).toEqual([...enabledIds].sort());
  expect(receipted).toEqual(enabledIds.filter((id) => receipted.includes(id)));
}

/** Every addressed receipt line quotes the stored text verbatim at its offset. */
function expectReceiptVerbatim(result: Ok, storedText: string) {
  for (const line of result.receipt) {
    if (line.kind !== "addressed") continue;
    expect(storedText.slice(line.offset, line.offset + line.sentence.length)).toBe(line.sentence);
    expect(storedText.indexOf(line.sentence)).toBe(line.offset);
  }
}

/** The diagnostics add up: every candidate and every addressing sentence has exactly one fate. */
function expectDiagnosticsAddUp(result: Ok) {
  const d = result.diagnostics;
  expect(d.verifiedFirstPass + d.verifiedAfterRegeneration + d.dropped).toBe(d.candidates);
  expect(d.verifiedAfterRegeneration + d.dropped).toBe(d.regenerated);
  expect(d.verifiedFirstPass + d.verifiedAfterRegeneration - d.duplicates).toBe(d.flags);
  expect(d.flags).toBe(result.flags.length);
  expect(d.addressingVerifiedFirstPass + d.addressingVerifiedAfterRegeneration + d.addressingDropped).toBe(
    d.addressing,
  );
  expect(d.addressingVerifiedAfterRegeneration + d.addressingDropped).toBe(d.addressingRegenerated);
  expect(d.receiptAddressed).toBe(result.receipt.filter((l) => l.kind === "addressed").length);
  expect(d.receiptNotMentioned).toBe(result.receipt.filter((l) => l.kind === "not_mentioned").length);
}

describe("analyse: the receipt", () => {
  it("gives the benign contract no flags and a full receipt of five verbatim sentences", async () => {
    const model = fakeModel(sidecarPayload(benign.sidecar));
    const result = okOf(await run(model, redLines, benign.text));
    expect(result.flags).toEqual([]);
    expect(result.receipt).toEqual(
      DEFAULT_RED_LINE_IDS.map((id) => {
        const sentence = benign.sidecar.receipt.find((r) => r.redLineId === id)!.addressingSentence;
        expect(benign.text.indexOf(sentence)).toBeGreaterThanOrEqual(0);
        return {
          redLineId: id,
          redLineTitle: redLines.find((r) => r.id === id)!.title,
          kind: "addressed",
          sentence,
          offset: benign.text.indexOf(sentence),
        };
      }),
    );
    expect(model.calls).toHaveLength(1);
    expectReceiptVerbatim(result, benign.text);
    expectEachRedLineOnce(result, DEFAULT_RED_LINE_IDS);
    expectDiagnosticsAddUp(result);
  });

  it("gives the one-sided contract seven flags and one receipt line, for termination", async () => {
    const result = okOf(await run(fakeModel(sidecarPayload(sidecar))));
    expect(result.flags).toHaveLength(7);
    expect(result.receipt).toEqual([
      {
        redLineId: "termination-without-pay",
        redLineTitle: "Termination without notice, or without pay for work already done",
        kind: "addressed",
        sentence: termination.addressingSentence,
        offset: text.indexOf(termination.addressingSentence),
      },
    ]);
    expectReceiptVerbatim(result, text);
    expectEachRedLineOnce(result, DEFAULT_RED_LINE_IDS);
    expectDiagnosticsAddUp(result);
  });

  it("turns an addressing sentence misquoted twice into not mentioned, and the misquote appears nowhere", async () => {
    const secondMisquote = `${misquotedAddressing}!`;
    const model = fakeModel(
      benignWith(misquotedAddressing),
      regenerationPayload([], [{ redLineId: "non-compete", addressingSentence: secondMisquote }]),
    );
    const result = okOf(await run(model, redLines, benign.text));
    expect(model.calls).toHaveLength(2);
    expect(result.receipt.find((line) => line.redLineId === "non-compete")).toEqual({
      redLineId: "non-compete",
      redLineTitle: "A non-compete or non-solicit that bars me from other clients",
      kind: "not_mentioned",
    });
    expect(result.receipt.filter((line) => line.kind === "addressed")).toHaveLength(4);
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain("Nothing within");
    expect(serialised).not.toContain(JSON.stringify(misquotedAddressing).slice(1, -1));
    expect(result.diagnostics).toMatchObject({
      addressing: 5,
      addressingVerifiedFirstPass: 4,
      addressingRegenerated: 1,
      addressingVerifiedAfterRegeneration: 0,
      addressingDropped: 1,
      receiptAddressed: 4,
      receiptNotMentioned: 1,
    });
    expectReceiptVerbatim(result, benign.text);
    expectEachRedLineOnce(result, DEFAULT_RED_LINE_IDS);
    expectDiagnosticsAddUp(result);
  });

  it("turns a misquote into not mentioned when the regeneration answers null", async () => {
    const model = fakeModel(
      benignWith(misquotedAddressing),
      regenerationPayload([], [{ redLineId: "non-compete", addressingSentence: null }]),
    );
    const result = okOf(await run(model, redLines, benign.text));
    expect(result.receipt.find((line) => line.redLineId === "non-compete")?.kind).toBe("not_mentioned");
    expect(JSON.stringify(result)).not.toContain("Nothing within");
    expectDiagnosticsAddUp(result);
  });

  it("turns a misquote into not mentioned when the regeneration leaves the red line out", async () => {
    const model = fakeModel(benignWith(misquotedAddressing), regenerationPayload([], []));
    const result = okOf(await run(model, redLines, benign.text));
    expect(result.receipt.find((line) => line.redLineId === "non-compete")?.kind).toBe("not_mentioned");
    expect(JSON.stringify(result)).not.toContain("Nothing within");
    expectDiagnosticsAddUp(result);
  });

  it("shows the addressing sentence when the regeneration corrects the misquote", async () => {
    const model = fakeModel(
      benignWith(misquotedAddressing),
      regenerationPayload([], [
        { redLineId: "non-compete", addressingSentence: benignNonCompete.addressingSentence },
      ]),
    );
    const result = okOf(await run(model, redLines, benign.text));
    expect(model.calls).toHaveLength(2);
    expect(result.receipt.find((line) => line.redLineId === "non-compete")).toEqual({
      redLineId: "non-compete",
      redLineTitle: "A non-compete or non-solicit that bars me from other clients",
      kind: "addressed",
      sentence: benignNonCompete.addressingSentence,
      offset: benign.text.indexOf(benignNonCompete.addressingSentence),
    });
    expect(JSON.stringify(result)).not.toContain("Nothing within");
    expect(result.diagnostics).toMatchObject({ addressingRegenerated: 1, addressingVerifiedAfterRegeneration: 1 });
    expectReceiptVerbatim(result, benign.text);
    expectDiagnosticsAddUp(result);
  });

  it("gives not mentioned for a null addressing sentence, with no regeneration", async () => {
    const model = fakeModel(benignWith(null));
    const result = okOf(await run(model, redLines, benign.text));
    expect(model.calls).toHaveLength(1);
    expect(result.receipt.find((line) => line.redLineId === "non-compete")?.kind).toBe("not_mentioned");
    expect(result.receipt.filter((line) => line.kind === "addressed")).toHaveLength(4);
    expectEachRedLineOnce(result, DEFAULT_RED_LINE_IDS);
    expectDiagnosticsAddUp(result);
  });

  it("gives a receipt line, from its addressing sentence, to a red line whose candidates were all dropped", async () => {
    const indemnity = planted("uncapped-indemnity", "Severe");
    const misquoted = candidateFromSidecar(indemnity, { sourceSentence: `${indemnity.sentence}!` });
    const model = fakeModel(
      analysisPayload(DEFAULT_RED_LINE_IDS, [misquoted, ...othersThan(indemnity)], [
        ...sidecar.receipt,
        { redLineId: "uncapped-indemnity", addressingSentence: indemnity.sentence },
      ]),
      regenerationPayload([misquoted]),
    );
    const result = okOf(await run(model));
    expect(model.calls).toHaveLength(2);
    expect(result.flags.some((f) => f.redLineId === "uncapped-indemnity")).toBe(false);
    expect(result.receipt.map((line) => line.redLineId)).toEqual(["uncapped-indemnity", "termination-without-pay"]);
    expect(result.receipt[0]).toEqual({
      redLineId: "uncapped-indemnity",
      redLineTitle: "Uncapped indemnity or unlimited liability on me",
      kind: "addressed",
      sentence: indemnity.sentence,
      offset: text.indexOf(indemnity.sentence),
    });
    expect(JSON.stringify(result)).not.toContain(`${indemnity.sentence.slice(-20)}!`);
    expectEachRedLineOnce(result, DEFAULT_RED_LINE_IDS);
    expectDiagnosticsAddUp(result);
  });

  it("gives not mentioned to a red line whose candidates were all dropped and that had no addressing sentence", async () => {
    const indemnity = planted("uncapped-indemnity", "Severe");
    const misquoted = candidateFromSidecar(indemnity, { sourceSentence: `${indemnity.sentence}!` });
    const model = fakeModel(
      analysisPayload(DEFAULT_RED_LINE_IDS, [misquoted, ...othersThan(indemnity)], sidecar.receipt),
      regenerationPayload(),
    );
    const result = okOf(await run(model));
    expect(result.receipt[0]).toEqual({
      redLineId: "uncapped-indemnity",
      redLineTitle: "Uncapped indemnity or unlimited liability on me",
      kind: "not_mentioned",
    });
    expectEachRedLineOnce(result, DEFAULT_RED_LINE_IDS);
    expectDiagnosticsAddUp(result);
  });

  it("gives no receipt line to a flagged red line, whatever addressing sentence comes with it", async () => {
    const payload = sidecarPayload(sidecar);
    payload.redLines.find((e) => e.redLineId === "ip-assignment")!.addressingSentence = "Not in the document.";
    const model = fakeModel(payload);
    const result = okOf(await run(model));
    expect(model.calls).toHaveLength(1);
    expect(result.receipt.map((line) => line.redLineId)).toEqual(["termination-without-pay"]);
    expect(JSON.stringify(result)).not.toContain("Not in the document.");
  });

  it("ignores addressing sentences for red lines that are not enabled", async () => {
    const enabled = redLines.filter((r) => r.id !== "termination-without-pay");
    const result = okOf(await run(fakeModel(sidecarPayload(sidecar)), enabled));
    expect(result.receipt).toEqual([]);
    expectEachRedLineOnce(result, enabled.map((r) => r.id));
  });

  it("accounts for every enabled red line exactly once, with offered red lines switched on", async () => {
    const offered = PRODUCT_RED_LINES.filter((r) => r.id === "auto-renewal" || r.id === "arbitration");
    const enabled = [...redLines, ...offered];
    const enabledIds = enabled.map((r) => r.id);
    const all = sidecar.flags.map((f) => candidateFromSidecar(f));
    const scenarios = [
      fakeModel(sidecarPayload(sidecar, enabledIds)),
      fakeModel(analysisPayload(enabledIds, [], [])),
      fakeModel(analysisPayload(enabledIds, all.toReversed(), sidecar.receipt)),
      fakeModel(
        analysisPayload(
          enabledIds,
          [candidateFromSidecar(ipSevere, { sourceSentence: misquotedIp }), ...othersThan(ipSevere)],
          [{ redLineId: "auto-renewal", addressingSentence: "This Agreement renews forever." }],
        ),
        regenerationPayload([], [{ redLineId: "auto-renewal", addressingSentence: null }]),
      ),
    ];
    for (const model of scenarios) {
      const result = okOf(await run(model, enabled));
      expectEachRedLineOnce(result, enabledIds);
      expectReceiptVerbatim(result, text);
      expectDiagnosticsAddUp(result);
    }
  });

  it("sends a failed candidate and a failed addressing sentence back in one call", async () => {
    const model = fakeModel(
      analysisPayload(DEFAULT_RED_LINE_IDS, [candidateFromSidecar(ipSevere, { sourceSentence: misquotedIp })], [
        { redLineId: "termination-without-pay", addressingSentence: `${termination.addressingSentence.slice(0, -1)}!` },
      ]),
      regenerationPayload(
        [candidateFromSidecar(ipSevere)],
        [{ redLineId: "termination-without-pay", addressingSentence: termination.addressingSentence }],
      ),
    );
    const result = okOf(await run(model));
    expect(model.calls).toHaveLength(2);
    expect(result.flags.map((f) => f.redLineId)).toEqual(["ip-assignment"]);
    expect(result.receipt.find((l) => l.redLineId === "termination-without-pay")).toMatchObject({
      kind: "addressed",
      sentence: termination.addressingSentence,
    });
    expectEachRedLineOnce(result, DEFAULT_RED_LINE_IDS);
    expectDiagnosticsAddUp(result);
  });

  it("fails the whole run, with no receipt, when the addressing regeneration is malformed", async () => {
    const model = fakeModel(benignWith(misquotedAddressing), { corrections: [] });
    const result = await run(model, redLines, benign.text);
    expect(result).toMatchObject({ ok: false, error: { kind: "malformed_output" } });
    expect(result).not.toHaveProperty("receipt");
  });
});

describe("analyse: diagnostics add up", () => {
  it("counts a correction that repeats a kept flag, and ignores extra matches (the real-model report)", async () => {
    // Six candidates, five verify. The one that fails comes back corrected to a sentence already
    // flagged, plus an extra match nobody asked for. Before ticket 04 the extra was counted as a
    // second regenerated success, so the totals did not add up.
    const ipMinor = planted("ip-assignment", "Minor");
    const firstPass = [
      candidateFromSidecar(ipMinor, { sourceSentence: `${ipMinor.sentence}!` }),
      ...othersThan(ipMinor, planted("non-compete", "Minor")),
    ];
    const regeneration = regenerationPayload([candidateFromSidecar(ipSevere)]);
    regeneration.corrections[0].matches.push({
      tier: ipMinor.tier,
      statement: ipMinor.statement,
      sourceSentence: ipMinor.sentence,
      counterOffer: ipMinor.counterOffer,
    });
    const result = okOf(await run(fakeModel(analysisPayload(DEFAULT_RED_LINE_IDS, firstPass, sidecar.receipt), regeneration)));
    expect(result.diagnostics).toMatchObject({
      candidates: 6,
      verifiedFirstPass: 5,
      regenerated: 1,
      verifiedAfterRegeneration: 1,
      dropped: 0,
      extrasIgnored: 1,
      duplicates: 1,
      flags: 5,
    });
    expect(result.flags.some((f) => f.sourceSentence === ipMinor.sentence)).toBe(false);
    expectDiagnosticsAddUp(result);
  });

  it("counts duplicates in the first pass", async () => {
    const twice = [
      candidateFromSidecar(ipSevere),
      candidateFromSidecar(ipSevere, { statement: "Contractor gives up all prior work." }),
    ];
    const result = okOf(await run(fakeModel(analysisPayload(DEFAULT_RED_LINE_IDS, twice))));
    expect(result.diagnostics).toMatchObject({ candidates: 2, verifiedFirstPass: 2, duplicates: 1, flags: 1 });
    expectDiagnosticsAddUp(result);
  });

  it("adds up on the misquote, banned-word, empty-regeneration and clean-run paths", async () => {
    const hedged = candidateFromSidecar(ipSevere, { statement: "Contractor may lose ownership of work." });
    const scenarios: Array<[FakeModel, string]> = [
      [
        fakeModel(
          analysisPayload(DEFAULT_RED_LINE_IDS, [
            candidateFromSidecar(ipSevere, { sourceSentence: misquotedIp }),
            hedged,
            ...othersThan(ipSevere),
          ]),
          regenerationPayload([candidateFromSidecar(ipSevere)]),
        ),
        text,
      ],
      [fakeModel(analysisPayload(DEFAULT_RED_LINE_IDS, [hedged]), regenerationPayload()), text],
      [fakeModel(sidecarPayload(sidecar)), text],
      [fakeModel(sidecarPayload(benign.sidecar)), benign.text],
    ];
    for (const [model, storedText] of scenarios) {
      expectDiagnosticsAddUp(okOf(await run(model, redLines, storedText)));
    }
  });
});
