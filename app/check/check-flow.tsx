"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { RUN_ERROR_MESSAGES, type SavedState } from "../../lib/analysis/run.ts";
import { findPartyCandidates } from "../../lib/intake/parties.ts";
import { CONTRACT_FILE_ACCEPT } from "../../lib/intake/formats.ts";
import { INTAKE_REFUSAL_MESSAGES, normalisePastedText } from "../../lib/intake/text-file.ts";
import { checkTitle, MAX_TITLE_CHARS, suggestTitle } from "../../lib/intake/title.ts";
import { CheckError } from "../analysis/check-error.tsx";
import { ResultView } from "../analysis/result-view.tsx";
import { ChangeParty } from "./change-party.tsx";
import { chosenParty, NO_PARTY, partyFocusId, PartyPicker, partyProblem, type PartyChoice, type PartyProblem } from "./party-picker.tsx";
import { postCheck, type CheckResult } from "./post-check.ts";

type Stage =
  | {
      kind: "intake";
      refusal: string | null;
      /** The name of the file being read in the browser, while it is read. */
      reading: string | null;
    }
  | {
      kind: "preview";
      text: string;
      /** Party names found in the opening of the text, offered to pick from. */
      candidates: string[];
      source: "file" | "paste";
      error: string | null;
      running: boolean;
    }
  | { kind: "result"; text: string; candidates: string[]; result: CheckResult };

type Props = {
  accountsOpen: boolean;
  /** Signed in, the result is stored, so the reader names it first (story 5). Signed out, nothing is stored and no title is asked for. */
  signedIn?: boolean;
};

export const TITLE_FIELD_COPY = {
  label: "Title",
  hint: "Your library lists the contract under this title.",
} as const;

/**
 * Loads the file readers (and, through them, the PDF and Word parsers) only when a file is chosen.
 * The `typeof window` test is settled at build time, so the server build of this page never
 * reaches the import and the parsers stay out of the server bundle.
 */
function loadFileReader() {
  return typeof window !== "undefined"
    ? import("../../lib/intake/file.ts")
    : Promise.reject(new Error("Files are read in the browser."));
}

/** Choose or paste, see the text, pick or type your party, check, then the result. */
export function CheckFlow({ accountsOpen, signedIn = false }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: "intake", refusal: null, reading: null });
  const [pasted, setPasted] = useState("");
  const [choice, setChoice] = useState<PartyChoice>(NO_PARTY);
  const [partyError, setPartyError] = useState<PartyProblem | null>(null);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  /** Counts file choices, so a slow read that a newer choice replaced is ignored. */
  const readCount = useRef(0);
  const ids = { file: useId(), paste: useId(), party: useId(), title: useId() };

  function showPreview(text: string, source: "file" | "paste") {
    const candidates = findPartyCandidates(text);
    setStage({ kind: "preview", text, candidates, source, error: null, running: false });
    setChoice(NO_PARTY);
    setPartyError(null);
    setTitle(suggestTitle(text));
    setTitleError(null);
  }

  function refuse(message: string) {
    setStage({ kind: "intake", refusal: message, reading: null });
    if (fileInput.current) fileInput.current.value = "";
  }

  /**
   * Reads the chosen file here in the browser. Accepted text goes to the preview; a refused file
   * shows its message in place and nothing is kept or sent.
   */
  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const read = ++readCount.current;
    setStage({ kind: "intake", refusal: null, reading: file.name });
    const current = () => read === readCount.current;
    await loadFileReader()
      .then(({ takeContractFile }) =>
        takeContractFile(file, {
          onText: (text) => current() && showPreview(text, "file"),
          onRefused: (message) => current() && refuse(message),
        }),
      )
      .catch(() => current() && refuse("Redline couldn't read that file. Try again, or paste the text below."));
  }

  function startOver() {
    readCount.current += 1;
    setStage({ kind: "intake", refusal: null, reading: null });
    setChoice(NO_PARTY);
    setPartyError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function analyse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage.kind !== "preview" || stage.running) return;
    let checkedTitle: string | null = null;
    if (signedIn) {
      const titleCheck = checkTitle(title);
      if (!titleCheck.ok) {
        setTitleError(RUN_ERROR_MESSAGES[titleCheck.code]);
        document.getElementById(ids.title)?.focus();
        return;
      }
      setTitleError(null);
      checkedTitle = titleCheck.title;
    }
    const problem = partyProblem(choice, stage.candidates);
    if (problem) {
      setPartyError(problem);
      document.getElementById(partyFocusId(ids.party, choice, stage.candidates))?.focus();
      return;
    }
    setPartyError(null);
    const party = chosenParty(choice, stage.candidates);
    const { text, candidates, source } = stage;
    setStage({ ...stage, error: null, running: true });

    const outcome = await postCheck(
      "/api/analyse",
      checkedTitle === null ? { text, party } : { text, party, title: checkedTitle },
    );
    if (!outcome.ok) {
      setStage({ kind: "preview", text, candidates, source, error: outcome.message, running: false });
      return;
    }
    setStage({ kind: "result", text, candidates, result: outcome.result });
    window.scrollTo({ top: 0 });
  }

  /**
   * Checks the same text again as a different party and replaces the result. A saved document is
   * rerun from its stored text on the server; otherwise the text on this page is sent again.
   */
  async function rerun(party: string): Promise<string | null> {
    if (stage.kind !== "result") return null;
    const { text, candidates, result } = stage;
    const outcome =
      result.saved.kind === "saved"
        ? await postCheck(`/api/documents/${result.saved.documentId}/party`, { party })
        : await postCheck("/api/analyse", { text, party });
    if (!outcome.ok) return outcome.message;
    setStage({ kind: "result", text, candidates, result: outcome.result });
    return null;
  }

  if (stage.kind === "result") {
    return (
      <>
        <div className="check-intro">
          <h1 className="check-title">{stage.result.title}</h1>
          <SavedLine saved={stage.result.saved} accountsOpen={accountsOpen} />
          <ChangeParty candidates={stage.candidates} currentParty={stage.result.party} rerun={rerun} />
        </div>
        <div className="check-sheet">
          <ResultView
            storedText={stage.text}
            party={stage.result.party}
            flags={stage.result.flags}
            receipt={stage.result.receipt}
            checkedRedLines={stage.result.checkedRedLines}
          />
        </div>
        <p className="check-again">
          <button type="button" className="action" onClick={startOver}>
            Check another contract
          </button>
        </p>
      </>
    );
  }

  if (stage.kind === "preview") {
    const paragraphs = stage.text.split("\n\n");
    return (
      <>
        <div className="check-intro">
          <h1 className="check-title">Is this the right contract?</h1>
          <p className="check-lead">
            This is the text Redline will check. Every sentence it quotes comes from here, word for word.
          </p>
        </div>
        <div className="check-columns">
          <section
            className="text-preview"
            tabIndex={0}
            aria-label="The contract text Redline will check"
          >
            {paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </section>

          <form className="check-form" onSubmit={analyse} noValidate>
            {stage.error ? <CheckError message={stage.error} /> : null}
            {signedIn ? (
              <div className="field">
                <label htmlFor={ids.title}>{TITLE_FIELD_COPY.label}</label>
                <input
                  id={ids.title}
                  type="text"
                  name="title"
                  value={title}
                  maxLength={MAX_TITLE_CHARS}
                  autoComplete="off"
                  disabled={stage.running}
                  aria-invalid={titleError ? true : undefined}
                  aria-describedby={titleError ? `${ids.title}-hint ${ids.title}-error` : `${ids.title}-hint`}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (titleError && checkTitle(e.target.value).ok) setTitleError(null);
                  }}
                />
                <p id={`${ids.title}-hint`} className="field-hint">
                  {TITLE_FIELD_COPY.hint}
                </p>
                {titleError ? (
                  <p id={`${ids.title}-error`} className="field-error">
                    {titleError}
                  </p>
                ) : null}
              </div>
            ) : null}
            <PartyPicker
              idBase={ids.party}
              candidates={stage.candidates}
              choice={choice}
              onChange={(next) => {
                setChoice(next);
                if (partyError) setPartyError(partyProblem(next, stage.candidates));
              }}
              problem={partyError}
              disabled={stage.running}
            />
            <button type="submit" className="action" disabled={stage.running}>
              {stage.running ? "Checking…" : "Check the contract"}
            </button>
            <p className="check-status" role="status">
              {stage.running
                ? "Checking the contract against your red lines. This can take a minute or two."
                : ""}
            </p>
            <button type="button" className="quiet-button" onClick={startOver} disabled={stage.running}>
              Use a different contract
            </button>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="check-intro">
        <h1 className="check-title">Check a contract</h1>
        <p className="check-lead">
          Choose a PDF, Word (.docx) or .txt file, or paste the contract&apos;s text. Your file stays
          on your computer. Redline sends only the text.
        </p>
      </div>
      <div className="check-sheet check-intake">
        {stage.refusal ? (
          <p className="account-error" role="alert">
            {stage.refusal}
          </p>
        ) : null}
        <div className="field">
          <label htmlFor={ids.file}>Choose a file</label>
          <input
            ref={fileInput}
            id={ids.file}
            type="file"
            accept={CONTRACT_FILE_ACCEPT}
            className="file-input"
            disabled={stage.reading !== null}
            aria-describedby={`${ids.file}-status`}
            onChange={(e) => void onFile(e.target.files)}
          />
          <p id={`${ids.file}-status`} className="check-status" role="status">
            {stage.reading ? `Reading ${stage.reading}…` : ""}
          </p>
        </div>
        <form
          className="paste-form"
          onSubmit={(e) => {
            e.preventDefault();
            const result = normalisePastedText(pasted);
            if (result.ok) showPreview(result.text, "paste");
            else refuse(INTAKE_REFUSAL_MESSAGES[result.reason]);
          }}
        >
          <div className="field">
            <label htmlFor={ids.paste}>Or paste the text</label>
            <textarea
              id={ids.paste}
              rows={8}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
          </div>
          <button type="submit" className="action action-secondary">
            Use this text
          </button>
        </form>
      </div>
    </>
  );
}

function SavedLine({ saved, accountsOpen }: { saved: SavedState; accountsOpen: boolean }) {
  if (saved.kind === "saved") {
    return (
      <p className="saved-line">
        Saved to your account.{" "}
        <Link href={`/documents/${saved.documentId}`}>Open the saved copy</Link>
      </p>
    );
  }
  if (saved.kind === "save_failed") {
    return (
      <p className="saved-line" role="alert">
        Redline couldn&apos;t save this result, so it won&apos;t be in your library. The result below is complete.
      </p>
    );
  }
  if (!accountsOpen) {
    return <p className="saved-line">Redline isn&apos;t keeping this result. Accounts aren&apos;t open yet.</p>;
  }
  return (
    <p className="saved-line">
      Redline isn&apos;t keeping this result. <Link href="/sign-up">Create an account</Link> to keep it.
    </p>
  );
}
