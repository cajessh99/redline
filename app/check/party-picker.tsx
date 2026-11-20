"use client";

// The party picker (spec stories 7-9, D10). The names Redline found in the contract's opening are
// offered as radio options, none selected, with one more option to type a different name. With no
// names found, the reader types their party. Nothing is ever selected or filled in for them.

/** The radio value for "type a different name". Not a name any contract defines. */
export const OTHER_PARTY = "\u0000other";

export type PartyChoice = { picked: string | null; typed: string };

/** Nothing picked and nothing typed: how every picker starts. */
export const NO_PARTY: PartyChoice = { picked: null, typed: "" };

export type PartyProblem = "not_picked" | "not_typed";

export const PARTY_COPY = {
  legend: "Which party are you?",
  hint: "These are the names the contract gives each side. Pick yours, and Redline reads every clause from that side.",
  other: "A different name",
  otherLabel: "The name the contract uses for you",
  typedLabel: "Your party",
  typedHint:
    "Redline didn't find the names this contract gives each side. Type the name it uses for yours, such as Contractor or Tenant.",
};

export const PARTY_PROBLEM_MESSAGES: Record<PartyProblem, string> = {
  not_picked: "Pick your party first. Redline won't guess which side you're on.",
  not_typed: "Type your party first. Redline won't guess which side you're on.",
};

/** The party the reader chose, trimmed, or "" when they have not chosen one. */
export function chosenParty(choice: PartyChoice, candidates: readonly string[]): string {
  if (candidates.length === 0 || choice.picked === OTHER_PARTY) return choice.typed.trim();
  if (choice.picked !== null && candidates.includes(choice.picked)) return choice.picked;
  return "";
}

/** Why the reader cannot go on yet, or null when a party is chosen. */
export function partyProblem(choice: PartyChoice, candidates: readonly string[]): PartyProblem | null {
  if (chosenParty(choice, candidates) !== "") return null;
  if (candidates.length === 0 || choice.picked === OTHER_PARTY) return "not_typed";
  return "not_picked";
}

/** The id of the control to focus when the reader tries to go on without a party. */
export function partyFocusId(idBase: string, choice: PartyChoice, candidates: readonly string[]): string {
  if (candidates.length === 0 || choice.picked === OTHER_PARTY) return `${idBase}-typed`;
  return `${idBase}-option-0`;
}

type Props = {
  /** A unique id prefix, from useId() in the parent. */
  idBase: string;
  candidates: readonly string[];
  choice: PartyChoice;
  onChange: (choice: PartyChoice) => void;
  problem: PartyProblem | null;
  disabled?: boolean;
};

export function PartyPicker({ idBase, candidates, choice, onChange, problem, disabled }: Props) {
  const hintId = `${idBase}-hint`;
  const errorId = `${idBase}-error`;
  const typedId = `${idBase}-typed`;
  const describedBy = problem ? `${hintId} ${errorId}` : hintId;
  const error = problem ? (
    <p className="field-error" id={errorId}>
      {PARTY_PROBLEM_MESSAGES[problem]}
    </p>
  ) : null;

  if (candidates.length === 0) {
    return (
      <div className="field">
        <label htmlFor={typedId}>{PARTY_COPY.typedLabel}</label>
        <p className="field-hint" id={hintId}>
          {PARTY_COPY.typedHint}
        </p>
        <input
          id={typedId}
          name="party"
          type="text"
          autoComplete="off"
          maxLength={120}
          value={choice.typed}
          onChange={(e) => onChange({ ...choice, typed: e.target.value })}
          aria-invalid={problem ? true : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
        />
        {error}
      </div>
    );
  }

  const other = choice.picked === OTHER_PARTY;
  const options = [...candidates.map((name) => ({ value: name, label: name })), { value: OTHER_PARTY, label: PARTY_COPY.other }];

  return (
    <fieldset className="party-picker" aria-describedby={describedBy} disabled={disabled}>
      <legend>{PARTY_COPY.legend}</legend>
      <p className="field-hint" id={hintId}>
        {PARTY_COPY.hint}
      </p>
      <div className="party-options">
        {options.map((option, i) => {
          const id = `${idBase}-option-${i}`;
          return (
            <label key={option.value} className="party-option" htmlFor={id}>
              <input
                id={id}
                type="radio"
                name={`${idBase}-party`}
                value={option.value}
                checked={choice.picked === option.value}
                onChange={() => onChange({ ...choice, picked: option.value })}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      {other ? (
        <div className="field party-other">
          <label htmlFor={typedId}>{PARTY_COPY.otherLabel}</label>
          <input
            id={typedId}
            name="party"
            type="text"
            autoComplete="off"
            maxLength={120}
            value={choice.typed}
            onChange={(e) => onChange({ ...choice, typed: e.target.value })}
            aria-invalid={problem === "not_typed" ? true : undefined}
            aria-describedby={problem === "not_typed" ? errorId : undefined}
          />
        </div>
      ) : null}
      {error}
    </fieldset>
  );
}
