"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { DOES_NOT_SAY, MAX_QUESTION_CHARS } from "../../lib/analysis/answer.ts";
import { ASK_ERROR_MESSAGES, type AskedQuestion } from "../../lib/analysis/ask.ts";
import { isVerbatimAt } from "../../lib/analysis/stored.ts";
import { CheckError } from "./check-error.tsx";
import { questionOriginId, type CitedSource } from "./source-jump.ts";
import { SourceLink, useReportQuestionSources } from "./source-links.tsx";

/** Every line the question box shows. Run through the humanizer skill; checked for banned words in tests. */
export const QUESTION_COPY = {
  heading: "Ask about this contract",
  lead: (party: string) =>
    `Redline answers only from this contract's text, read as ${party}, and quotes the sentence each answer comes from. If the text doesn't answer your question, you'll see "${DOES_NOT_SAY}"`,
  label: "Your question",
  hint: "For example: how many days does the client have to pay an invoice?",
  submit: "Ask",
  running: "Asking…",
  status: "Looking for the answer in the contract. This can take a minute.",
  notKept: "Redline isn't keeping these questions or their answers.",
  listLabel: "Your questions",
  sourceLabel: "Source sentence",
  answeredAs: (party: string) => `Answered as ${party}.`,
  saveFailed: "Redline couldn't save this question, so it won't be here when you come back.",
  networkError: "Redline couldn't reach its server. Check your connection and try again.",
} as const;

/** One question as listed: the stored or returned question, plus whether its save failed. */
type Listed = AskedQuestion & { key: string; saveFailed?: boolean };

type Props = {
  /** The text the answers quote from. Every citation is checked against it again before it is shown. */
  storedText: string;
  /** The party the next question is answered for. */
  party: string;
  /** Earlier questions, newest first (saved documents only). */
  initial?: AskedQuestion[];
  /** Where a question is posted, and what is sent with it besides the question. */
  endpoint: { url: string; body: Record<string, string> };
  /** False when nothing asked here is stored, which the box says in one line. */
  kept: boolean;
};

type Reply =
  | { ok: true; asked: AskedQuestion; kept: "kept" | "not_kept" | "save_failed" }
  | { ok: false; message: string };

async function postQuestion(url: string, body: Record<string, string>): Promise<Reply> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: QUESTION_COPY.networkError };
  }
  try {
    const parsed = (await response.json()) as Reply | { ok: false; error: { message: string } };
    if (parsed.ok) return parsed;
    return { ok: false, message: "error" in parsed ? parsed.error.message : ASK_ERROR_MESSAGES.answer_failed };
  } catch {
    // A gateway timeout or crash answers with something that isn't the API's JSON.
    return { ok: false, message: ASK_ERROR_MESSAGES.answer_failed };
  }
}

/** The answer to show: an answer only with a citation verbatim at its offset, otherwise "does not say". */
function shownAnswer(storedText: string, asked: AskedQuestion) {
  const result = asked.result;
  if (result.kind === "answered" && result.answer.trim() !== "" && isVerbatimAt(storedText, result.citation, result.offset)) {
    return result;
  }
  return null;
}

/** The cited sentence of an answer that is shown, as a source the full text can highlight. */
function answerSource(storedText: string, asked: Listed): CitedSource | null {
  const answered = shownAnswer(storedText, asked);
  return answered
    ? { kind: "question", originId: questionOriginId(asked.key), sentence: answered.citation, offset: answered.offset }
    : null;
}

function announcement(storedText: string, asked: AskedQuestion): string {
  const answered = shownAnswer(storedText, asked);
  return answered ? `${answered.answer} ${QUESTION_COPY.sourceLabel}: ${answered.citation}` : DOES_NOT_SAY;
}

/**
 * The question box under a result (stories 36 to 41): a labelled question field, a running state,
 * and the answers, newest first. Each answer shows its cited sentence word for word, set as a
 * quotation like a flag's source sentence, or "The document does not say."
 */
export function QuestionBox({ storedText, party, initial = [], endpoint, kept }: Props) {
  const [listed, setListed] = useState<Listed[]>(() =>
    initial.map((asked, i) => ({ ...asked, key: asked.id ?? `initial-${i}` })),
  );
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announced, setAnnounced] = useState("");
  const counter = useRef(0);
  const field = useRef<HTMLTextAreaElement>(null);
  const idBase = useId();
  const ids = { heading: `${idBase}-heading`, field: `${idBase}-question`, hint: `${idBase}-hint`, error: `${idBase}-error` };
  useReportQuestionSources(listed.flatMap((asked) => answerSource(storedText, asked) ?? []));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running) return;
    const trimmed = question.trim();
    if (trimmed === "") {
      setError(ASK_ERROR_MESSAGES.empty_question);
      field.current?.focus();
      return;
    }
    if (trimmed.length > MAX_QUESTION_CHARS) {
      setError(ASK_ERROR_MESSAGES.question_too_long);
      field.current?.focus();
      return;
    }
    setError(null);
    setAnnounced("");
    setRunning(true);
    const reply = await postQuestion(endpoint.url, { ...endpoint.body, question: trimmed });
    setRunning(false);
    if (!reply.ok) {
      setError(reply.message);
      // The field was disabled while asking; focus returns to it once it is enabled again.
      requestAnimationFrame(() => field.current?.focus());
      return;
    }
    counter.current += 1;
    const key = reply.asked.id ?? `asked-${counter.current}`;
    setListed((current) => [{ ...reply.asked, key, saveFailed: reply.kept === "save_failed" }, ...current]);
    setQuestion("");
    setAnnounced(announcement(storedText, reply.asked));
    requestAnimationFrame(() => field.current?.focus());
  }

  return (
    <section className="question-box" aria-labelledby={ids.heading}>
      <h2 id={ids.heading}>{QUESTION_COPY.heading}</h2>
      <p className="result-meta question-lead">{QUESTION_COPY.lead(party)}</p>
      {kept ? null : <p className="question-note">{QUESTION_COPY.notKept}</p>}

      <form className="question-form" onSubmit={submit} noValidate>
        {error ? <CheckError message={error} /> : null}
        <div className="field">
          <label htmlFor={ids.field}>{QUESTION_COPY.label}</label>
          <textarea
            ref={field}
            id={ids.field}
            name="question"
            rows={3}
            value={question}
            maxLength={MAX_QUESTION_CHARS}
            disabled={running}
            aria-describedby={ids.hint}
            aria-invalid={error === ASK_ERROR_MESSAGES.empty_question || error === ASK_ERROR_MESSAGES.question_too_long ? true : undefined}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <p id={ids.hint} className="field-hint">
            {QUESTION_COPY.hint}
          </p>
        </div>
        <button type="submit" className="action" disabled={running}>
          {running ? QUESTION_COPY.running : QUESTION_COPY.submit}
        </button>
        <p className="check-status" role="status">
          {running ? QUESTION_COPY.status : ""}
        </p>
      </form>

      <p className="visually-hidden" role="status" aria-live="polite">
        {announced}
      </p>

      {listed.length > 0 ? (
        <ol className="question-list" aria-label={QUESTION_COPY.listLabel}>
          {listed.map((asked) => {
            const answered = shownAnswer(storedText, asked);
            const source = answerSource(storedText, asked);
            return (
              <li key={asked.key} className="question-item" data-kind={answered ? "answered" : "does_not_say"}>
                <h3 className="question-asked">{asked.question}</h3>
                {asked.party !== party ? <p className="question-note">{QUESTION_COPY.answeredAs(asked.party)}</p> : null}
                {answered ? (
                  <>
                    <p className="question-answer">{answered.answer}</p>
                    <p className="slip-label">{QUESTION_COPY.sourceLabel}</p>
                    <blockquote className="flag-source">
                      <p>{answered.citation}</p>
                    </blockquote>
                    {source ? <SourceLink source={source} /> : null}
                  </>
                ) : (
                  <p className="question-answer">{DOES_NOT_SAY}</p>
                )}
                {asked.saveFailed ? <p className="question-note">{QUESTION_COPY.saveFailed}</p> : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
