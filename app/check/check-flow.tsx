"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import type { SavedState } from "../../lib/analysis/run.ts";
import { findPartyCandidates } from "../../lib/intake/parties.ts";
import {
  INTAKE_REFUSAL_MESSAGES,
  normalisePastedText,
  readPlainTextFile,
  type IntakeResult,
} from "../../lib/intake/text-file.ts";
import { ResultView } from "../analysis/result-view.tsx";
import { ChangeParty } from "./change-party.tsx";
import { chosenParty, NO_PARTY, partyFocusId, PartyPicker, partyProblem, type PartyChoice, type PartyProblem } from "./party-picker.tsx";
import { postCheck, type CheckResult } from "./post-check.ts";

type Stage =
  | { kind: "intake"; refusal: string | null }
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

type Props = { accountsOpen: boolean };

/** Choose or paste, see the text, pick or type your party, check, then the result. */
export function CheckFlow({ accountsOpen }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: "intake", refusal: null });
  const [pasted, setPasted] = useState("");
  const [choice, setChoice] = useState<PartyChoice>(NO_PARTY);
  const [partyError, setPartyError] = useState<PartyProblem | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ids = { file: useId(), paste: useId(), party: useId() };

  function accept(result: IntakeResult, source: "file" | "paste") {
    if (result.ok) {
      const candidates = findPartyCandidates(result.text);
      setStage({ kind: "preview", text: result.text, candidates, source, error: null, running: false });
      setChoice(NO_PARTY);
      setPartyError(null);
    } else {
      setStage({ kind: "intake", refusal: INTAKE_REFUSAL_MESSAGES[result.reason] });
    }
  }

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    accept(await readPlainTextFile(file), "file");
  }

  function startOver() {
    setStage({ kind: "intake", refusal: null });
    setChoice(NO_PARTY);
    setPartyError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function analyse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage.kind !== "preview" || stage.running) return;
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

    const outcome = await postCheck("/api/analyse", { text, party });
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
            {stage.error ? (
              <p className="account-error" role="alert">
                {stage.error}
              </p>
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
          Choose a .txt file or paste the contract&apos;s text. Your file stays on your computer.
          Redline sends only the text.
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
            accept=".txt,text/plain"
            className="file-input"
            onChange={(e) => void onFile(e.target.files)}
          />
        </div>
        <form
          className="paste-form"
          onSubmit={(e) => {
            e.preventDefault();
            accept(normalisePastedText(pasted), "paste");
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
