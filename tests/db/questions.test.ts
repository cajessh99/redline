// Questions against real Postgres (PGlite) with the real migrations (ticket 11, story 41). Documents
// are saved through the real save RPC; questions are answered by the real answer() (fake model)
// and stored and read back through the real orchestration, as each reader, under row-level security.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { askAboutStoredDocument, askAboutUnsavedText, loadStoredQuestions, type AskOutcome } from "../../lib/analysis/ask.ts";
import { DOES_NOT_SAY } from "../../lib/analysis/answer.ts";
import { deleteDocument } from "../../lib/documents/library.ts";
import { FakeModel, fakeModel, loadContract } from "../support/fake-model.ts";
import { createTestDb, type TestDb } from "./harness.ts";
import { pgLibraryTransport, saveDocument } from "./library-transport.ts";
import { pgQuestionStore } from "./question-transport.ts";

const { text, sidecar } = loadContract("one-sided-services-agreement");
const PAY_SENTENCE = sidecar.flags.find((flag) => flag.sentence.includes("seventy-five"))!.sentence;
const PAY_ANSWER = "Client has 75 days after receiving an approved invoice to pay it.";
const PAY_QUESTION = "How many days does Client have to pay an invoice?";

describe("questions under row-level security", () => {
  let t: TestDb;
  let alice: string;
  let bob: string;
  let bobDocument: string;

  async function newDocument(reader: string, party = "Contractor"): Promise<string> {
    return saveDocument(t, reader, { title: "Agreement", storedText: text, party, snapshot: [], flags: [] });
  }

  async function count(documentId: string): Promise<number> {
    const { rows } = await t.db.query<{ n: number }>(
      "select count(*)::int as n from public.questions where document_id = $1",
      [documentId],
    );
    return rows[0].n;
  }

  function okOf(outcome: AskOutcome) {
    if (!outcome.ok) throw new Error(`expected success, got ${outcome.error.code}`);
    return outcome;
  }

  beforeAll(async () => {
    t = await createTestDb();
    alice = await t.createAuthUser("alice@example.com");
    bob = await t.createAuthUser("bob@example.com");
    bobDocument = await newDocument(bob);
  });

  afterAll(async () => {
    await t.close();
  });

  it("answers from the stored text as the stored party, stores the result, and returns it", async () => {
    const id = await newDocument(alice);
    const model = fakeModel({ answer: PAY_ANSWER, citation: PAY_SENTENCE });
    // A text or party in the body is ignored: the stored ones are used.
    const outcome = okOf(
      await askAboutStoredDocument(id, { question: PAY_QUESTION, text: "Other text.", party: "Client" }, { model, store: pgQuestionStore(t, alice) }),
    );
    expect(model.calls[0].metadata).toEqual({ party: "Contractor", question: PAY_QUESTION });
    expect(model.calls[0].user).toContain(PAY_SENTENCE);
    expect(model.calls[0].user).not.toContain("Other text.");
    expect(outcome.kept).toBe("kept");
    expect(outcome.asked).toMatchObject({
      question: PAY_QUESTION,
      party: "Contractor",
      result: { kind: "answered", answer: PAY_ANSWER, citation: PAY_SENTENCE, offset: text.indexOf(PAY_SENTENCE) },
    });
    expect(typeof outcome.asked.id).toBe("string");

    const { rows } = await t.db.query("select reader_id, kind, answer, citation, citation_offset, party from public.questions where document_id = $1", [id]);
    expect(rows).toEqual([
      { reader_id: alice, kind: "answered", answer: PAY_ANSWER, citation: PAY_SENTENCE, citation_offset: text.indexOf(PAY_SENTENCE), party: "Contractor" },
    ]);
  });

  it("stores 'does not say' with no answer or citation, and keeps nothing the model said", async () => {
    const id = await newDocument(alice);
    const model = fakeModel({ answer: PAY_ANSWER, citation: "Client pays in 75 days." }, { answer: PAY_ANSWER, citation: "Client pays in 75 days." });
    const outcome = okOf(await askAboutStoredDocument(id, { question: PAY_QUESTION }, { model, store: pgQuestionStore(t, alice) }));
    expect(outcome.asked.result).toEqual({ kind: "does_not_say" });
    const { rows } = await t.db.query("select kind, answer, citation, citation_offset from public.questions where document_id = $1", [id]);
    expect(rows).toEqual([{ kind: "does_not_say", answer: null, citation: null, citation_offset: null }]);
  });

  it("reads questions back newest first, exactly as stored", async () => {
    const id = await newDocument(alice);
    const store = pgQuestionStore(t, alice);
    okOf(await askAboutStoredDocument(id, { question: PAY_QUESTION }, { model: fakeModel({ answer: PAY_ANSWER, citation: PAY_SENTENCE }), store }));
    okOf(await askAboutStoredDocument(id, { question: "Is this clause normal?" }, { model: fakeModel({ answer: null, citation: null }), store }));

    const read = await loadStoredQuestions(store, id, text);
    expect(read.map((q) => q.question)).toEqual(["Is this clause normal?", PAY_QUESTION]);
    expect(read[0].result).toEqual({ kind: "does_not_say" });
    expect(read[1].result).toEqual({ kind: "answered", answer: PAY_ANSWER, citation: PAY_SENTENCE, offset: text.indexOf(PAY_SENTENCE) });
  });

  it("shows a stored answer whose citation no longer verifies at its offset as 'does not say'", async () => {
    const id = await newDocument(alice);
    const store = pgQuestionStore(t, alice);
    const outcome = okOf(
      await askAboutStoredDocument(id, { question: PAY_QUESTION }, { model: fakeModel({ answer: PAY_ANSWER, citation: PAY_SENTENCE }), store }),
    );
    // Corrupt the stored offset (as the database superuser).
    await t.db.query("update public.questions set citation_offset = citation_offset + 1 where id = $1", [outcome.asked.id]);
    const [read] = await loadStoredQuestions(store, id, text);
    expect(read.result).toEqual({ kind: "does_not_say" });
    expect(JSON.stringify(read)).not.toContain(PAY_SENTENCE);
    // And against text that no longer holds the sentence.
    await t.db.query("update public.questions set citation_offset = citation_offset - 1 where id = $1", [outcome.asked.id]);
    const [changed] = await loadStoredQuestions(store, id, text.replace(PAY_SENTENCE, "Client pays later."));
    expect(changed.result).toEqual({ kind: "does_not_say" });
  });

  it("records the party each question was answered for", async () => {
    const id = await newDocument(alice, "Client");
    const model = fakeModel({ answer: null, citation: null });
    const outcome = okOf(await askAboutStoredDocument(id, { question: "Can I be terminated?" }, { model, store: pgQuestionStore(t, alice) }));
    expect(model.calls[0].metadata?.party).toBe("Client");
    expect(outcome.asked.party).toBe("Client");
  });

  it("a model failure is an error and stores nothing", async () => {
    const id = await newDocument(alice);
    for (const model of [new FakeModel([{ throws: new Error("timeout") }]), new FakeModel([{ raw: "nope" }])]) {
      const outcome = await askAboutStoredDocument(id, { question: PAY_QUESTION }, { model, store: pgQuestionStore(t, alice) });
      expect(outcome).toMatchObject({ ok: false, status: 502, error: { code: "answer_failed" } });
    }
    expect(await count(id)).toBe(0);
  });

  it("refuses an empty or over-long question before loading or calling the model", async () => {
    const id = await newDocument(alice);
    for (const question of ["", "  ", "x".repeat(501), undefined, 7]) {
      const model = fakeModel({ answer: PAY_ANSWER, citation: PAY_SENTENCE });
      const outcome = await askAboutStoredDocument(id, { question }, { model, store: pgQuestionStore(t, alice) });
      expect(outcome.ok).toBe(false);
      expect(model.calls).toHaveLength(0);
    }
    expect(await count(id)).toBe(0);
  });

  it("another reader's document is not found, and the model is not called", async () => {
    const model = fakeModel({ answer: PAY_ANSWER, citation: PAY_SENTENCE });
    const outcome = await askAboutStoredDocument(bobDocument, { question: PAY_QUESTION }, { model, store: pgQuestionStore(t, alice) });
    expect(outcome).toMatchObject({ ok: false, status: 404, error: { code: "not_found" } });
    expect(model.calls).toHaveLength(0);
  });

  it("a reader sees only their own questions; a visitor sees none", async () => {
    okOf(await askAboutStoredDocument(bobDocument, { question: PAY_QUESTION }, { model: fakeModel({ answer: null, citation: null }), store: pgQuestionStore(t, bob) }));
    expect((await t.asUser(alice, "select id from public.questions where document_id = $1", [bobDocument])).rows).toEqual([]);
    expect(await loadStoredQuestions(pgQuestionStore(t, alice), bobDocument, text)).toEqual([]);
    expect((await t.asUser(bob, "select id from public.questions where document_id = $1", [bobDocument])).rows).toHaveLength(1);
    expect((await t.asAnon("select id from public.questions")).rows).toEqual([]);
  });

  it("a reader can't attach a question to another reader's document", async () => {
    await expect(
      t.asUser(alice, "insert into public.questions (document_id, question, party, kind) values ($1, 'Q?', 'Contractor', 'does_not_say')", [bobDocument]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      t.asUser(alice, "insert into public.questions (document_id, reader_id, question, party, kind) values ($1, $2, 'Q?', 'Contractor', 'does_not_say')", [bobDocument, bob]),
    ).rejects.toThrow(/row-level security/);
  });

  it("a reader can't change or delete another reader's questions, and can't rewrite their own", async () => {
    const { rows } = await t.db.query<{ id: string }>("select id from public.questions where document_id = $1", [bobDocument]);
    const bobQuestion = rows[0].id;
    expect((await t.asUser(alice, "delete from public.questions where id = $1", [bobQuestion])).affectedRows).toBe(0);
    expect((await t.asUser(bob, "update public.questions set question = 'changed' where id = $1", [bobQuestion])).affectedRows).toBe(0);
  });

  it("refuses an answered row whose citation is not in the document, or that lacks its citation", async () => {
    const id = await newDocument(alice);
    await expect(
      t.asUser(alice, "insert into public.questions (document_id, question, party, kind, answer, citation, citation_offset) values ($1, 'Q?', 'Contractor', 'answered', 'A.', 'Not in the text.', 0)", [id]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      t.asUser(alice, "insert into public.questions (document_id, question, party, kind, answer) values ($1, 'Q?', 'Contractor', 'answered', 'A.')", [id]),
    ).rejects.toThrow(/row-level security|questions_result_shape/);
    await expect(
      t.asUser(alice, "insert into public.questions (document_id, question, party, kind, answer, citation, citation_offset) values ($1, 'Q?', 'Contractor', 'does_not_say', 'A.', $2, 0)", [id, PAY_SENTENCE]),
    ).rejects.toThrow(/questions_result_shape/);
  });

  it("deleting a document deletes its questions", async () => {
    const id = await newDocument(alice);
    const store = pgQuestionStore(t, alice);
    okOf(await askAboutStoredDocument(id, { question: PAY_QUESTION }, { model: fakeModel({ answer: PAY_ANSWER, citation: PAY_SENTENCE }), store }));
    okOf(await askAboutStoredDocument(id, { question: "Is this enforceable where I live?" }, { model: fakeModel({ answer: null, citation: null }), store }));
    expect(await count(id)).toBe(2);
    expect(await deleteDocument(pgLibraryTransport(t, alice), id)).toEqual({ ok: true });
    expect(await count(id)).toBe(0);
  });

  it("a save that fails still returns the answer, marked as not saved", async () => {
    const id = await newDocument(alice);
    const store = { ...pgQuestionStore(t, alice), save: () => Promise.reject(new Error("down")) };
    const outcome = okOf(await askAboutStoredDocument(id, { question: PAY_QUESTION }, { model: fakeModel({ answer: PAY_ANSWER, citation: PAY_SENTENCE }), store }));
    expect(outcome.kept).toBe("save_failed");
    expect(outcome.asked.result.kind).toBe("answered");
    expect(await count(id)).toBe(0);
  });
});

describe("questions about unsaved text (/check without an account)", () => {
  it("answers from the text sent and stores nothing", async () => {
    const model = fakeModel({ answer: PAY_ANSWER, citation: PAY_SENTENCE });
    const outcome = await askAboutUnsavedText({ text, party: "Contractor", question: PAY_QUESTION }, { model });
    expect(outcome).toMatchObject({
      ok: true,
      kept: "not_kept",
      asked: { question: PAY_QUESTION, party: "Contractor", result: { kind: "answered", citation: PAY_SENTENCE } },
    });
    if (outcome.ok) expect(outcome.asked.id).toBeUndefined();
    expect(model.calls[0].metadata).toEqual({ party: "Contractor", question: PAY_QUESTION });
  });

  it("refuses text that is not exactly the normalised text, before any model call", async () => {
    const model = fakeModel({ answer: PAY_ANSWER, citation: PAY_SENTENCE });
    const outcome = await askAboutUnsavedText({ text: `${text}\n\n\n`, party: "Contractor", question: PAY_QUESTION }, { model });
    expect(outcome).toMatchObject({ ok: false, error: { code: "not_normalised" } });
    expect(model.calls).toHaveLength(0);
  });

  it("refuses a missing party, missing text, or empty question before any model call", async () => {
    const model = fakeModel({ answer: PAY_ANSWER, citation: PAY_SENTENCE });
    expect(await askAboutUnsavedText({ text, question: PAY_QUESTION }, { model })).toMatchObject({ error: { code: "missing_party" } });
    expect(await askAboutUnsavedText({ party: "Contractor", question: PAY_QUESTION }, { model })).toMatchObject({ error: { code: "bad_request" } });
    expect(await askAboutUnsavedText({ text, party: "Contractor", question: " " }, { model })).toMatchObject({ error: { code: "empty_question" } });
    expect(await askAboutUnsavedText({ text, party: "Contractor", question: "x".repeat(501) }, { model })).toMatchObject({ error: { code: "question_too_long" } });
    expect(model.calls).toHaveLength(0);
  });

  it("says the model is unavailable when none is configured", async () => {
    expect(await askAboutUnsavedText({ text, party: "Contractor", question: PAY_QUESTION }, { model: null })).toMatchObject({
      ok: false,
      status: 503,
      error: { code: "model_unavailable" },
    });
  });

  it("a model failure is an error, not 'does not say'", async () => {
    const outcome = await askAboutUnsavedText({ text, party: "Contractor", question: PAY_QUESTION }, { model: new FakeModel([{ throws: new Error("x") }]) });
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome)).not.toContain(DOES_NOT_SAY);
  });
});
