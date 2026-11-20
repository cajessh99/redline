// The reader's party drives the analysis (D10, T5), and changing it reruns the analysis over the
// stored text (spec story 10). The model is faked per party: it answers from the structured party
// on the request, never from prompt wording. Verification, the receipt, validation and the
// store-or-not decisions run for real.
import { describe, expect, it } from "vitest";
import type { Flag } from "../../lib/analysis/analyse.ts";
import {
  rerunWithParty,
  type DocumentStore,
  type RerunOutcome,
  type RerunRecord,
  type StoredDocument,
} from "../../lib/analysis/rerun.ts";
import { runAnalysis, type RunOutcome } from "../../lib/analysis/run.ts";
import { verifySourceSentence } from "../../lib/analysis/verify.ts";
import { findPartyCandidates } from "../../lib/intake/parties.ts";
import { DEFAULT_RED_LINE_IDS, defaultEnabledRedLines } from "../../lib/red-lines/defaults.ts";
import {
  FakeModel,
  favouredSidePayload,
  loadContract,
  PartyTunedModel,
  sidecarPayload,
} from "../support/fake-model.ts";

const { text, sidecar } = loadContract("one-sided-services-agreement");
const redLines = defaultEnabledRedLines();

/** The fake tuned to the fixture: the sidecar's flags for Contractor, no matches for Client. */
function tunedModel(): PartyTunedModel {
  return new PartyTunedModel({
    Contractor: sidecarPayload(sidecar),
    Client: favouredSidePayload(sidecar),
  });
}

function okOf<T extends RunOutcome | RerunOutcome>(outcome: T): Extract<T, { ok: true }> {
  if (!outcome.ok) throw new Error(`expected success, got ${outcome.error.code}`);
  return outcome as Extract<T, { ok: true }>;
}

const flagKey = (flag: Flag) => `${flag.redLineId}@${flag.offset}`;

type Row = StoredDocument & { analyses: Array<Omit<RerunRecord, "documentId" | "party">> };

/** An in-memory DocumentStore with the same all-or-nothing rerun as the SQL function. */
class MemoryDocuments implements DocumentStore {
  readonly rows = new Map<string, Row>();
  failNextRerun = false;
  loads = 0;

  add(document: StoredDocument, first: Omit<RerunRecord, "documentId" | "party">) {
    this.rows.set(document.id, { ...structuredClone(document), analyses: [structuredClone(first)] });
  }

  async load(documentId: string): Promise<StoredDocument | null> {
    this.loads += 1;
    const row = this.rows.get(documentId);
    if (!row) return null;
    const { analyses: _analyses, ...document } = row;
    return structuredClone(document);
  }

  async rerun(record: RerunRecord): Promise<void> {
    if (this.failNextRerun) throw new Error("rerun_document_analysis failed");
    const row = this.rows.get(record.documentId);
    if (!row) throw new Error("document not found");
    row.party = record.party;
    row.analyses.push(structuredClone({ redLinesSnapshot: record.redLinesSnapshot, flags: record.flags, receipt: record.receipt }));
  }

  latest(documentId: string) {
    const row = this.rows.get(documentId)!;
    return { party: row.party, analysis: row.analyses[row.analyses.length - 1], count: row.analyses.length };
  }
}

describe("party inversion (T5)", () => {
  it("finds both sides of the fixture as candidates to pick from", () => {
    expect(findPartyCandidates(text)).toEqual(sidecar.parties);
  });

  it("flags only the side a clause hurts: seven flags as Contractor, none as Client", async () => {
    const model = tunedModel();
    const asContractor = okOf(await runAnalysis({ text, party: "Contractor" }, { model, store: null, redLines }));
    const asClient = okOf(await runAnalysis({ text, party: "Client" }, { model, store: null, redLines }));

    expect(asContractor.flags).toHaveLength(7);
    expect(asContractor.flags.map(flagKey).sort()).toEqual(
      sidecar.flags.map((flag) => `${flag.redLineId}@${text.indexOf(flag.sentence)}`).sort(),
    );
    for (const flag of sidecar.flags) expect(flag.hurts).toBe("Contractor");

    expect(asClient.flags).toEqual([]);
    // A full receipt instead: one line per checked red line, each sentence verified in the text.
    expect(asClient.receipt.map((line) => line.redLineId)).toEqual([...DEFAULT_RED_LINE_IDS]);
    for (const line of asClient.receipt) {
      expect(line.kind).toBe("addressed");
      if (line.kind === "addressed") {
        expect(verifySourceSentence(text, line.sentence)).toEqual({ ok: true, offset: line.offset });
      }
    }

    const both = asClient.flags.map(flagKey).filter((key) => asContractor.flags.map(flagKey).includes(key));
    expect(both).toEqual([]);
  });

  it("passes the model exactly the party the reader chose, trimmed", async () => {
    const model = tunedModel();
    await runAnalysis({ text, party: "  Client  " }, { model, store: null, redLines });
    expect(model.calls.map((call) => call.metadata)).toEqual([{ party: "Client" }]);
  });

  it("never falls back to a party when none was chosen, and calls no model", async () => {
    const model = tunedModel();
    for (const body of [{ text }, { text, party: "" }, { text, party: " " }]) {
      const outcome = await runAnalysis(body, { model, store: null, redLines });
      expect(outcome.ok ? "ok" : outcome.error.code).toBe("missing_party");
    }
    expect(model.calls).toEqual([]);
  });
});

describe("rerunWithParty", () => {
  async function storedAsContractor() {
    const store = new MemoryDocuments();
    const first = okOf(await runAnalysis({ text, party: "Contractor" }, { model: tunedModel(), store: null, redLines }));
    store.add(
      { id: "doc-1", title: first.title, storedText: text, party: "Contractor" },
      { redLinesSnapshot: redLines, flags: first.flags, receipt: first.receipt },
    );
    return store;
  }

  it("replaces the party and the analysis: Contractor's seven flags become Client's full receipt", async () => {
    const store = await storedAsContractor();
    expect(store.latest("doc-1").analysis.flags).toHaveLength(7);

    const model = tunedModel();
    const outcome = okOf(await rerunWithParty("doc-1", { party: "Client" }, { model, store, redLines }));

    expect(outcome.party).toBe("Client");
    expect(outcome.flags).toEqual([]);
    expect(outcome.receipt).toHaveLength(DEFAULT_RED_LINE_IDS.length);
    expect(outcome.saved).toEqual({ kind: "saved", documentId: "doc-1" });
    expect(outcome.checkedRedLines.map((r) => r.id)).toEqual([...DEFAULT_RED_LINE_IDS]);

    const latest = store.latest("doc-1");
    expect(latest.party).toBe("Client");
    expect(latest.count).toBe(2);
    expect(latest.analysis.flags).toEqual([]);
    expect(latest.analysis.receipt).toEqual(outcome.receipt);
    expect(model.calls.map((call) => call.metadata)).toEqual([{ party: "Client" }]);
  });

  it("checks the stored text, never text sent with the request", async () => {
    const store = await storedAsContractor();
    // Back to Contractor, with a tampered text in the body. The flags verify against the stored text.
    const outcome = okOf(
      await rerunWithParty("doc-1", { party: "Contractor", text: "Contractor owes nothing." }, { model: tunedModel(), store, redLines }),
    );
    expect(outcome.flags).toHaveLength(7);
    for (const flag of outcome.flags) {
      expect(verifySourceSentence(text, flag.sourceSentence)).toEqual({ ok: true, offset: flag.offset });
    }
    expect(store.rows.get("doc-1")!.storedText).toBe(text);
  });

  it("keeps the old party and analysis when the model fails", async () => {
    const store = await storedAsContractor();
    const before = structuredClone(store.latest("doc-1"));
    const model = new FakeModel([{ throws: new Error("provider timed out") }]);
    const logs: string[] = [];

    const outcome = await rerunWithParty("doc-1", { party: "Client" }, { model, store, redLines, log: (m) => logs.push(m) });

    expect(outcome.ok ? "ok" : [outcome.status, outcome.error.code]).toEqual([502, "analysis_failed"]);
    expect(store.latest("doc-1")).toEqual(before);
    expect(logs.join("\n")).not.toContain(text.slice(0, 40));
  });

  it("keeps the old party and analysis when the save fails, and shows no new result", async () => {
    const store = await storedAsContractor();
    store.failNextRerun = true;
    const before = structuredClone(store.latest("doc-1"));
    const outcome = await rerunWithParty("doc-1", { party: "Client" }, { model: tunedModel(), store, redLines });
    expect(outcome.ok ? "ok" : outcome.error.code).toBe("save_failed");
    expect(store.latest("doc-1")).toEqual(before);
  });

  it("refuses a missing or empty party before loading anything or calling the model", async () => {
    const store = await storedAsContractor();
    const model = tunedModel();
    for (const body of [{}, { party: "" }, { party: "   " }, { party: null }]) {
      const outcome = await rerunWithParty("doc-1", body, { model, store, redLines });
      expect(outcome.ok ? "ok" : outcome.error.code).toBe("missing_party");
    }
    expect(store.loads).toBe(0);
    expect(model.calls).toEqual([]);
    expect(store.latest("doc-1").party).toBe("Contractor");
  });

  it("refuses a document the reader cannot see", async () => {
    const store = await storedAsContractor();
    const model = tunedModel();
    const outcome = await rerunWithParty("someone-elses", { party: "Client" }, { model, store, redLines });
    expect(outcome.ok ? "ok" : [outcome.status, outcome.error.code]).toEqual([404, "not_found"]);
    expect(model.calls).toEqual([]);
  });

  it("refuses when the model is not configured, changing nothing", async () => {
    const store = await storedAsContractor();
    const outcome = await rerunWithParty("doc-1", { party: "Client" }, { model: null, store, redLines });
    expect(outcome.ok ? "ok" : outcome.error.code).toBe("model_unavailable");
    expect(store.latest("doc-1").party).toBe("Contractor");
  });
});
