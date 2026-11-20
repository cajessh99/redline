import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness.ts";

type ReaderRow = { id: string; red_lines_seeded_at: string | null };

describe("readers table under row-level security", () => {
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

  it("creates one reader row for each new auth user", async () => {
    const { rows } = await t.db.query<{ id: string }>("select id from public.readers order by id");
    expect(rows.map((r) => r.id).sort()).toEqual([alice, bob].sort());
  });

  it("shows a reader only their own row", async () => {
    const { rows } = await t.asUser<ReaderRow>(alice, "select id from public.readers");
    expect(rows).toEqual([{ id: alice }]);
  });

  it("lets a reader update their own row", async () => {
    const result = await t.asUser<ReaderRow>(
      alice,
      "update public.readers set red_lines_seeded_at = now() where id = $1 returning id",
      [alice],
    );
    expect(result.rows).toEqual([{ id: alice }]);
  });

  it("does not let a reader update another reader's row", async () => {
    const result = await t.asUser(
      alice,
      "update public.readers set red_lines_seeded_at = now() where id = $1",
      [bob],
    );
    expect(result.affectedRows).toBe(0);
    const { rows } = await t.db.query<ReaderRow>(
      "select red_lines_seeded_at from public.readers where id = $1",
      [bob],
    );
    expect(rows[0].red_lines_seeded_at).toBeNull();
  });

  it("does not let a reader delete another reader's row", async () => {
    const result = await t.asUser(alice, "delete from public.readers where id = $1", [bob]);
    expect(result.affectedRows).toBe(0);
    const { rows } = await t.db.query("select id from public.readers where id = $1", [bob]);
    expect(rows).toHaveLength(1);
  });

  it("does not let a reader insert a row for someone else", async () => {
    const carol = await t.createAuthUser("carol@example.com");
    await t.db.query("delete from public.readers where id = $1", [carol]);
    await expect(
      t.asUser(alice, "insert into public.readers (id) values ($1)", [carol]),
    ).rejects.toThrow(/row-level security/);
  });

  it("shows a signed-out visitor no rows", async () => {
    const { rows } = await t.asAnon("select id from public.readers");
    expect(rows).toEqual([]);
  });

  it("lets a reader delete their own row, and deleting the auth user removes it too", async () => {
    const result = await t.asUser(bob, "delete from public.readers where id = $1", [bob]);
    expect(result.affectedRows).toBe(1);

    await t.db.query("delete from auth.users where id = $1", [alice]);
    const { rows } = await t.db.query("select id from public.readers where id = $1", [alice]);
    expect(rows).toEqual([]);
  });
});
