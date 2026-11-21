// The question box rendered to HTML (ticket 11): the answered and "does not say" states, a stored
// answer whose citation no longer verifies, the signed-out line, the label, and no banned word in
// Redline's own copy. Answers come from the real answer() with the fake model.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QUESTION_COPY, QuestionBox } from "../../app/analysis/question-box.tsx";
import { answer, DOES_NOT_SAY } from "../../lib/analysis/answer.ts";
import { ASK_ERROR_MESSAGES, type AskedQuestion } from "../../lib/analysis/ask.ts";
import { findBannedWord } from "../../lib/copy/banned-words.ts";
import { fakeModel, loadContract } from "../support/fake-model.ts";

const { text, sidecar } = loadContract("one-sided-services-agreement");
const PAY_SENTENCE = sidecar.flags.find((flag) => flag.sentence.includes("seventy-five"))!.sentence;
const PAY_ANSWER = "Client has 75 days after receiving an approved invoice to pay it.";

function decode(markup: string): string {
  return markup
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function readerText(markup: string): string {
  return decode(markup.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
}

async function asked(question: string, payload: unknown, party = "Contractor"): Promise<AskedQuestion> {
  const outcome = await answer({ text, party, question }, { model: fakeModel(payload) });
  if (!outcome.ok) throw new Error("expected a result");
  return { id: crypto.randomUUID(), question, party, createdAt: new Date().toISOString(), result: outcome.result };
}

function render(props: Partial<Parameters<typeof QuestionBox>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(QuestionBox, {
      storedText: text,
      party: "Contractor",
      endpoint: { url: "/api/documents/x/questions", body: {} },
      kept: true,
      ...props,
    }),
  );
}

describe("QuestionBox", () => {
  it("has a labelled question field and an Ask button", () => {
    const markup = render();
    const id = /<textarea[^>]*id="([^"]+)"/.exec(markup)?.[1];
    expect(id).toBeTruthy();
    expect(markup).toContain(`<label for="${id}">${QUESTION_COPY.label}</label>`);
    expect(markup).toMatch(/<button type="submit" class="action"[^>]*>Ask<\/button>/);
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain("question-list");
  });

  it("shows an answer with its cited sentence set as a quotation, verbatim", async () => {
    const q = await asked("How many days does Client have to pay an invoice?", { answer: PAY_ANSWER, citation: PAY_SENTENCE });
    const markup = render({ initial: [q] });
    expect(readerText(markup)).toContain(PAY_ANSWER);
    expect(markup).toContain(`<blockquote class="flag-source"><p>${PAY_SENTENCE.replace(/'/g, "&#x27;")}</p></blockquote>`);
    expect(readerText(markup)).toContain(QUESTION_COPY.sourceLabel);
    expect(markup).not.toContain(`<p class="question-answer">${DOES_NOT_SAY}</p>`);
  });

  it("shows 'The document does not say.' with no quotation", async () => {
    const q = await asked("Is this clause normal?", { answer: null, citation: null });
    const markup = render({ initial: [q] });
    expect(markup).toContain(`<p class="question-answer">${DOES_NOT_SAY}</p>`);
    expect(markup).not.toContain("<blockquote");
  });

  it("never shows a citation that is not verbatim at its offset", () => {
    const tampered: AskedQuestion = {
      id: "a",
      question: "When do I get paid?",
      party: "Contractor",
      result: { kind: "answered", answer: PAY_ANSWER, citation: PAY_SENTENCE, offset: text.indexOf(PAY_SENTENCE) + 1 },
    };
    const markup = render({ initial: [tampered] });
    expect(markup).not.toContain("<blockquote");
    expect(readerText(markup)).not.toContain(PAY_ANSWER);
    expect(markup).toContain(`<p class="question-answer">${DOES_NOT_SAY}</p>`);
  });

  it("lists questions in the order given (newest first) and notes a different party", async () => {
    const older = await asked("What does Client pay?", { answer: null, citation: null }, "Client");
    const newer = await asked("How many days does Client have to pay an invoice?", { answer: PAY_ANSWER, citation: PAY_SENTENCE });
    const page = readerText(render({ initial: [newer, older] }));
    expect(page.indexOf(newer.question)).toBeLessThan(page.indexOf(older.question));
    expect(page).toContain(QUESTION_COPY.answeredAs("Client"));
    expect(page).not.toContain(QUESTION_COPY.answeredAs("Contractor"));
  });

  it("says in one line that questions aren't kept when nothing is stored", () => {
    expect(readerText(render({ kept: false }))).toContain(QUESTION_COPY.notKept);
    expect(readerText(render({ kept: true }))).not.toContain(QUESTION_COPY.notKept);
  });

  it("uses no banned word in Redline's own copy", async () => {
    const lines = [
      ...Object.values(QUESTION_COPY).map((v) => (typeof v === "function" ? v("Contractor") : v)),
      ...Object.values(ASK_ERROR_MESSAGES),
      DOES_NOT_SAY,
    ];
    for (const line of lines) expect(findBannedWord(line), line).toBeNull();

    const q = await asked("How many days does Client have to pay an invoice?", { answer: PAY_ANSWER, citation: PAY_SENTENCE });
    const none = await asked("Is this normal?", { answer: null, citation: null }, "Client");
    const page = readerText(render({ initial: [q, none], kept: false }));
    // Cut out the contract's own wording and the reader's questions; what is left is Redline's.
    const own = [PAY_SENTENCE, PAY_ANSWER, q.question, none.question].reduce((rest, quote) => rest.split(quote).join(" "), page);
    expect(findBannedWord(own)).toBeNull();
  });
});
