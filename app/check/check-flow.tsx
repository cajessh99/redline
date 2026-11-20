"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import type { Flag } from "../../lib/analysis/analyse.ts";
import type { CheckedRedLine, SavedState } from "../../lib/analysis/run.ts";
import {
  INTAKE_REFUSAL_MESSAGES,
  normalisePastedText,
  readPlainTextFile,
  type IntakeResult,
} from "../../lib/intake/text-file.ts";
import { ResultView } from "../analysis/result-view.tsx";

type Result = {
  title: string;
  party: string;
  flags: Flag[];
  checkedRedLines: CheckedRedLine[];
  saved: SavedState;
};

type Stage =
  | { kind: "intake"; refusal: string | null }
  | { kind: "preview"; text: string; source: "file" | "paste"; error: string | null; running: boolean }
  | { kind: "result"; text: string; result: Result };

const NETWORK_ERROR =
  "Redline couldn't reach its server. Nothing was checked or saved. Check your connection and try again.";

const SERVER_ERROR =
  "Redline couldn't finish reading this contract. It shows a result only when the whole check finishes. Nothing was saved. Try again in a minute.";

type Props = { accountsOpen: boolean };

/** Choose or paste, see the text, type your party, check, then the result. */
export function CheckFlow({ accountsOpen }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: "intake", refusal: null });
  const [pasted, setPasted] = useState("");
  const [party, setParty] = useState("");
  const [partyError, setPartyError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const ids = { file: useId(), paste: useId(), party: useId(), partyHint: useId(), partyError: useId() };

  function accept(result: IntakeResult, source: "file" | "paste") {
    if (result.ok) {
      setStage({ kind: "preview", text: result.text, source, error: null, running: false });
      setPartyError(false);
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
    setParty("");
    setPartyError(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function analyse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage.kind !== "preview" || stage.running) return;
    if (party.trim() === "") {
      setPartyError(true);
      document.getElementById(ids.party)?.focus();
      return;
    }
    setPartyError(false);
    const text = stage.text;
    setStage({ ...stage, error: null, running: true });

    const fail = (message: string) =>
      setStage({ kind: "preview", text, source: stage.source, error: message, running: false });

    let response: Response;
    try {
      response = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, party }),
      });
    } catch {
      fail(NETWORK_ERROR);
      return;
    }

    let body: ({ ok: true } & Result) | { ok: false; error: { message: string } };
    try {
      body = await response.json();
    } catch {
      // A gateway timeout or crash answers with something that isn't the API's JSON.
      fail(SERVER_ERROR);
      return;
    }
    if (!body.ok) {
      fail(body.error.message);
      return;
    }
    setStage({ kind: "result", text, result: body });
    window.scrollTo({ top: 0 });
  }

  if (stage.kind === "result") {
    return (
      <>
        <div className="check-intro">
          <h1 className="check-title">{stage.result.title}</h1>
          <SavedLine saved={stage.result.saved} accountsOpen={accountsOpen} />
        </div>
        <div className="check-sheet">
          <ResultView
            storedText={stage.text}
            party={stage.result.party}
            flags={stage.result.flags}
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
            <div className="field">
              <label htmlFor={ids.party}>Your party</label>
              <p className="field-hint" id={ids.partyHint}>
                Type the name the contract uses for your side.
              </p>
              <input
                id={ids.party}
                name="party"
                type="text"
                autoComplete="off"
                required
                maxLength={120}
                value={party}
                onChange={(e) => setParty(e.target.value)}
                aria-invalid={partyError || undefined}
                aria-describedby={partyError ? `${ids.partyHint} ${ids.partyError}` : ids.partyHint}
                disabled={stage.running}
              />
              {partyError ? (
                <p className="field-error" id={ids.partyError}>
                  Type your party first. Redline won&apos;t guess which side you&apos;re on.
                </p>
              ) : null}
            </div>
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
