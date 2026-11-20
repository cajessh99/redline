// Stored red lines against the real migrations in PGlite (ticket 08). The store runs for real over
// a transport that sends its SQL through row-level security as the signed-in reader; only the
// Supabase transport itself is replaced.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ResultView } from "../../app/analysis/result-view.tsx";
import { parseCheckedRedLines, parseStoredFlags, parseStoredReceipt } from "../../lib/analysis/stored.ts";
import { runAnalysis, type AnalysisRecord } from "../../lib/analysis/run.ts";
import { DEFAULT_RED_LINE_IDS, OFFERED_RED_LINE_IDS, PRODUCT_RED_LINES } from "../../lib/red-lines/defaults.ts";
import {
  enabledRedLines,
  fromRow,
  redLineStore,
  RedLineNotFoundError,
  seedRows,
  type RedLineRow,
} from "../../lib/red-lines/store.ts";
import { fakeModel, loadContract, sidecarPayload } from "../support/fake-model.ts";
import { createTestDb, type TestDb } from "./harness.ts";
import { pgTransport } from "./red-line-transport.ts";

describe("red lines under row-level security", () => {
  let t: TestDb;
  let alice: string;
  let bob: string;

  async function count(reader: string): Promise<number> {
    const { rows } = await t.db.query<{ n: number }>("select count(*)::int as n from public.red_lines where reader_id = $1", [reader]);
    return rows[0].n;
  }

  beforeAll(async () => {
    t = await createTestDb();
    alice = await t.createAuthUser("alice@example.com");
    bob = await t.createAuthUser("bob@example.com");
  });

  afterAll(async () => {
    await t.close();
  });

  it("seeds a new reader's list once: the five defaults on and the six offered off, worded as in code", async () => {
    const store = redLineStore(pgTransport(t, alice));
    const list = await store.listForReader();
    expect(list.map((r) => r.id)).toEqual([...DEFAULT_RED_LINE_IDS, ...OFFERED_RED_LINE_IDS]);
    for (const [i, redLine] of list.entries()) {
      const product = PRODUCT_RED_LINES[i];
      expect(redLine).toMatchObject({
        id: product.id,
        productId: product.id,
        kind: product.kind,
        title: product.title,
        description: product.description,
        tiers: product.tiers,
        enabled: product.enabledByDefault,
        position: i,
      });
      expect(redLine.rowId).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(enabledRedLines(list).map((r) => r.id)).toEqual([...DEFAULT_RED_LINE_IDS]);

    // Listing again, and calling the seed directly, inserts nothing more.
    await store.listForReader();
    expect(await pgTransport(t, alice).seed(seedRows())).toBe(0);
    expect(await count(alice)).toBe(11);
    const { rows } = await t.db.query<{ red_lines_seeded_at: string | null }>(
      "select red_lines_seeded_at from public.readers where id = $1",
      [alice],
    );
    expect(rows[0].red_lines_seeded_at).not.toBeNull();
  });

  it("does not seed again after the reader deletes every row", async () => {
    const carol = await t.createAuthUser("carol@example.com");
    const store = redLineStore(pgTransport(t, carol));
    expect(await store.listForReader()).toHaveLength(11);
    const deleted = await t.asUser(carol, "delete from public.red_lines");
    expect(deleted.affectedRows).toBe(11);
    expect(await store.listForReader()).toEqual([]);
    expect(await count(carol)).toBe(0);
  });

  it("switches a red line and keeps the change across sessions", async () => {
    const store = redLineStore(pgTransport(t, alice));
    const arbitration = (await store.listForReader()).find((r) => r.id === "arbitration")!;
    const saved = await store.setEnabled(arbitration.rowId, true);
    expect(saved).toMatchObject({ id: "arbitration", enabled: true });

    // A fresh store, as a later request would build.
    const again = await redLineStore(pgTransport(t, alice)).listForReader();
    expect(enabledRedLines(again).map((r) => r.id)).toEqual([...DEFAULT_RED_LINE_IDS, "arbitration"]);
    await store.setEnabled(arbitration.rowId, false);
  });

  it("does not let another reader read or switch my rows", async () => {
    const aliceRows = await redLineStore(pgTransport(t, alice)).listForReader();
    const bobStore = redLineStore(pgTransport(t, bob));
    const bobRows = await bobStore.listForReader();
    expect(bobRows).toHaveLength(11);
    expect(bobRows.map((r) => r.rowId)).not.toContain(aliceRows[0].rowId);

    const seen = await t.asUser(bob, "select id from public.red_lines where reader_id = $1", [alice]);
    expect(seen.rows).toEqual([]);
    await expect(bobStore.setEnabled(aliceRows[0].rowId, false)).rejects.toBeInstanceOf(RedLineNotFoundError);
    const deleted = await t.asUser(bob, "delete from public.red_lines where id = $1", [aliceRows[0].rowId]);
    expect(deleted.affectedRows).toBe(0);
    const { rows } = await t.db.query<{ enabled: boolean }>("select enabled from public.red_lines where id = $1", [aliceRows[0].rowId]);
    expect(rows[0].enabled).toBe(true);
    await expect(
      t.asUser(bob, "insert into public.red_lines (reader_id, kind, title, description, tiers, enabled, position) values ($1, 'reader', 'x', 'y', '{}'::jsonb, true, 99)", [alice]),
    ).rejects.toThrow(/row-level security/);
  });

  it("shows a signed-out visitor nothing and refuses them the seed", async () => {
    expect((await t.asAnon("select id from public.red_lines")).rows).toEqual([]);
    await expect(t.asAnon("select public.seed_red_lines('[]'::jsonb)")).rejects.toThrow();
  });

  it("refuses a product row with an unknown id, or a reader row that claims a product id", async () => {
    const dave = await t.createAuthUser("dave@example.com");
    await expect(
      t.asUser(dave, "insert into public.red_lines (product_id, kind, title, description, tiers, enabled, position) values ('made-up', 'default', 't', 'd', '{}'::jsonb, true, 0)"),
    ).rejects.toThrow(/check constraint/);
    await expect(
      t.asUser(dave, "insert into public.red_lines (product_id, kind, title, description, tiers, enabled, position) values ('arbitration', 'reader', 't', 'd', '{}'::jsonb, true, 0)"),
    ).rejects.toThrow(/check constraint/);
  });

  it("keeps a stored analysis snapshot, and the result's titles, unchanged when red lines are edited later", async () => {
    const { text, sidecar } = loadContract("one-sided-services-agreement");
    const erin = await t.createAuthUser("erin@example.com");
    const store = redLineStore(pgTransport(t, erin));
    const redLines = enabledRedLines(await store.listForReader());

    // Run the real check and store it through the real save RPC.
    let saved: AnalysisRecord | null = null;
    const outcome = await runAnalysis(
      { text, party: "Contractor" },
      {
        model: fakeModel(sidecarPayload(sidecar)),
        redLines,
        store: {
          async save(record) {
            saved = record;
            const { rows } = await t.asUser<{ id: string }>(
              erin,
              "select public.save_document_analysis($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb) as id",
              [record.title, record.storedText, record.party, JSON.stringify(record.redLinesSnapshot), JSON.stringify(record.flags), JSON.stringify(record.receipt)],
            );
            return rows[0].id;
          },
        },
      },
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok || outcome.saved.kind !== "saved") throw new Error("expected a saved analysis");
    const documentId = outcome.saved.documentId;
    expect(saved!.redLinesSnapshot).toEqual(redLines);

    const oldTitle = redLines.find((r) => r.id === "termination-without-pay")!.title;
    const ipTitle = redLines.find((r) => r.id === "ip-assignment")!.title;
    // The reader edits two red lines afterwards (red-lines-editing.test.ts covers edit, delete and restore through the store).
    await t.asUser(erin, "update public.red_lines set title = 'Renamed termination' where product_id = 'termination-without-pay'");
    await t.asUser(erin, "update public.red_lines set title = 'Renamed IP' where product_id = 'ip-assignment'");

    const { rows } = await t.asUser<{ red_lines_snapshot: unknown; flags: unknown; receipt: unknown; stored_text: string }>(
      erin,
      "select a.red_lines_snapshot, a.flags, a.receipt, d.stored_text from public.analyses a join public.documents d on d.id = a.document_id where d.id = $1",
      [documentId],
    );
    expect(rows[0].red_lines_snapshot).toEqual(redLines);

    const markup = renderToStaticMarkup(
      createElement(ResultView, {
        storedText: rows[0].stored_text,
        party: "Contractor",
        flags: parseStoredFlags(rows[0].flags, rows[0].stored_text),
        receipt: parseStoredReceipt(rows[0].receipt, rows[0].stored_text),
        checkedRedLines: parseCheckedRedLines(rows[0].red_lines_snapshot),
      }),
    );
    expect(markup).toContain(oldTitle);
    expect(markup).toContain(ipTitle);
    expect(markup).not.toContain("Renamed");
    expect(markup).toContain("Checked against your 5 red lines.");
  });
});

describe("fromRow", () => {
  const row: RedLineRow = {
    id: "00000000-0000-4000-8000-000000000001",
    product_id: null,
    kind: "reader",
    title: "Exclusivity",
    description: "The reader may work only for the client.",
    tiers: { Severe: "Severe when it lasts beyond the engagement.", Extra: "ignored" },
    enabled: true,
    position: 20,
  };

  it("uses the row id for a reader's own red line and the product id for a product item", () => {
    expect(fromRow(row)).toMatchObject({ id: row.id, rowId: row.id, productId: null, kind: "reader" });
    expect(fromRow(row).tiers).toEqual({ Severe: "Severe when it lasts beyond the engagement." });
    expect(fromRow({ ...row, product_id: "late-fees", kind: "offered" }).id).toBe("late-fees");
  });

  it("throws on a malformed row rather than leaving a red line out of a check", () => {
    expect(() => fromRow({ ...row, kind: "other" })).toThrow();
    expect(() => fromRow({ ...row, tiers: [] })).toThrow();
    expect(() => fromRow({ ...row, tiers: {} })).toThrow();
    expect(() => fromRow({ ...row, product_id: "made-up", kind: "default" })).toThrow();
    expect(() => fromRow({ ...row, product_id: "late-fees" })).toThrow();
  });

  it("gives analysis only the enabled red lines, with no storage fields", () => {
    const list = [fromRow(row), fromRow({ ...row, id: "00000000-0000-4000-8000-000000000002", enabled: false })];
    expect(enabledRedLines(list)).toEqual([
      { id: row.id, kind: "reader", title: row.title, description: row.description, tiers: { Severe: "Severe when it lasts beyond the engagement." } },
    ]);
  });
});

