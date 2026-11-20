// The library against real Postgres (PGlite) with the real migrations (ticket 10, stories 47 to 51).
// Documents are saved by a real analysis of the fixture (fake model) through the real save RPC; the
// library view, opening a stored result, deleting, and rerunning with the reader's current red
// lines then run as each reader, through row-level security. Only the model and the Supabase
// transport are replaced.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ResultView } from "../../app/analysis/result-view.tsx";
import { rerunWithCurrentRedLines, type RerunOutcome } from "../../lib/analysis/rerun.ts";
import { runAnalysis, type AnalysisRecord } from "../../lib/analysis/run.ts";
import { deleteDocument, listLibrary, openStoredResult } from "../../lib/documents/library.ts";
import { DEFAULT_RED_LINE_IDS } from "../../lib/red-lines/defaults.ts";
import { enabledRedLines, redLineStore } from "../../lib/red-lines/store.ts";
import { FakeModel, fakeModel, favouredSidePayload, loadContract, sidecarPayload } from "../support/fake-model.ts";
import { createTestDb, type TestDb } from "./harness.ts";
import { pgDocumentStore, pgLibraryTransport, saveDocument } from "./library-transport.ts";
import { pgTransport } from "./red-line-transport.ts";

const oneSided = loadContract("one-sided-services-agreement");
const benign = loadContract("benign-services-agreement");

describe("the library under row-level security", () => {
  let t: TestDb;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    t = await createTestDb();
    alice = await t.createAuthUser("alice@example.com");
    bob = await t.createAuthUser("bob@example.com");
  });

  afterAll(async () => {
    await t.close();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** The reader's enabled red lines, seeded and read through the real red line store. */
  async function currentRedLines(reader: string) {
    return enabledRedLines(await redLineStore(pgTransport(t, reader)).listForReader());
  }

  /** Checks a fixture as `reader` with the fake model and saves it through the real RPC. */
  async function check(reader: string, fixture = oneSided, party = "Contractor", title?: string): Promise<string> {
    const redLines = await currentRedLines(reader);
    const model = fakeModel(sidecarPayload(fixture.sidecar, redLines.map((r) => r.id)));
    const store = {
      save: (record: AnalysisRecord) =>
        saveDocument(t, reader, {
          title: record.title,
          storedText: record.storedText,
          party: record.party,
          snapshot: record.redLinesSnapshot,
          flags: record.flags,
          receipt: record.receipt,
        }),
    };
    const outcome = await runAnalysis({ text: fixture.text, party, ...(title ? { title } : {}) }, { model, store, redLines });
    if (!outcome.ok || outcome.saved.kind !== "saved") throw new Error("expected a saved analysis");
    return outcome.saved.documentId;
  }

  async function analysesOf(documentId: string) {
    const { rows } = await t.db.query<{ red_lines_snapshot: Array<{ id: string }>; flags: unknown[] }>(
      "select red_lines_snapshot, flags from public.analyses where document_id = $1 order by created_at, id",
      [documentId],
    );
    return rows;
  }

  async function exists(documentId: string): Promise<boolean> {
    const { rows } = await t.db.query("select 1 from public.documents where id = $1", [documentId]);
    return rows.length === 1;
  }

  function okOf(outcome: RerunOutcome) {
    if (!outcome.ok) throw new Error(`expected success, got ${outcome.error.code}`);
    return outcome;
  }

  describe("listing", () => {
    let reader: string;

    beforeAll(async () => {
      reader = await t.createAuthUser("lister@example.com");
    });

    it("is empty for a reader with no documents", async () => {
      expect(await listLibrary(pgLibraryTransport(t, reader))).toEqual([]);
    });

    it("lists each document newest first with its title, party, date and per-tier counts", async () => {
      const first = await check(reader, oneSided, "Contractor", "Quillmont data work");
      const second = await check(reader, benign, "Contractor");

      const entries = await listLibrary(pgLibraryTransport(t, reader));
      expect(entries.map((e) => e.id)).toEqual([second, first]);
      expect(entries[1]).toMatchObject({
        title: "Quillmont data work",
        party: "Contractor",
        counts: { Severe: 4, Moderate: 1, Minor: 2 },
      });
      expect(Number.isNaN(Date.parse(entries[1].createdAt))).toBe(false);
      expect(entries[0]).toMatchObject({
        title: "Independent Contractor Services Agreement: Tallowfield Studio LLC and Dana Orlecki",
        counts: { Severe: 0, Moderate: 0, Minor: 0 },
      });
    });

    it("counts flags from the latest analysis only", async () => {
      const id = await check(reader);
      // A rerun as the favoured side: a full receipt, no flags.
      const model = fakeModel(favouredSidePayload(oneSided.sidecar));
      const { rerunWithParty } = await import("../../lib/analysis/rerun.ts");
      okOf(await rerunWithParty(id, { party: "Client" }, { model, store: pgDocumentStore(t, reader), redLines: await currentRedLines(reader) }));
      expect(await analysesOf(id)).toHaveLength(2);

      const entry = (await listLibrary(pgLibraryTransport(t, reader))).find((e) => e.id === id);
      expect(entry).toMatchObject({ party: "Client", counts: { Severe: 0, Moderate: 0, Minor: 0 } });
    });

    it("leaves out of the counts a stored flag the document page would not show", async () => {
      const text = "The Contractor assigns all rights. The Client pays when it wishes.";
      const good = { redLineId: "ip-assignment", redLineTitle: "IP", tier: "Severe", statement: "S.", sourceSentence: "The Contractor assigns all rights.", offset: 0, counterOffer: "C." };
      const id = await saveDocument(t, reader, {
        title: "Edge cases",
        storedText: text,
        party: "Contractor",
        snapshot: [{ id: "ip-assignment", title: "IP" }],
        flags: [
          good,
          { ...good, tier: "Moderate", sourceSentence: "A sentence that is not in the text." },
          { ...good, tier: "Minor", counterOffer: "  " },
          { ...good, tier: "Catastrophic" },
          "not a flag",
        ],
      });
      const entry = (await listLibrary(pgLibraryTransport(t, reader))).find((e) => e.id === id);
      expect(entry?.counts).toEqual({ Severe: 1, Moderate: 0, Minor: 0 });
      const opened = await openStoredResult(pgLibraryTransport(t, reader), id);
      expect(opened?.flags).toHaveLength(1);
    });
  });

  describe("what one reader can reach of another's", () => {
    let bobDocument: string;

    beforeAll(async () => {
      bobDocument = await check(bob);
    });

    it("does not list another reader's documents", async () => {
      await check(alice);
      const ids = (await listLibrary(pgLibraryTransport(t, alice))).map((e) => e.id);
      expect(ids).not.toContain(bobDocument);
      expect(ids.length).toBeGreaterThan(0);
      const { rows } = await t.asUser(alice, "select id from public.library_entries where id = $1", [bobDocument]);
      expect(rows).toEqual([]);
    });

    it("opens another reader's document as not found, the same as an id that never existed", async () => {
      const transport = pgLibraryTransport(t, alice);
      expect(await openStoredResult(transport, bobDocument)).toBeNull();
      expect(await openStoredResult(transport, "00000000-0000-4000-8000-000000000000")).toBeNull();
      expect(await openStoredResult(transport, "not-a-uuid")).toBeNull();
      expect(await openStoredResult(pgLibraryTransport(t, bob), bobDocument)).not.toBeNull();
    });

    it("does not let another reader delete it", async () => {
      expect(await deleteDocument(pgLibraryTransport(t, alice), bobDocument)).toEqual({ ok: false, code: "not_found" });
      expect(await exists(bobDocument)).toBe(true);
      expect(await analysesOf(bobDocument)).toHaveLength(1);
    });

    it("does not let another reader rerun it, and calls no model", async () => {
      const model = new FakeModel([]);
      const outcome = await rerunWithCurrentRedLines(bobDocument, {
        model,
        store: pgDocumentStore(t, alice),
        redLines: await currentRedLines(alice),
      });
      expect(outcome).toMatchObject({ ok: false, status: 404, error: { code: "not_found" } });
      expect(model.calls).toHaveLength(0);
      expect(await analysesOf(bobDocument)).toHaveLength(1);
    });

    it("gives a signed-out visitor nothing from the library view", async () => {
      await expect(t.asAnon("select id from public.library_entries")).rejects.toThrow(/permission denied/);
    });
  });

  describe("deleting", () => {
    it("removes the document and every analysis of it", async () => {
      const id = await check(alice);
      const { rerunWithParty } = await import("../../lib/analysis/rerun.ts");
      okOf(
        await rerunWithParty(id, { party: "Client" }, {
          model: fakeModel(favouredSidePayload(oneSided.sidecar)),
          store: pgDocumentStore(t, alice),
          redLines: await currentRedLines(alice),
        }),
      );
      expect(await analysesOf(id)).toHaveLength(2);

      expect(await deleteDocument(pgLibraryTransport(t, alice), id)).toEqual({ ok: true });
      expect(await exists(id)).toBe(false);
      expect(await analysesOf(id)).toHaveLength(0);
      expect((await listLibrary(pgLibraryTransport(t, alice))).map((e) => e.id)).not.toContain(id);
      expect(await openStoredResult(pgLibraryTransport(t, alice), id)).toBeNull();
      // Deleting again finds nothing.
      expect(await deleteDocument(pgLibraryTransport(t, alice), id)).toEqual({ ok: false, code: "not_found" });
    });

    it("refuses an id that is not a document id without touching the database", async () => {
      const transport = { ...pgLibraryTransport(t, alice), deleteDocument: vi.fn(async () => true) };
      expect(await deleteDocument(transport, "../../etc")).toEqual({ ok: false, code: "not_found" });
      expect(transport.deleteDocument).not.toHaveBeenCalled();
    });

    it("reports a database failure as failed, not as deleted", async () => {
      const transport = {
        ...pgLibraryTransport(t, alice),
        deleteDocument: async () => {
          throw new Error("connection reset");
        },
      };
      const log = vi.fn();
      expect(await deleteDocument(transport, "00000000-0000-4000-8000-000000000001", log)).toEqual({ ok: false, code: "failed" });
      expect(log).toHaveBeenCalledOnce();
    });
  });

  describe("checking again with the reader's current red lines (story 51)", () => {
    it("stores a new analysis with the current snapshot, keeps the old one, and keeps the party", async () => {
      const reader = await t.createAuthUser("rerun@example.com");
      const id = await check(reader);
      const before = await analysesOf(id);
      expect(before[0].red_lines_snapshot.map((r) => r.id)).toEqual([...DEFAULT_RED_LINE_IDS]);

      // The reader switches IP assignment off and arbitration on.
      const store = redLineStore(pgTransport(t, reader));
      const list = await store.listForReader();
      await store.setEnabled(list.find((r) => r.productId === "ip-assignment")!.rowId, false);
      await store.setEnabled(list.find((r) => r.productId === "arbitration")!.rowId, true);
      const redLines = await currentRedLines(reader);
      const currentIds = redLines.map((r) => r.id);
      expect(currentIds).not.toContain("ip-assignment");
      expect(currentIds).toContain("arbitration");

      // The fake answers with every planted flag, IP assignment included; analysis drops those.
      const model = fakeModel(sidecarPayload(oneSided.sidecar, currentIds));
      const outcome = okOf(await rerunWithCurrentRedLines(id, { model, store: pgDocumentStore(t, reader), redLines }));
      expect(model.calls).toHaveLength(1);
      expect(model.calls[0].metadata?.party).toBe("Contractor");
      expect(outcome.party).toBe("Contractor");
      expect(outcome.checkedRedLines.map((r) => r.id)).toEqual(currentIds);
      expect(outcome.flags.some((f) => f.redLineId === "ip-assignment")).toBe(false);

      const after = await analysesOf(id);
      expect(after).toHaveLength(2);
      expect(after[0]).toEqual(before[0]);
      expect(after[1].red_lines_snapshot.map((r) => r.id)).toEqual(currentIds);

      const opened = await openStoredResult(pgLibraryTransport(t, reader), id);
      expect(opened?.party).toBe("Contractor");
      expect(opened?.checkedRedLines.map((r) => r.id)).toEqual(currentIds);
      expect(opened?.flags).toEqual(outcome.flags);
      const entry = (await listLibrary(pgLibraryTransport(t, reader))).find((e) => e.id === id);
      expect(entry?.counts).toEqual({ Severe: 3, Moderate: 1, Minor: 1 });
    });

    it("changes nothing when the model fails", async () => {
      const reader = await t.createAuthUser("rerun-fail@example.com");
      const id = await check(reader);
      const before = await analysesOf(id);
      const openedBefore = await openStoredResult(pgLibraryTransport(t, reader), id);

      for (const model of [new FakeModel([{ throws: new Error("timeout") }]), new FakeModel([{ raw: "not json" }])]) {
        const outcome = await rerunWithCurrentRedLines(id, {
          model,
          store: pgDocumentStore(t, reader),
          redLines: await currentRedLines(reader),
        });
        expect(outcome).toMatchObject({ ok: false, status: 502, error: { code: "analysis_failed" } });
      }
      expect(await analysesOf(id)).toEqual(before);
      expect(await openStoredResult(pgLibraryTransport(t, reader), id)).toEqual(openedBefore);
    });

    it("refuses when the reader has every red line switched off, before any model call", async () => {
      const reader = await t.createAuthUser("rerun-none@example.com");
      const id = await check(reader);
      const model = new FakeModel([]);
      const outcome = await rerunWithCurrentRedLines(id, { model, store: pgDocumentStore(t, reader), redLines: [] });
      expect(outcome).toMatchObject({ ok: false, error: { code: "no_red_lines" } });
      expect(model.calls).toHaveLength(0);
      expect(await analysesOf(id)).toHaveLength(1);
    });
  });

  describe("reopening a stored document (story 48)", () => {
    it("shows the stored result exactly as it was, with no model call and no network request", async () => {
      const id = await check(alice);
      const stored = await t.db.query<{ flags: unknown }>(
        "select flags from public.analyses where document_id = $1",
        [id],
      );

      // Any model call goes out over fetch (lib/analysis/openrouter-client.ts). Fail loudly if one does.
      const fetchSpy = vi.fn(async () => {
        throw new Error("no network call is expected when reopening a document");
      });
      vi.stubGlobal("fetch", fetchSpy);

      const opened = await openStoredResult(pgLibraryTransport(t, alice), id);
      if (!opened) throw new Error("expected the stored result");
      expect(opened.flags).toEqual(stored.rows[0].flags);
      expect(opened.party).toBe("Contractor");
      expect(opened.checkedRedLines.map((r) => r.id)).toEqual([...DEFAULT_RED_LINE_IDS]);

      const html = renderToStaticMarkup(
        createElement(ResultView, {
          storedText: opened.storedText,
          party: opened.party,
          flags: opened.flags,
          receipt: opened.receipt,
          checkedRedLines: opened.checkedRedLines,
        }),
      );
      for (const flag of oneSided.sidecar.flags) {
        expect(html).toContain(flag.tier);
      }
      expect(html).toContain("Contractor");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
