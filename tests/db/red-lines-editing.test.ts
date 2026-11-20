// Editing, adding, deleting and restoring red lines (ticket 09) against the real migrations in
// PGlite, through row-level security as the signed-in reader. The store, the SQL, the restore RPC
// and analysis all run for real; the model is the fake the rest of the suite uses.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ResultView } from "../../app/analysis/result-view.tsx";
import { analyse } from "../../lib/analysis/analyse.ts";
import { parseCheckedRedLines, parseStoredFlags, parseStoredReceipt } from "../../lib/analysis/stored.ts";
import { runAnalysis } from "../../lib/analysis/run.ts";
import { PRODUCT_RED_LINES } from "../../lib/red-lines/defaults.ts";
import {
  enabledRedLines,
  redLineStore,
  RedLineNotFoundError,
  seedRows,
  type RedLineRow,
  type StoredRedLine,
} from "../../lib/red-lines/store.ts";
import { validateRedLineDraft, type RedLineWording } from "../../lib/red-lines/validation.ts";
import { analysisPayload, fakeModel, loadContract, sidecarPayload } from "../support/fake-model.ts";
import { createTestDb, type TestDb } from "./harness.ts";
import { COLUMNS, pgTransport } from "./red-line-transport.ts";

const OWN: RedLineWording = {
  title: "Answering client questions within two days",
  description: "The contract sets a deadline for replying to the client's questions.",
  tiers: { Minor: "Minor when the reader must answer within a few business days." },
};

/** The reader's rows straight from the table (bypassing the store), keyed by product id or row id. */
async function rawRows(t: TestDb, reader: string): Promise<RedLineRow[]> {
  const { rows } = await t.db.query<RedLineRow>(
    `select ${COLUMNS} from public.red_lines where reader_id = $1 order by position, id`,
    [reader],
  );
  return rows;
}

function productState(list: readonly StoredRedLine[]) {
  return list
    .filter((r) => r.productId !== null)
    .map(({ productId, kind, title, description, tiers, enabled, position }) => ({
      product_id: productId,
      kind,
      title,
      description,
      tiers,
      enabled,
      position,
    }));
}

describe("editing red lines under row-level security", () => {
  let t: TestDb;

  beforeAll(async () => {
    t = await createTestDb();
  });

  afterAll(async () => {
    await t.close();
  });

  it("rewords a product item, keeping its id, kind, product id and switch", async () => {
    const reader = await t.createAuthUser("edit@example.com");
    const store = redLineStore(pgTransport(t, reader));
    const ip = (await store.listForReader()).find((r) => r.id === "ip-assignment")!;

    const saved = await store.updateWording(ip.rowId, {
      title: "My code stays mine",
      description: "The client takes ownership of anything I wrote before this job.",
      tiers: { Severe: "Severe when it reaches my existing libraries." },
    });
    expect(saved).toMatchObject({
      id: "ip-assignment",
      rowId: ip.rowId,
      productId: "ip-assignment",
      kind: "default",
      title: "My code stays mine",
      tiers: { Severe: "Severe when it reaches my existing libraries." },
      enabled: true,
      position: ip.position,
    });
    // Leaving Moderate and Minor empty removed them.
    expect(Object.keys(saved.tiers)).toEqual(["Severe"]);

    const again = await redLineStore(pgTransport(t, reader)).listForReader();
    expect(again.find((r) => r.rowId === ip.rowId)!.title).toBe("My code stays mine");
  });

  it("refuses an update that changes a row's product id or kind", async () => {
    const reader = await t.createAuthUser("identity@example.com");
    const list = await redLineStore(pgTransport(t, reader)).listForReader();
    const lateFees = list.find((r) => r.id === "late-fees")!;
    await expect(
      t.asUser(reader, "update public.red_lines set kind = 'default' where id = $1", [lateFees.rowId]),
    ).rejects.toThrow(/cannot be changed/);
    await expect(
      t.asUser(reader, "update public.red_lines set product_id = 'arbitration', kind = 'offered' where id = $1", [lateFees.rowId]),
    ).rejects.toThrow();
    await expect(
      t.asUser(reader, "update public.red_lines set product_id = null, kind = 'reader' where id = $1", [lateFees.rowId]),
    ).rejects.toThrow(/cannot be changed/);
  });

  it("adds a reader's own red line switched on, at the end, identified by its row id", async () => {
    const reader = await t.createAuthUser("add@example.com");
    const store = redLineStore(pgTransport(t, reader));
    await store.listForReader();
    const added = await store.addOwn(OWN);
    expect(added).toMatchObject({ kind: "reader", productId: null, enabled: true, ...OWN });
    expect(added.id).toBe(added.rowId);
    expect(added.id).toMatch(/^[0-9a-f-]{36}$/);
    const second = await store.addOwn({ ...OWN, title: "Second" });

    const list = await store.listForReader();
    expect(list.map((r) => r.rowId).slice(-2)).toEqual([added.rowId, second.rowId]);
    expect(added.position).toBeGreaterThanOrEqual(PRODUCT_RED_LINES.length);
    expect(second.position).toBeGreaterThan(added.position);
    expect(enabledRedLines(list).map((r) => r.id)).toContain(added.id);
  });

  it("seeds a new reader's list before adding their first own red line", async () => {
    const reader = await t.createAuthUser("add-first@example.com");
    const store = redLineStore(pgTransport(t, reader));
    const added = await store.addOwn(OWN);
    const list = await store.listForReader();
    expect(list).toHaveLength(12);
    expect(list.at(-1)!.rowId).toBe(added.rowId);
  });

  it("deletes a product item and a reader's own red line", async () => {
    const reader = await t.createAuthUser("delete@example.com");
    const store = redLineStore(pgTransport(t, reader));
    const nonCompete = (await store.listForReader()).find((r) => r.id === "non-compete")!;
    const own = await store.addOwn(OWN);

    await store.remove(nonCompete.rowId);
    await store.remove(own.rowId);
    const list = await store.listForReader();
    expect(list).toHaveLength(10);
    expect(list.map((r) => r.id)).not.toContain("non-compete");
    expect(list.map((r) => r.rowId)).not.toContain(own.rowId);
    await expect(store.remove(own.rowId)).rejects.toBeInstanceOf(RedLineNotFoundError);
  });

  it("restores edited, switched and deleted product items to shipped wording, switch and position, and leaves the reader's own alone", async () => {
    const reader = await t.createAuthUser("restore@example.com");
    const store = redLineStore(pgTransport(t, reader));
    const list = await store.listForReader();
    const byId = (id: string) => list.find((r) => r.id === id)!;

    await store.updateWording(byId("ip-assignment").rowId, { title: "Edited", description: "Edited.", tiers: { Minor: "Edited." } });
    await store.setEnabled(byId("non-compete").rowId, false);
    await store.setEnabled(byId("late-fees").rowId, true);
    await store.remove(byId("arbitration").rowId);
    await t.asUser(reader, "update public.red_lines set position = 40 where id = $1", [byId("fee-escalators").rowId]);
    const own = await store.addOwn(OWN);
    const ownEdited = await store.updateWording(own.rowId, { ...OWN, title: "Own, edited" });
    await store.setEnabled(own.rowId, false);
    const ownBefore = (await rawRows(t, reader)).find((r) => r.id === own.rowId)!;
    const untouchedRowId = byId("uncapped-indemnity").rowId;

    const restored = await store.restoreDefaults();

    // The eleven product items read exactly as shipped: wording, switch state and position.
    expect(productState(restored)).toEqual(seedRows());
    expect(restored.filter((r) => r.productId !== null)).toHaveLength(11);
    // Rows the reader kept are rewritten in place; the deleted one is back under a new row id.
    expect(restored.find((r) => r.id === "uncapped-indemnity")!.rowId).toBe(untouchedRowId);
    expect(restored.find((r) => r.id === "arbitration")!.rowId).not.toBe(byId("arbitration").rowId);
    // The reader's own red line: same content, still switched off, same position.
    const ownAfter = (await rawRows(t, reader)).find((r) => r.id === own.rowId)!;
    expect(ownAfter).toEqual(ownBefore);
    expect(ownAfter.title).toBe(ownEdited.title);
    expect(ownAfter.enabled).toBe(false);
    // The list order puts the product items first, in shipped order, then the reader's own.
    expect(restored.map((r) => r.id)).toEqual([...PRODUCT_RED_LINES.map((r) => r.id), own.id]);
  });

  it("is idempotent: restoring twice leaves the same rows as restoring once", async () => {
    const reader = await t.createAuthUser("twice@example.com");
    const store = redLineStore(pgTransport(t, reader));
    const list = await store.listForReader();
    await store.remove(list[0].rowId);
    await store.addOwn(OWN);

    await store.restoreDefaults();
    const once = await rawRows(t, reader);
    const written = await pgTransport(t, reader).restore(seedRows());
    const twice = await rawRows(t, reader);
    expect(written).toBe(11);
    expect(twice).toEqual(once);
    expect(twice).toHaveLength(12);
  });

  it("marks a never-seeded reader as seeded, so the first-use seed adds no second copy", async () => {
    const reader = await t.createAuthUser("restore-first@example.com");
    const transport = pgTransport(t, reader);
    expect(await transport.restore(seedRows())).toBe(11);
    expect(await transport.seed(seedRows())).toBe(0);
    expect(await redLineStore(transport).listForReader()).toHaveLength(11);
  });

  it("refuses a restore that tries to write a row with no product id, and changes nothing", async () => {
    const reader = await t.createAuthUser("restore-bad@example.com");
    const store = redLineStore(pgTransport(t, reader));
    const ip = (await store.listForReader()).find((r) => r.id === "ip-assignment")!;
    await store.updateWording(ip.rowId, { title: "Mine", description: "Mine.", tiers: { Severe: "Mine." } });
    const before = await rawRows(t, reader);
    const rows = [...seedRows(), { ...seedRows()[0], product_id: null }];
    await expect(t.asUser(reader, "select public.restore_default_red_lines($1::jsonb)", [JSON.stringify(rows)])).rejects.toThrow(
      /product items only/,
    );
    expect(await rawRows(t, reader)).toEqual(before);
  });

  it("does not let another reader edit, delete or restore my red lines", async () => {
    const alice = await t.createAuthUser("alice-09@example.com");
    const bob = await t.createAuthUser("bob-09@example.com");
    const aliceStore = redLineStore(pgTransport(t, alice));
    const bobStore = redLineStore(pgTransport(t, bob));
    const aliceList = await aliceStore.listForReader();
    await bobStore.listForReader();
    const ip = aliceList.find((r) => r.id === "ip-assignment")!;
    await aliceStore.updateWording(ip.rowId, { title: "Alice's wording", description: "Alice.", tiers: { Severe: "Alice." } });
    const aliceOwn = await aliceStore.addOwn(OWN);
    const before = await rawRows(t, alice);

    await expect(bobStore.updateWording(ip.rowId, { title: "Bob", description: "Bob.", tiers: { Severe: "Bob." } })).rejects.toBeInstanceOf(
      RedLineNotFoundError,
    );
    await expect(bobStore.remove(ip.rowId)).rejects.toBeInstanceOf(RedLineNotFoundError);
    await expect(bobStore.remove(aliceOwn.rowId)).rejects.toBeInstanceOf(RedLineNotFoundError);
    // Bob's restore writes Bob's rows only.
    await bobStore.restoreDefaults();
    expect(await rawRows(t, alice)).toEqual(before);
    // Nor can Bob write a row into Alice's list through the restore upsert.
    await expect(
      t.asUser(bob, "insert into public.red_lines (reader_id, product_id, kind, title, description, tiers, enabled, position) values ($1, 'late-fees', 'offered', 'x', 'y', '{\"Minor\":\"z\"}'::jsonb, true, 0) on conflict (reader_id, product_id) do update set title = excluded.title", [alice]),
    ).rejects.toThrow(/row-level security/);
    expect(await rawRows(t, alice)).toEqual(before);
    // A signed-out visitor can't restore at all.
    await expect(t.asAnon("select public.restore_default_red_lines($1::jsonb)", [JSON.stringify(seedRows())])).rejects.toThrow();
  });
});

describe("analysis after editing red lines", () => {
  let t: TestDb;
  const { text, sidecar } = loadContract("one-sided-services-agreement");
  const ownSentence =
    "Contractor shall keep Client reasonably informed of progress and shall respond to Client's written questions about the Services within two Business Days.";

  beforeAll(async () => {
    t = await createTestDb();
  });

  afterAll(async () => {
    await t.close();
  });

  it("sends the reader's edited wording to the model, and a reader-authored red line produces a verified flag", async () => {
    expect(text).toContain(ownSentence);
    const reader = await t.createAuthUser("own-flag@example.com");
    const store = redLineStore(pgTransport(t, reader));
    const ip = (await store.listForReader()).find((r) => r.id === "ip-assignment")!;
    const edited = await store.updateWording(ip.rowId, {
      title: "My earlier work stays mine",
      description: "The client takes rights in work I made before or outside this job.",
      tiers: { Severe: "Severe when the assignment reaches libraries I wrote before the job." },
    });
    const own = await store.addOwn(OWN);
    const redLines = enabledRedLines(await store.listForReader());
    const ids = redLines.map((r) => r.id);
    expect(ids).toContain(own.rowId);

    const ipFlag = sidecar.flags.find((f) => f.redLineId === "ip-assignment" && f.tier === "Severe")!;
    const model = fakeModel(
      analysisPayload(ids, [
        { redLineId: "ip-assignment", tier: "Severe", statement: ipFlag.statement, sourceSentence: ipFlag.sentence, counterOffer: ipFlag.counterOffer },
        {
          redLineId: own.id,
          tier: "Minor",
          statement: "The contractor has to answer the client's written questions within two business days.",
          sourceSentence: ownSentence,
          counterOffer: "Contractor shall respond to Client's written questions within five Business Days.",
        },
      ]),
    );
    const result = await analyse({ text, party: "Contractor", redLines }, { model });
    if (!result.ok) throw new Error(result.error.message);

    // The schema's enum of red line ids takes the uuid.
    const schema = model.calls[0].jsonSchema as {
      properties: { redLines: { items: { properties: { redLineId: { enum: string[] } } } } };
    };
    expect(schema.properties.redLines.items.properties.redLineId.enum).toEqual(ids);
    // The reader's wording, not the shipped wording, is what the model was given.
    expect(model.calls[0].user).toContain(edited.title);
    expect(model.calls[0].user).toContain(edited.tiers.Severe);
    expect(model.calls[0].user).toContain(OWN.tiers.Minor);
    expect(model.calls[0].user).not.toContain(PRODUCT_RED_LINES[0].tiers.Moderate);

    const ownFlag = result.flags.find((f) => f.redLineId === own.id)!;
    expect(ownFlag).toMatchObject({ redLineTitle: OWN.title, tier: "Minor", sourceSentence: ownSentence });
    expect(text.slice(ownFlag.offset, ownFlag.offset + ownSentence.length)).toBe(ownSentence);
    expect(result.flags.find((f) => f.redLineId === "ip-assignment")!.redLineTitle).toBe(edited.title);
  });

  it("drops a reader-authored candidate whose source is not in the document, like any other", async () => {
    const reader = await t.createAuthUser("own-misquote@example.com");
    const store = redLineStore(pgTransport(t, reader));
    await store.listForReader();
    const own = await store.addOwn(OWN);
    const redLines = enabledRedLines(await store.listForReader());
    const ids = redLines.map((r) => r.id);
    const bad = {
      redLineId: own.id,
      tier: "Minor",
      statement: "The contractor has to answer within one day.",
      sourceSentence: "Contractor shall respond within one Business Day.",
      counterOffer: "Contractor shall respond within five Business Days.",
    };
    const model = fakeModel(analysisPayload(ids, [bad]), { corrections: [], addressing: [] });
    const result = await analyse({ text, party: "Contractor", redLines }, { model });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.flags.map((f) => f.redLineId)).not.toContain(own.id);
    expect(result.receipt.map((r) => r.redLineId)).toContain(own.id);
  });

  it("keeps a stored snapshot and result unchanged after the reader edits, deletes and restores red lines", async () => {
    const reader = await t.createAuthUser("snapshot-09@example.com");
    const store = redLineStore(pgTransport(t, reader));
    const own = await store.addOwn(OWN);
    const redLines = enabledRedLines(await store.listForReader());
    const ids = redLines.map((r) => r.id);

    const outcome = await runAnalysis(
      { text, party: "Contractor" },
      {
        model: fakeModel(sidecarPayload(sidecar, ids)),
        redLines,
        store: {
          async save(record) {
            const { rows } = await t.asUser<{ id: string }>(
              reader,
              "select public.save_document_analysis($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb) as id",
              [record.title, record.storedText, record.party, JSON.stringify(record.redLinesSnapshot), JSON.stringify(record.flags), JSON.stringify(record.receipt)],
            );
            return rows[0].id;
          },
        },
      },
    );
    if (!outcome.ok || outcome.saved.kind !== "saved") throw new Error("expected a saved analysis");
    const documentId = outcome.saved.documentId;

    async function stored() {
      const { rows } = await t.asUser<{ red_lines_snapshot: unknown; flags: unknown; receipt: unknown; stored_text: string }>(
        reader,
        "select a.red_lines_snapshot, a.flags, a.receipt, d.stored_text from public.analyses a join public.documents d on d.id = a.document_id where d.id = $1",
        [documentId],
      );
      return rows[0];
    }
    function render(row: Awaited<ReturnType<typeof stored>>) {
      return renderToStaticMarkup(
        createElement(ResultView, {
          storedText: row.stored_text,
          party: "Contractor",
          flags: parseStoredFlags(row.flags, row.stored_text),
          receipt: parseStoredReceipt(row.receipt, row.stored_text),
          checkedRedLines: parseCheckedRedLines(row.red_lines_snapshot),
        }),
      );
    }
    const before = await stored();
    expect(before.red_lines_snapshot).toEqual(redLines);
    const markupBefore = render(before);
    expect(markupBefore).toContain(OWN.title);

    const list = await store.listForReader();
    const valid = (wording: unknown) => {
      const checked = validateRedLineDraft(wording);
      if (!checked.ok) throw new Error("invalid test wording");
      return checked.value;
    };
    // Edit.
    await store.updateWording(list.find((r) => r.id === "termination-without-pay")!.rowId, valid({ title: "Renamed termination", description: "x", tiers: { Severe: "x" } }));
    await store.updateWording(own.rowId, valid({ title: "Renamed own", description: "x", tiers: { Minor: "x" } }));
    expect(await stored()).toEqual(before);
    // Delete.
    await store.remove(list.find((r) => r.id === "ip-assignment")!.rowId);
    await store.remove(own.rowId);
    expect(await stored()).toEqual(before);
    // Restore.
    await store.restoreDefaults();
    const after = await stored();
    expect(after).toEqual(before);
    expect(render(after)).toBe(markupBefore);
    expect(render(after)).not.toContain("Renamed");
  });
});
