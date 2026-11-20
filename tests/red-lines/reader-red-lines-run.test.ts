// Analysis with a reader's own red lines (ticket 08). The fake model is the only thing faked;
// validation, analysis, verification and the snapshot run for real.
import { describe, expect, it } from "vitest";
import { rerunWithParty, type DocumentStore, type RerunRecord } from "../../lib/analysis/rerun.ts";
import { rulebookFor } from "../../lib/analysis/rulebook.ts";
import { runAnalysis, RUN_ERROR_MESSAGES, type AnalysisRecord, type AnalysisStore } from "../../lib/analysis/run.ts";
import { DEFAULT_RED_LINE_IDS, PRODUCT_RED_LINES } from "../../lib/red-lines/defaults.ts";
import { NO_RED_LINES_MESSAGE } from "../../lib/red-lines/messages.ts";
import { enabledRedLines, fromRow, seedRows, type StoredRedLine } from "../../lib/red-lines/store.ts";
import { analysisPayload, candidateFromSidecar, fakeModel, loadContract, sidecarPayload } from "../support/fake-model.ts";

const { text, sidecar } = loadContract("one-sided-services-agreement");

/** A reader's stored list, as fromRow maps it, with these product ids switched on. */
function readerList(on: readonly string[]): StoredRedLine[] {
  return seedRows().map((row, i) =>
    fromRow({ ...row, id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, enabled: on.includes(row.product_id) }),
  );
}

class MemoryStore implements AnalysisStore {
  readonly saved: AnalysisRecord[] = [];
  async save(record: AnalysisRecord): Promise<string> {
    this.saved.push(structuredClone(record));
    return `doc-${this.saved.length}`;
  }
}

describe("analysis with the reader's red lines", () => {
  // Reader switched IP assignment off and arbitration on.
  const on = ["uncapped-indemnity", "non-compete", "discretionary-payment", "termination-without-pay", "arbitration"];
  const redLines = enabledRedLines(readerList(on));

  it("sends and checks only the enabled red lines, and ignores candidates for a switched-off one", async () => {
    const model = fakeModel(sidecarPayload(sidecar, on)); // includes the planted ip-assignment flags
    const store = new MemoryStore();
    const outcome = await runAnalysis({ text, party: "Contractor" }, { model, store, redLines });
    if (!outcome.ok) throw new Error(outcome.error.code);

    const schema = model.calls[0].jsonSchema as {
      properties: { redLines: { items: { properties: { redLineId: { enum: string[] } } } } };
    };
    expect(schema.properties.redLines.items.properties.redLineId.enum).toEqual(on);
    expect(sidecar.flags.some((f) => f.redLineId === "ip-assignment")).toBe(true);
    expect(outcome.flags.map((f) => f.redLineId)).not.toContain("ip-assignment");
    expect(outcome.receipt.map((r) => r.redLineId)).not.toContain("ip-assignment");
    expect(outcome.checkedRedLines.map((r) => r.id)).toEqual(on);
    const accounted = new Set([...outcome.flags.map((f) => f.redLineId), ...outcome.receipt.map((r) => r.redLineId)]);
    expect([...accounted].sort()).toEqual([...on].sort());
  });

  it("stores the full enabled set as the snapshot: id, kind, title, description and tiers", async () => {
    const store = new MemoryStore();
    await runAnalysis({ text, party: "Contractor" }, { model: fakeModel(sidecarPayload(sidecar, on)), store, redLines });
    const arbitration = PRODUCT_RED_LINES.find((r) => r.id === "arbitration")!;
    expect(store.saved[0].redLinesSnapshot).toHaveLength(5);
    expect(store.saved[0].redLinesSnapshot[4]).toEqual({
      id: "arbitration",
      kind: "offered",
      title: arbitration.title,
      description: arbitration.description,
      tiers: arbitration.tiers,
    });
    for (const entry of store.saved[0].redLinesSnapshot) {
      expect(Object.keys(entry).sort()).toEqual(["description", "id", "kind", "tiers", "title"]);
    }
  });

  it("refuses a check with every red line switched off, before any model call, and stores nothing", async () => {
    const model = fakeModel(sidecarPayload(sidecar));
    const store = new MemoryStore();
    const outcome = await runAnalysis(
      { text, party: "Contractor" },
      { model, store, redLines: enabledRedLines(readerList([])) },
    );
    expect(outcome).toEqual({ ok: false, status: 422, error: { code: "no_red_lines", message: NO_RED_LINES_MESSAGE } });
    expect(RUN_ERROR_MESSAGES.no_red_lines).toBe(NO_RED_LINES_MESSAGE);
    expect(model.calls).toHaveLength(0);
    expect(store.saved).toHaveLength(0);
  });

  it("refuses a rerun with every red line switched off, before any model call, changing nothing", async () => {
    const reruns: RerunRecord[] = [];
    const docs: DocumentStore = {
      async load(id) {
        return { id, title: "T", storedText: text, party: "Contractor" };
      },
      async rerun(record) {
        reruns.push(record);
      },
    };
    const model = fakeModel(sidecarPayload(sidecar));
    const outcome = await rerunWithParty("doc-1", { party: "Client" }, { model, store: docs, redLines: [] });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe("no_red_lines");
    expect(model.calls).toHaveLength(0);
    expect(reruns).toHaveLength(0);
  });

  it("stores the reader's red lines as the snapshot on a rerun", async () => {
    const reruns: RerunRecord[] = [];
    const docs: DocumentStore = {
      async load(id) {
        return { id, title: "T", storedText: text, party: "Contractor" };
      },
      async rerun(record) {
        reruns.push(record);
      },
    };
    const outcome = await rerunWithParty(
      "doc-1",
      { party: "Contractor" },
      { model: fakeModel(analysisPayload(on, sidecar.flags.map((f) => candidateFromSidecar(f)))), store: docs, redLines },
    );
    expect(outcome.ok).toBe(true);
    expect(reruns[0].redLinesSnapshot).toEqual(redLines);
  });
});

describe("rulebookFor", () => {
  it("uses the five defaults held in code when nobody is signed in", async () => {
    const rulebook = await rulebookFor(null);
    if (!rulebook.ok) throw new Error("expected defaults");
    expect(rulebook.redLines.map((r) => r.id)).toEqual([...DEFAULT_RED_LINE_IDS]);
  });

  it("uses exactly the signed-in reader's enabled red lines", async () => {
    const mine = enabledRedLines(readerList(["late-fees"]));
    expect(await rulebookFor(async () => mine)).toEqual({ ok: true, redLines: mine });
  });

  it("returns an error, never the defaults, when a signed-in reader's list can't be loaded", async () => {
    const rulebook = await rulebookFor(async () => {
      throw new Error("network down");
    });
    expect(rulebook).toEqual({ ok: false, error: "network down" });
  });
});
