// The form for editing a red line or adding one (ticket 09). Presentational: its state and what a
// change or a submit does come from the caller, so it renders on the server in tests.
//
// Every field has a visible label, a hint, and, when wrong, an error, all tied to the field with
// aria-describedby. Ids are built from `idBase` so the caller can move focus to a field by id.

import { TIERS, type Tier } from "../../lib/red-lines/defaults.ts";
import type { DraftField } from "../../lib/red-lines/validation.ts";
import { EDIT_COPY } from "./edit-copy.ts";
import type { EditableField, FormEvent, FormState } from "./edit-state.ts";

/** The id of a field (or of the tier group, for "tiers") inside the form with this base. */
export function fieldId(idBase: string, field: DraftField): string {
  return `${idBase}-${field === "tiers" ? "tiers" : field.toLowerCase()}`;
}

type Props = {
  idBase: string;
  /** The form heading: an h3 inside a red line's row, an h2 for adding one. */
  heading: string;
  headingLevel: 2 | 3;
  state: Extract<FormState, { kind: "open" | "saving" }>;
  submitLabel: string;
  send: (event: FormEvent) => void;
};

function describedBy(...ids: Array<string | null | false>): string {
  return ids.filter(Boolean).join(" ");
}

export function RedLineForm({ idBase, heading, headingLevel, state, submitLabel, send }: Props) {
  const saving = state.kind === "saving";
  const errors = state.kind === "open" ? state.errors : {};
  const failed = state.kind === "open" && state.failed;
  const draft = state.draft;
  const headingId = `${idBase}-heading`;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  const change = (field: EditableField) => (e: { target: { value: string } }) =>
    send({ type: "change", field, value: e.target.value });

  function field(name: "title" | "description", label: string, hint: string) {
    const id = fieldId(idBase, name);
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const error = errors[name];
    const common = {
      id,
      name,
      value: draft[name],
      onChange: change(name),
      "aria-invalid": error ? true : undefined,
      "aria-describedby": describedBy(hintId, error ? errorId : null),
      readOnly: saving,
    };
    return (
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
        {name === "title" ? (
          <input type="text" autoComplete="off" {...common} />
        ) : (
          <textarea rows={3} {...common} />
        )}
        {error ? (
          <p className="field-error" id={errorId}>
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  function tierField(tier: Tier) {
    const id = fieldId(idBase, tier);
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const error = errors[tier];
    return (
      <div className="field red-line-tier-field" key={tier}>
        <label htmlFor={id}>{tier}</label>
        <p className="field-hint" id={hintId}>
          {EDIT_COPY.tierHints[tier]}
        </p>
        <textarea
          id={id}
          name={tier}
          rows={2}
          value={draft.tiers[tier]}
          onChange={change(tier)}
          aria-invalid={error || errors.tiers ? true : undefined}
          aria-describedby={describedBy(hintId, error ? errorId : null, errors.tiers ? `${fieldId(idBase, "tiers")}-error` : null)}
          readOnly={saving}
        />
        {error ? (
          <p className="field-error" id={errorId}>
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const tiersId = fieldId(idBase, "tiers");

  return (
    <form
      className="red-line-form"
      aria-labelledby={headingId}
      aria-busy={saving || undefined}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        send({ type: "submit" });
      }}
    >
      <Heading className="red-line-form-heading" id={headingId}>
        {heading}
      </Heading>
      {field("title", EDIT_COPY.titleLabel, EDIT_COPY.titleHint)}
      {field("description", EDIT_COPY.descriptionLabel, EDIT_COPY.descriptionHint)}
      <fieldset
        className="red-line-tier-fields"
        id={tiersId}
        tabIndex={-1}
        aria-describedby={describedBy(`${tiersId}-hint`, errors.tiers ? `${tiersId}-error` : null)}
      >
        <legend>{EDIT_COPY.tiersLegend}</legend>
        <p className="field-hint" id={`${tiersId}-hint`}>
          {EDIT_COPY.tiersHint}
        </p>
        {errors.tiers ? (
          <p className="field-error" id={`${tiersId}-error`}>
            {errors.tiers}
          </p>
        ) : null}
        {TIERS.map(tierField)}
      </fieldset>
      <p className="field-hint">{EDIT_COPY.pastResults}</p>
      {failed ? (
        <p className="account-error" role="alert">
          {EDIT_COPY.saveFailed}
        </p>
      ) : null}
      <div className="red-line-form-actions">
        <button type="submit" className="action action-secondary" disabled={saving}>
          {saving ? EDIT_COPY.saving : submitLabel}
        </button>
        <button type="button" className="quiet-button" disabled={saving} onClick={() => send({ type: "cancel" })}>
          {EDIT_COPY.cancel}
        </button>
      </div>
    </form>
  );
}
