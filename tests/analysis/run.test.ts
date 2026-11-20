// The check request end to end, with the fake model (the external boundary) and an in-memory
// store standing in for Supabase. Validation, analysis, verification and the store-or-not decision
// all run for real.
import { describe, expect, it } from "vitest";
import { verifySourceSentence } from "../../lib/analysis/verify.ts";
import {
  runAnalysis,
  type AnalysisRecord,
  type AnalysisStore,
  type RunOutcome,
} from "../../lib/analysis/run.ts";
import { MAX_DOCUMENT_CHARS } from "../../lib/intake/text-file.ts";
import { MAX_TITLE_CHARS, suggestTitle } from "../../lib/intake/title.ts";
import { DEFAULT_RED_LINE_IDS, defaultEnabledRedLines } from "../../lib/red-lines/defaults.ts";
import { FakeModel, fakeModel, loadContract, sidecarPayload } from "../support/fake-model.ts";

const { text, sidecar } = loadContract("one-sided-services-agreement");
const redLines = defaultEnabledRedLines();

class MemoryStore implements AnalysisStore {
  readonly saved: Array<AnalysisRecord & { id: string }> = [];
  failNext = false;

  async save(record: AnalysisRecord): Promise<string> {
    if (this.failNext) throw new Error("insert failed");
    const id = `doc-${this.saved.length + 1}`;
    this.saved.push({ ...structuredClone(record), id });
    return id;
  }
}

function okOf(outcome: RunOutcome) {
  if (!outcome.ok) throw new Error(`expected success, got ${outcome.error.code}`);
  return outcome;
}

describe("runAnalysis", () => {
  it("returns verified flags and stores the document and analysis once when signed in", async () => {
    const store = new MemoryStore();
    const model = fakeModel(sidecarPayload(sidecar));
    const outcome = okOf(await runAnalysis({ text, party: "Contractor" }, { model, store, redLines }));

    expect(outcome.flags).toHaveLength(sidecar.flags.length);
    for (const flag of outcome.flags) {
      expect(verifySourceSentence(text, flag.sourceSentence)).toEqual({ ok: true, offset: flag.offset });
    }
    expect(outcome.checkedRedLines.map((r) => r.id)).toEqual([...DEFAULT_RED_LINE_IDS]);
    expect(outcome.saved).toEqual({ kind: "saved", documentId: "doc-1" });

    expect(store.saved).toHaveLength(1);
    const record = store.saved[0];
    expect(record.storedText).toBe(text);
    expect(record.party).toBe("Contractor");
    expect(record.title).toBe(suggestTitle(text));
    expect(outcome.title).toBe(record.title);
    expect(record.flags).toEqual(outcome.flags);
    expect(outcome.receipt).toEqual([
      {
        redLineId: "termination-without-pay",
        redLineTitle: "Termination without notice, or without pay for work already done",
        kind: "addressed",
        sentence: sidecar.receipt[0].addressingSentence,
        offset: text.indexOf(sidecar.receipt[0].addressingSentence),
      },
    ]);
    expect(record.receipt).toEqual(outcome.receipt);
    expect(record.redLinesSnapshot.map((r) => r.id)).toEqual([...DEFAULT_RED_LINE_IDS]);
    expect(record.redLinesSnapshot[0].tiers.Severe).toBeTruthy();
    expect(model.calls).toHaveLength(1);
  });

  it("stores the party trimmed, as the reader typed it", async () => {
    const store = new MemoryStore();
    await runAnalysis({ text, party: "  Contractor " }, { model: fakeModel(sidecarPayload(sidecar)), store, redLines });
    expect(store.saved[0].party).toBe("Contractor");
  });

  it("returns flags but stores nothing when signed out", async () => {
    const model = fakeModel(sidecarPayload(sidecar));
    const outcome = okOf(await runAnalysis({ text, party: "Contractor" }, { model, store: null, redLines }));
    expect(outcome.flags).toHaveLength(sidecar.flags.length);
    expect(outcome.saved).toEqual({ kind: "not_kept" });
  });

  it("stores nothing and returns an error when the model call fails", async () => {
    const store = new MemoryStore();
    const logged: string[] = [];
    const model = new FakeModel([{ throws: new Error("timeout") }]);
    const outcome = await runAnalysis(
      { text, party: "Contractor" },
      { model, store, redLines, log: (m) => logged.push(m) },
    );
    expect(outcome).toMatchObject({ ok: false, status: 502, error: { code: "analysis_failed" } });
    expect(outcome).not.toHaveProperty("flags");
    expect(store.saved).toHaveLength(0);
    expect(logged.join("\n")).toMatch(/model_failed/);
    expect(logged.join("\n")).not.toContain(text.slice(0, 200));
  });

  it("stores nothing and returns an error when the model output is malformed", async () => {
    const store = new MemoryStore();
    const model = new FakeModel([{ raw: '{"redLines": [{"redLineId": ' }]);
    const outcome = await runAnalysis({ text, party: "Contractor" }, { model, store, redLines });
    expect(outcome).toMatchObject({ ok: false, error: { code: "analysis_failed" } });
    expect(store.saved).toHaveLength(0);
  });

  it("returns the result marked unsaved when the store fails, with nothing stored", async () => {
    const store = new MemoryStore();
    store.failNext = true;
    const outcome = okOf(
      await runAnalysis({ text, party: "Contractor" }, { model: fakeModel(sidecarPayload(sidecar)), store, redLines }),
    );
    expect(outcome.saved).toEqual({ kind: "save_failed" });
    expect(store.saved).toHaveLength(0);
  });

  it("refuses when the model is not configured, before anything is stored", async () => {
    const store = new MemoryStore();
    const outcome = await runAnalysis({ text, party: "Contractor" }, { model: null, store, redLines });
    expect(outcome).toMatchObject({ ok: false, status: 503, error: { code: "model_unavailable" } });
    expect(store.saved).toHaveLength(0);
  });

  const refusals: Array<[string, unknown, string]> = [
    ["the party is missing", { text }, "missing_party"],
    ["the party is empty", { text, party: "" }, "missing_party"],
    ["the party is whitespace", { text, party: "   " }, "missing_party"],
    ["the party is too long", { text, party: "C".repeat(121) }, "party_too_long"],
    ["the text is empty", { text: "", party: "Contractor" }, "empty_text"],
    ["the text is too long", { text: "a".repeat(MAX_DOCUMENT_CHARS + 1), party: "Contractor" }, "text_too_long"],
    ["the text is not normalised", { text: text.replace(/\n\n/g, "\r\n\r\n"), party: "Contractor" }, "not_normalised"],
    ["the text has doubled spaces", { text: text.replace("Agreement", "Agreement  "), party: "Contractor" }, "not_normalised"],
    ["the body is not an object", "text=hello", "bad_request"],
    ["the text is not a string", { text: 42, party: "Contractor" }, "bad_request"],
  ];

  for (const [name, body, code] of refusals) {
    it(`refuses before any model call when ${name}`, async () => {
      const store = new MemoryStore();
      const model = new FakeModel([]);
      const outcome = await runAnalysis(body, { model, store, redLines });
      expect(outcome).toMatchObject({ ok: false, error: { code } });
      expect(!outcome.ok && outcome.error.message.length).toBeGreaterThan(0);
      expect(model.calls).toHaveLength(0);
      expect(store.saved).toHaveLength(0);
    });
  }
});

describe("runAnalysis with a title (story 5)", () => {
  it("stores the reader's title, trimmed, instead of the suggested one", async () => {
    const store = new MemoryStore();
    const model = fakeModel(sidecarPayload(sidecar));
    const outcome = okOf(
      await runAnalysis({ text, party: "Contractor", title: "  Quillmont   data work, March  " }, { model, store, redLines }),
    );
    expect(outcome.title).toBe("Quillmont data work, March");
    expect(store.saved[0].title).toBe("Quillmont data work, March");
  });

  it("falls back to the suggested title when the request carries none", async () => {
    const store = new MemoryStore();
    const outcome = okOf(await runAnalysis({ text, party: "Contractor" }, { model: fakeModel(sidecarPayload(sidecar)), store, redLines }));
    expect(outcome.title).toBe("Independent Contractor Services Agreement: Quillmont Analytics LLC and Rowan Tellisford");
    expect(store.saved[0].title).toBe(outcome.title);
  });

  for (const [title, code] of [
    ["", "missing_title"],
    ["   \n ", "missing_title"],
    ["x".repeat(MAX_TITLE_CHARS + 1), "title_too_long"],
    [42, "bad_request"],
  ] as const) {
    it(`refuses the title ${JSON.stringify(title).slice(0, 20)} with ${code}, before any model call, storing nothing`, async () => {
      const store = new MemoryStore();
      const model = new FakeModel([]);
      const outcome = await runAnalysis({ text, party: "Contractor", title }, { model, store, redLines });
      expect(outcome).toMatchObject({ ok: false, status: 400, error: { code } });
      expect(model.calls).toHaveLength(0);
      expect(store.saved).toHaveLength(0);
    });
  }

  it("accepts a title exactly at the limit", async () => {
    const store = new MemoryStore();
    const title = "y".repeat(MAX_TITLE_CHARS);
    const outcome = okOf(await runAnalysis({ text, party: "Contractor", title }, { model: fakeModel(sidecarPayload(sidecar)), store, redLines }));
    expect(store.saved[0].title).toBe(title);
    expect(outcome.title).toBe(title);
  });
});
