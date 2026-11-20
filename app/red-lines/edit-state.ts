// Editing, adding, deleting and restoring red lines, as pure state machines (ticket 09; spec
// stories 15 to 19). Kept pure, like switch-state.ts, so the order of things is tested without a
// browser: a form saves only once its draft passes validation, and a delete or a restore runs only
// after the reader has seen the warning and confirmed it.
//
// Each transition returns the next state and at most one effect for the caller to carry out:
// save this wording, run the delete or restore, or move focus somewhere.

import type { Tier } from "../../lib/red-lines/defaults.ts";
import {
  firstInvalidField,
  validateRedLineDraft,
  type DraftErrors,
  type DraftField,
  type RedLineDraft,
  type RedLineWording,
} from "../../lib/red-lines/validation.ts";

// ---------------------------------------------------------------------------------------------
// The form, for editing a red line or adding one

export type FormState =
  | { kind: "closed" }
  /** `failed` is true after a save that didn't go through for a reason other than the fields. */
  | { kind: "open"; draft: RedLineDraft; errors: DraftErrors; failed: boolean }
  | { kind: "saving"; draft: RedLineDraft };

export type EditableField = "title" | "description" | Tier;

export type FormEvent =
  | { type: "open"; draft: RedLineDraft }
  | { type: "change"; field: EditableField; value: string }
  | { type: "submit" }
  | { type: "saved" }
  /** The save failed. `errors` is set when the server rejected fields, null otherwise. */
  | { type: "failed"; errors: DraftErrors | null }
  | { type: "cancel" };

/** "opener" is the button that opened the form; "first" is the form's first field. */
export type FocusTarget = "opener" | "first" | "warning" | DraftField;

export type FormEffect = { type: "save"; wording: RedLineWording } | { type: "focus"; target: FocusTarget } | null;

export type FormTransition = { state: FormState; effect: FormEffect };

export const CLOSED: FormState = { kind: "closed" };

function withChange(draft: RedLineDraft, field: EditableField, value: string): RedLineDraft {
  if (field === "title" || field === "description") return { ...draft, [field]: value };
  return { ...draft, tiers: { ...draft.tiers, [field]: value } };
}

function withoutError(errors: DraftErrors, field: EditableField): DraftErrors {
  const next = { ...errors };
  delete next[field];
  // Typing in any tier answers "describe at least one tier".
  if (field !== "title" && field !== "description") delete next.tiers;
  return next;
}

export function formTransition(state: FormState, event: FormEvent): FormTransition {
  const stay: FormTransition = { state, effect: null };
  switch (state.kind) {
    case "closed":
      if (event.type !== "open") return stay;
      return {
        state: { kind: "open", draft: event.draft, errors: {}, failed: false },
        effect: { type: "focus", target: "first" },
      };
    case "open":
      switch (event.type) {
        case "change":
          return {
            state: {
              ...state,
              draft: withChange(state.draft, event.field, event.value),
              errors: withoutError(state.errors, event.field),
            },
            effect: null,
          };
        case "submit": {
          const checked = validateRedLineDraft(state.draft);
          if (!checked.ok) {
            const first = firstInvalidField(checked.errors);
            return {
              state: { ...state, errors: checked.errors, failed: false },
              effect: first ? { type: "focus", target: first } : null,
            };
          }
          return { state: { kind: "saving", draft: state.draft }, effect: { type: "save", wording: checked.value } };
        }
        case "cancel":
          return { state: CLOSED, effect: { type: "focus", target: "opener" } };
        default:
          return stay;
      }
    case "saving":
      if (event.type === "saved") return { state: CLOSED, effect: { type: "focus", target: "opener" } };
      if (event.type === "failed") {
        const errors = event.errors ?? {};
        const first = firstInvalidField(errors);
        return {
          state: { kind: "open", draft: state.draft, errors, failed: event.errors === null },
          effect: first ? { type: "focus", target: first } : null,
        };
      }
      // Typing, a second submit and cancel all wait for the save to finish.
      return stay;
  }
}

// ---------------------------------------------------------------------------------------------
// Confirm, then act: deleting one red line, or restoring the defaults

export type ConfirmState =
  /** `failed` is true when the last attempt didn't go through. */
  | { kind: "idle"; failed: boolean }
  /** The warning is showing. Nothing has been sent. */
  | { kind: "confirming" }
  | { kind: "working" };

export type ConfirmEvent =
  | { type: "ask" }
  | { type: "confirm" }
  | { type: "cancel" }
  | { type: "done" }
  | { type: "failed" };

export type ConfirmEffect = { type: "run" } | { type: "focus"; target: "warning" | "opener" } | null;

export type ConfirmTransition = { state: ConfirmState; effect: ConfirmEffect };

export const IDLE: ConfirmState = { kind: "idle", failed: false };

export function confirmTransition(state: ConfirmState, event: ConfirmEvent): ConfirmTransition {
  const stay: ConfirmTransition = { state, effect: null };
  switch (state.kind) {
    case "idle":
      // Asking never runs anything: the warning comes first.
      if (event.type === "ask") return { state: { kind: "confirming" }, effect: { type: "focus", target: "warning" } };
      return stay;
    case "confirming":
      if (event.type === "confirm") return { state: { kind: "working" }, effect: { type: "run" } };
      if (event.type === "cancel") return { state: IDLE, effect: { type: "focus", target: "opener" } };
      return stay;
    case "working":
      // Where focus goes after success depends on what was done (the row may be gone), so the
      // caller decides.
      if (event.type === "done") return { state: IDLE, effect: null };
      if (event.type === "failed") return { state: { kind: "idle", failed: true }, effect: { type: "focus", target: "opener" } };
      return stay;
  }
}
