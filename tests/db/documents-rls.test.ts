import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness.ts";

const SAVE = "select public.save_document_analysis($1, $2, $3, $4::jsonb, $5::jsonb) as id";
const snapshot = JSON.stringify([{ id: "ip-assignment", title: "IP" }]);
const flags = JSON.stringify([{ redLineId: "ip-assignment", tier: "Severe", sourceSentence: "A.", offset: 0 }]);

describe("documents and analyses under row-level security", () => {
  let t: TestDb;
  let alice: string;
  let bob: string;
  let bobDocument: string;

  async function save(reader: string, text = "A. B.", flagsJson: string | null = flags): Promise<string> {
    const { rows } = await t.asUser<{ id: string }>(reader, SAVE, ["Title", text, "Contractor", snapshot, flagsJson]);
    return rows[0].id;
  }

  async function count(table: "documents" | "analyses", where = "true", params: unknown[] = []) {
    const { rows } = await t.db.query<{ n: number }>(`select count(*)::int as n from public.${table} where ${where}`, params);
    return rows[0].n;
  }

  beforeAll(async () => {
    t = await createTestDb();
    alice = await t.createAuthUser("alice@example.com");
    bob = await t.createAuthUser("bob@example.com");
    bobDocument = await save(bob);
  });

  afterAll(async () => {
    await t.close();
  });

  it("stores a document and its analysis together, owned by the caller", async () => {
    const id = await save(alice, "Alice's contract.");
    const { rows } = await t.asUser<{ reader_id: string; stored_text: string; party: string }>(
      alice,
      "select reader_id, stored_text, party from public.documents where id = $1",
      [id],
    );
    expect(rows).toEqual([{ reader_id: alice, stored_text: "Alice's contract.", party: "Contractor" }]);
    const analyses = await t.asUser<{ flags: unknown; receipt: unknown; reader_id: string }>(
      alice,
      "select flags, receipt, reader_id from public.analyses where document_id = $1",
      [id],
    );
    expect(analyses.rows).toEqual([{ flags: JSON.parse(flags), receipt: [], reader_id: alice }]);
  });

  it("does not show a reader another reader's documents or analyses", async () => {
    const docs = await t.asUser(alice, "select id from public.documents where id = $1", [bobDocument]);
    expect(docs.rows).toEqual([]);
    const analyses = await t.asUser(alice, "select id from public.analyses where document_id = $1", [bobDocument]);
    expect(analyses.rows).toEqual([]);
  });

  it("does not let a reader update another reader's document or analysis", async () => {
    const doc = await t.asUser(alice, "update public.documents set title = 'mine' where id = $1", [bobDocument]);
    expect(doc.affectedRows).toBe(0);
    const analysis = await t.asUser(
      alice,
      "update public.analyses set flags = '[]'::jsonb where document_id = $1",
      [bobDocument],
    );
    expect(analysis.affectedRows).toBe(0);
    const { rows } = await t.db.query<{ title: string }>("select title from public.documents where id = $1", [bobDocument]);
    expect(rows[0].title).toBe("Title");
    expect(await count("analyses", "document_id = $1 and jsonb_array_length(flags) = 1", [bobDocument])).toBe(1);
  });

  it("does not let a reader delete another reader's document or analysis", async () => {
    const analysis = await t.asUser(alice, "delete from public.analyses where document_id = $1", [bobDocument]);
    expect(analysis.affectedRows).toBe(0);
    const doc = await t.asUser(alice, "delete from public.documents where id = $1", [bobDocument]);
    expect(doc.affectedRows).toBe(0);
    expect(await count("documents", "id = $1", [bobDocument])).toBe(1);
    expect(await count("analyses", "document_id = $1", [bobDocument])).toBe(1);
  });

  it("does not let a reader attach an analysis to another reader's document", async () => {
    await expect(
      t.asUser(
        alice,
        "insert into public.analyses (document_id, reader_id, red_lines_snapshot, flags) values ($1, $2, '[]', '[]')",
        [bobDocument, alice],
      ),
    ).rejects.toThrow(/row-level security/);
    expect(await count("analyses", "document_id = $1", [bobDocument])).toBe(1);
  });

  it("does not let a reader move their analysis onto another reader's document", async () => {
    const mine = await save(alice);
    await expect(
      t.asUser(alice, "update public.analyses set document_id = $1 where document_id = $2", [bobDocument, mine]),
    ).rejects.toThrow(/row-level security/);
  });

  it("does not let a reader insert a document owned by someone else", async () => {
    await expect(
      t.asUser(
        alice,
        "insert into public.documents (reader_id, title, stored_text, party) values ($1, 'x', 'y', 'z')",
        [bob],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("shows a signed-out visitor nothing and refuses them the save function", async () => {
    expect((await t.asAnon("select id from public.documents")).rows).toEqual([]);
    expect((await t.asAnon("select id from public.analyses")).rows).toEqual([]);
    await expect(t.asAnon(SAVE, ["T", "x", "p", snapshot, flags])).rejects.toThrow(/permission denied/);
  });

  it("deletes a document's analyses when the document is deleted", async () => {
    const id = await save(alice, "To be deleted.");
    expect(await count("analyses", "document_id = $1", [id])).toBe(1);
    const result = await t.asUser(alice, "delete from public.documents where id = $1", [id]);
    expect(result.affectedRows).toBe(1);
    expect(await count("documents", "id = $1", [id])).toBe(0);
    expect(await count("analyses", "document_id = $1", [id])).toBe(0);
  });

  it("leaves no document behind when the analysis insert fails", async () => {
    const before = await count("documents", "reader_id = $1", [alice]);
    await expect(save(alice, "Orphan candidate.", null)).rejects.toThrow(/null value|not-null/);
    await expect(save(alice, "Orphan candidate.", '{"not":"an array"}')).rejects.toThrow(/check constraint/);
    expect(await count("documents", "reader_id = $1", [alice])).toBe(before);
    expect(await count("documents", "stored_text = $1", ["Orphan candidate."])).toBe(0);
  });
});
