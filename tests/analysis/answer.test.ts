// The question box's boundary (ticket 11, stories 36 to 41, T6 structural part, B14). The real
// answer(), verifySourceSentence() and banned-word check run on the fixture; only the model is
// faked. Prompt wording is not inspected, except that the question and the party reach the model.
import { describe, expect, it } from "vitest";
import { answer, DOES_NOT_SAY, MAX_QUESTION_CHARS, type AnswerOutcome } from "../../lib/analysis/answer.ts";
import { FakeModel, fakeModel, loadContract } from "../support/fake-model.ts";

const { text, sidecar } = loadContract("one-sided-services-agreement");
const PARTY = "Contractor";
const QUESTION = "How many days does Client have to pay an invoice?";
const PAY_SENTENCE = sidecar.flags.find((flag) => flag.sentence.includes("seventy-five"))!.sentence;
const ANSWER = "Client has 75 days after receiving an approved invoice to pay it.";
const MISQUOTE = "Client shall pay each invoice within seventy-five days.";

function ask(model: FakeModel, question = QUESTION, party = PARTY): Promise<AnswerOutcome> {
  return answer({ text, party, question }, { model });
}

function resultOf(outcome: AnswerOutcome) {
  if (!outcome.ok) throw new Error(`expected a result, got ${outcome.error.kind}`);
  return outcome.result;
}

describe("answer()", () => {
  it("the sidecar sentence is in the fixture text", () => {
    expect(text.includes(PAY_SENTENCE)).toBe(true);
    expect(text.includes(MISQUOTE)).toBe(false);
  });

  it("returns a verified answer with its citation and offset", async () => {
    const model = fakeModel({ answer: ANSWER, citation: PAY_SENTENCE });
    const result = resultOf(await ask(model));
    expect(result).toEqual({ kind: "answered", answer: ANSWER, citation: PAY_SENTENCE, offset: text.indexOf(PAY_SENTENCE) });
    if (result.kind !== "answered") throw new Error("unreachable");
    expect(text.slice(result.offset, result.offset + result.citation.length)).toBe(result.citation);
    expect(model.calls).toHaveLength(1);
  });

  it("sends the question and the reader's party to the model", async () => {
    const model = fakeModel({ answer: ANSWER, citation: PAY_SENTENCE });
    await ask(model, `  ${QUESTION}  `, "Client");
    const [call] = model.calls;
    expect(call.metadata).toEqual({ party: "Client", question: QUESTION });
    expect(call.user).toContain(QUESTION);
    expect(call.user).toContain("Client");
    expect(call.jsonSchema).toMatchObject({ required: ["answer", "citation"], additionalProperties: false });
    expect(Object.keys((call.jsonSchema as { properties: object }).properties)).toEqual(["answer", "citation"]);
  });

  it("an answer with no citation is 'does not say', with no second call", async () => {
    const model = fakeModel({ answer: ANSWER, citation: null });
    expect(resultOf(await ask(model))).toEqual({ kind: "does_not_say" });
    expect(model.calls).toHaveLength(1);
  });

  it("a blank citation counts as no citation", async () => {
    const model = fakeModel({ answer: ANSWER, citation: "   " });
    expect(resultOf(await ask(model))).toEqual({ kind: "does_not_say" });
    expect(model.calls).toHaveLength(1);
  });

  it("a null answer is 'does not say', even with a citation", async () => {
    for (const payload of [{ answer: null, citation: null }, { answer: null, citation: PAY_SENTENCE }, { answer: "", citation: PAY_SENTENCE }]) {
      const model = fakeModel(payload);
      expect(resultOf(await ask(model, "Is this clause normal?"))).toEqual({ kind: "does_not_say" });
      expect(model.calls).toHaveLength(1);
    }
  });

  it("a misquoted citation fixed on regeneration is answered", async () => {
    const model = fakeModel({ answer: ANSWER, citation: MISQUOTE }, { answer: ANSWER, citation: PAY_SENTENCE });
    const result = resultOf(await ask(model));
    expect(result).toEqual({ kind: "answered", answer: ANSWER, citation: PAY_SENTENCE, offset: text.indexOf(PAY_SENTENCE) });
    expect(model.calls).toHaveLength(2);
    expect(model.calls[1].metadata).toEqual({ party: PARTY, question: QUESTION });
  });

  it("a citation misquoted twice is 'does not say', and the misquote appears nowhere in the result", async () => {
    const model = fakeModel({ answer: ANSWER, citation: MISQUOTE }, { answer: ANSWER, citation: `${MISQUOTE} ` });
    const outcome = await ask(model);
    expect(resultOf(outcome)).toEqual({ kind: "does_not_say" });
    expect(JSON.stringify(outcome)).not.toContain("seventy-five days");
    expect(JSON.stringify(outcome)).not.toContain(ANSWER);
    expect(model.calls).toHaveLength(2);
  });

  it("a banned word in the answer is regenerated, then 'does not say' if it comes back", async () => {
    const hedged = "Client may take 75 days to pay an approved invoice.";
    const model = fakeModel({ answer: hedged, citation: PAY_SENTENCE }, { answer: "That is normal for this kind of agreement.", citation: PAY_SENTENCE });
    const outcome = await ask(model);
    expect(resultOf(outcome)).toEqual({ kind: "does_not_say" });
    expect(JSON.stringify(outcome)).not.toContain(hedged);
    expect(model.calls).toHaveLength(2);
  });

  it("a banned word fixed on regeneration is answered", async () => {
    const model = fakeModel({ answer: "Client may take 75 days.", citation: PAY_SENTENCE }, { answer: ANSWER, citation: PAY_SENTENCE });
    expect(resultOf(await ask(model))).toMatchObject({ kind: "answered", answer: ANSWER });
  });

  it("a regeneration that drops the citation is 'does not say'", async () => {
    const model = fakeModel({ answer: ANSWER, citation: MISQUOTE }, { answer: ANSWER, citation: null });
    expect(resultOf(await ask(model))).toEqual({ kind: "does_not_say" });
  });

  it("a model that throws is an error, not 'does not say'", async () => {
    const outcome = await ask(new FakeModel([{ throws: new Error("timeout") }]));
    expect(outcome).toMatchObject({ ok: false, error: { kind: "model_failed" } });
  });

  it("unparsable output is an error", async () => {
    const outcome = await ask(new FakeModel([{ raw: "{ not json" }]));
    expect(outcome).toMatchObject({ ok: false, error: { kind: "malformed_output" } });
  });

  it("output with the wrong shape is an error", async () => {
    for (const payload of [{ answer: 5, citation: null }, { answer: ANSWER }, [ANSWER], "text"]) {
      const outcome = await ask(fakeModel(payload));
      expect(outcome).toMatchObject({ ok: false, error: { kind: "malformed_output" } });
    }
  });

  it("a failure on the regeneration call is an error", async () => {
    const model = new FakeModel([{ json: { answer: ANSWER, citation: MISQUOTE } }, { throws: new Error("502") }]);
    expect(await ask(model)).toMatchObject({ ok: false, error: { kind: "model_failed" } });
  });

  it("refuses an empty or over-long question before any model call", async () => {
    for (const question of ["", "   \n ", "x".repeat(MAX_QUESTION_CHARS + 1)]) {
      const model = fakeModel({ answer: ANSWER, citation: PAY_SENTENCE });
      const outcome = await ask(model, question);
      expect(outcome.ok).toBe(false);
      expect(model.calls).toHaveLength(0);
    }
    const atLimit = fakeModel({ answer: ANSWER, citation: PAY_SENTENCE });
    expect((await ask(atLimit, "x".repeat(MAX_QUESTION_CHARS))).ok).toBe(true);
  });

  it("the shown wording is exactly the product's", () => {
    expect(DOES_NOT_SAY).toBe("The document does not say.");
  });
});
