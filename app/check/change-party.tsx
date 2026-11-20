"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import {
  chosenParty,
  NO_PARTY,
  partyFocusId,
  PartyPicker,
  partyProblem,
  type PartyChoice,
  type PartyProblem,
} from "./party-picker.tsx";

export const CHANGE_PARTY_COPY = {
  open: "Change my party",
  lead: (party: string) =>
    `You picked ${party}. Pick again and Redline checks the contract again from that side. The new result replaces this one.`,
  submit: "Check again",
  running: "Checking…",
  status: (party: string) => `Checking the contract again as ${party}. This can take a minute or two.`,
  cancel: "Cancel",
  done: (party: string) => `Showing the new result, checked as ${party}.`,
};

type Props = {
  candidates: readonly string[];
  currentParty: string;
  /** Reruns the check as `party` and shows the new result. Resolves to an error message, or null. */
  rerun: (party: string) => Promise<string | null>;
};

/**
 * "Change my party" on a result (spec story 10). Opens the same picker, with nothing selected, and
 * reruns the check as the new pick. The result it replaces stays on screen until the new one is in.
 */
export function ChangeParty({ candidates, currentParty, rerun }: Props) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<PartyChoice>(NO_PARTY);
  const [problem, setProblem] = useState<PartyProblem | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [returnFocus, setReturnFocus] = useState(false);
  const idBase = useId();
  const panelId = `${idBase}-panel`;
  const toggleId = `${idBase}-toggle`;

  // Focus goes back to the toggle once the panel has closed and the toggle is enabled again.
  useEffect(() => {
    if (!returnFocus) return;
    document.getElementById(toggleId)?.focus();
    setReturnFocus(false);
  }, [returnFocus, toggleId]);

  function close() {
    setOpen(false);
    setChoice(NO_PARTY);
    setProblem(null);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running) return;
    const found = partyProblem(choice, candidates);
    if (found) {
      setProblem(found);
      document.getElementById(partyFocusId(`${idBase}-picker`, choice, candidates))?.focus();
      return;
    }
    const party = chosenParty(choice, candidates);
    setProblem(null);
    setError(null);
    setDone(null);
    setRunning(party);
    const message = await rerun(party);
    setRunning(null);
    if (message) {
      setError(message);
      return;
    }
    close();
    setDone(party);
    setReturnFocus(true);
  }

  return (
    <div className="party-change">
      <button
        type="button"
        id={toggleId}
        className="quiet-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setDone(null);
          if (open) close();
          else setOpen(true);
        }}
        disabled={running !== null}
      >
        {CHANGE_PARTY_COPY.open}
      </button>
      <p className="check-status" role="status">
        {done !== null ? CHANGE_PARTY_COPY.done(done) : ""}
      </p>
      {open ? (
        <form id={panelId} className="check-form party-change-form" onSubmit={submit} noValidate>
          <p className="check-lead">{CHANGE_PARTY_COPY.lead(currentParty)}</p>
          {error ? (
            <p className="account-error" role="alert">
              {error}
            </p>
          ) : null}
          <PartyPicker
            idBase={`${idBase}-picker`}
            candidates={candidates}
            choice={choice}
            onChange={(next) => {
              setChoice(next);
              if (problem) setProblem(partyProblem(next, candidates));
            }}
            problem={problem}
            disabled={running !== null}
          />
          <button type="submit" className="action" disabled={running !== null}>
            {running !== null ? CHANGE_PARTY_COPY.running : CHANGE_PARTY_COPY.submit}
          </button>
          <p className="check-status" role="status">
            {running !== null ? CHANGE_PARTY_COPY.status(running) : ""}
          </p>
          <button type="button" className="quiet-button" onClick={close} disabled={running !== null}>
            {CHANGE_PARTY_COPY.cancel}
          </button>
        </form>
      ) : null}
    </div>
  );
}
