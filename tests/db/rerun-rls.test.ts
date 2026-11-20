// rerun_document_analysis() (migration 0003) against real Postgres with the real migrations: the
// owner can change the party and add an analysis in one step; another reader and a signed-out
// visitor cannot; a failure part-way leaves the party and the analyses as they were.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness.ts";

const SAVE = "select public.save_document_analysis($1, $2, $3, $4::jsonb, $5::jsonb) as id";
const RERUN = "select public.rerun_document_analysis($1, $2, $3::jsonb, $4::jsonb, $5::jsonb) as id";
const snapshot = JSON.stringify([{ id: "ip-assignment", title: "IP" }]);
const contractorFlags = JSON.stringify([{ redLineId: "ip-assignment", tier: "Severe", sourceSentence: "A.", offset: 0 }]);
const clientReceipt = JSON.stringify([{ redLineId: "ip-assignment", redLineTitle: "IP", kind: "addressed", sentence: "A.", offset: 0 }]);

describe("rerun_document_analysis under row-level security", () => {
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

  async function save(reader: string): Promise<string> {
    const { rows } = await t.asUser<{ id: string }>(reader, SAVE, ["Title", "A. B.", "Contractor", snapshot, contractorFlags]);
    return rows[0].id;
  }

  async function documentRow(id: string) {
    const { rows } = await t.db.query<{ party: string; stored_text: string }>(
      "select party, stored_text from public.documents where id = $1",
      [id],
    );
    return rows[0];
  }

  async function analyses(id: string) {
    const { rows } = await t.db.query<{ id: string; flags: unknown; receipt: unknown }>(
      "select id, flags, receipt from public.analyses where document_id = $1 order by created_at",
      [id],
    );
    return rows;
  }

  it("lets the owner change the party and store a new analysis together", async () => {
    const id = await save(alice);
    const { rows } = await t.asUser<{ id: string }>(alice, RERUN, [id, "Client", snapshot, "[]", clientReceipt]);
    const newAnalysis = rows[0].id;

    expect(await documentRow(id)).toEqual({ party: "Client", stored_text: "A. B." });
    const all = await analyses(id);
    expect(all).toHaveLength(2);
    expect(all[1]).toEqual({ id: newAnalysis, flags: [], receipt: JSON.parse(clientReceipt) });

    // The latest analysis, as the document page reads it under the owner's session.
    const latest = await t.asUser<{ id: string }>(
      alice,
      "select id from public.analyses where document_id = $1 order by created_at desc limit 1",
      [id],
    );
    expect(latest.rows).toEqual([{ id: newAnalysis }]);
  });

  it("does not let another reader rerun a document they do not own", async () => {
    const id = await save(bob);
    await expect(t.asUser(alice, RERUN, [id, "Client", snapshot, "[]", "[]"])).rejects.toThrow(/document not found/);
    expect((await documentRow(id)).party).toBe("Contractor");
    expect(await analyses(id)).toHaveLength(1);
  });

  it("refuses a signed-out visitor", async () => {
    const id = await save(bob);
    await expect(t.asAnon(RERUN, [id, "Client", snapshot, "[]", "[]"])).rejects.toThrow(/permission denied/);
    expect((await documentRow(id)).party).toBe("Contractor");
    expect(await analyses(id)).toHaveLength(1);
  });

  it("leaves the party unchanged when the analysis insert fails", async () => {
    const id = await save(alice);
    // flags must be a JSON array; an object fails the check constraint after the party update ran.
    await expect(t.asUser(alice, RERUN, [id, "Client", snapshot, '{"not":"an array"}', "[]"])).rejects.toThrow(
      /check constraint/,
    );
    expect((await documentRow(id)).party).toBe("Contractor");
    expect(await analyses(id)).toHaveLength(1);
  });

  it("refuses an empty party and changes nothing", async () => {
    const id = await save(alice);
    await expect(t.asUser(alice, RERUN, [id, "   ", snapshot, "[]", "[]"])).rejects.toThrow(/check constraint/);
    expect((await documentRow(id)).party).toBe("Contractor");
    expect(await analyses(id)).toHaveLength(1);
  });
});
