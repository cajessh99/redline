"use client";

import { useEffect, useState } from "react";
import type { StoredRedLine } from "../../lib/red-lines/store.ts";
import {
  addRedLine,
  deleteRedLine,
  restoreDefaultRedLines,
  saveRedLineWording,
  setRedLineEnabled,
  type WordingResult,
} from "./actions.ts";
import { EDIT_COPY } from "./edit-copy.ts";
import {
  CLOSED,
  confirmTransition,
  formTransition,
  IDLE,
  type ConfirmEvent,
  type ConfirmState,
  type FocusTarget,
  type FormEvent,
  type FormState,
} from "./edit-state.ts";
import { fieldId } from "./red-line-form.tsx";
import { rowIds } from "./red-line-list.tsx";
import { PAGE_IDS, RedLinesView } from "./red-lines-view.tsx";
import { initialSwitch, transition, type SwitchEvent, type SwitchState } from "./switch-state.ts";

/** The element id a focus effect points at, for a form with this id base and opener. */
function formFocusId(target: FocusTarget, formBase: string, opener: string): string {
  if (target === "opener") return opener;
  if (target === "first") return fieldId(formBase, "title");
  if (target === "warning") return opener;
  return fieldId(formBase, target);
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

/**
 * The red lines page, live. Each switch, edit, delete, add and restore saves on its own, right
 * away, and focus moves somewhere sensible after each one.
 */
export function RedLinesEditor({ initial }: { initial: StoredRedLine[] }) {
  const [redLines, setRedLines] = useState<StoredRedLine[]>(initial);
  const [switches, setSwitches] = useState<Record<string, SwitchState>>({});
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [deletes, setDeletes] = useState<Record<string, ConfirmState>>({});
  const [addForm, setAddForm] = useState<FormState>(CLOSED);
  const [restore, setRestore] = useState<ConfirmState>(IDLE);
  const [notice, setNotice] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  // Focus moves after React has drawn the element it points at.
  useEffect(() => {
    if (!focusId) return;
    document.getElementById(focusId)?.focus();
    setFocusId(null);
  }, [focusId]);

  const stateOf = (redLine: StoredRedLine) => switches[redLine.rowId] ?? initialSwitch(redLine.enabled);
  const formOf = (redLine: StoredRedLine) => forms[redLine.rowId] ?? CLOSED;
  const deleteOf = (redLine: StoredRedLine) => deletes[redLine.rowId] ?? IDLE;

  async function sendSwitch(redLine: StoredRedLine, event: SwitchEvent) {
    const { rowId } = redLine;
    const { state, effect } = transition(stateOf(redLine), event);
    setSwitches((current) => ({ ...current, [rowId]: state }));
    if (!effect) return;
    let result: Awaited<ReturnType<typeof setRedLineEnabled>>;
    try {
      result = await setRedLineEnabled(rowId, effect.save);
    } catch {
      result = { ok: false };
    }
    if (result.ok) {
      const enabled = result.enabled;
      setRedLines((list) => list.map((r) => (r.rowId === rowId ? { ...r, enabled } : r)));
    }
    const next = transition(state, result.ok ? { type: "saved", enabled: result.enabled } : { type: "failed" }).state;
    setSwitches((current) => ({ ...current, [rowId]: next }));
  }

  async function sendForm(redLine: StoredRedLine, event: FormEvent) {
    const { rowId } = redLine;
    const ids = rowIds(rowId);
    const { state, effect } = formTransition(formOf(redLine), event);
    setForms((current) => ({ ...current, [rowId]: state }));
    if (!effect) return;
    if (effect.type === "focus") {
      setFocusId(formFocusId(effect.target, ids.form, ids.edit));
      return;
    }
    let result: WordingResult;
    try {
      result = await saveRedLineWording(rowId, effect.wording);
    } catch {
      result = { ok: false, errors: null };
    }
    const next = formTransition(state, result.ok ? { type: "saved" } : { type: "failed", errors: result.errors });
    setForms((current) => ({ ...current, [rowId]: next.state }));
    if (result.ok) {
      const saved = result.redLine;
      setRedLines((list) => list.map((r) => (r.rowId === rowId ? saved : r)));
      setNotice(EDIT_COPY.saved(saved.title));
    }
    if (next.effect?.type === "focus") setFocusId(formFocusId(next.effect.target, ids.form, ids.edit));
  }

  async function sendDelete(redLine: StoredRedLine, event: ConfirmEvent) {
    const { rowId } = redLine;
    const ids = rowIds(rowId);
    const { state, effect } = confirmTransition(deleteOf(redLine), event);
    setDeletes((current) => ({ ...current, [rowId]: state }));
    if (!effect) return;
    if (effect.type === "focus") {
      setFocusId(effect.target === "warning" ? ids.deleteWarning : ids.delete);
      return;
    }
    let ok: boolean;
    try {
      ok = (await deleteRedLine(rowId)).ok;
    } catch {
      ok = false;
    }
    const next = confirmTransition(state, ok ? { type: "done" } : { type: "failed" });
    if (ok) {
      // The row is gone, so focus goes to the line that says what happened.
      setRedLines((list) => list.filter((r) => r.rowId !== rowId));
      setDeletes((current) => without(current, rowId));
      setForms((current) => without(current, rowId));
      setSwitches((current) => without(current, rowId));
      setNotice(EDIT_COPY.deleted(redLine.title));
      setFocusId(PAGE_IDS.notice);
      return;
    }
    setDeletes((current) => ({ ...current, [rowId]: next.state }));
    setFocusId(ids.delete);
  }

  async function sendAdd(event: FormEvent) {
    const { state, effect } = formTransition(addForm, event);
    setAddForm(state);
    if (!effect) return;
    if (effect.type === "focus") {
      setFocusId(formFocusId(effect.target, PAGE_IDS.addForm, PAGE_IDS.add));
      return;
    }
    let result: WordingResult;
    try {
      result = await addRedLine(effect.wording);
    } catch {
      result = { ok: false, errors: null };
    }
    const next = formTransition(state, result.ok ? { type: "saved" } : { type: "failed", errors: result.errors });
    setAddForm(next.state);
    if (result.ok) {
      const added = result.redLine;
      setRedLines((list) => [...list, added]);
      setNotice(EDIT_COPY.added(added.title));
      setFocusId(PAGE_IDS.notice);
      return;
    }
    if (next.effect?.type === "focus") setFocusId(formFocusId(next.effect.target, PAGE_IDS.addForm, PAGE_IDS.add));
  }

  async function sendRestore(event: ConfirmEvent) {
    const { state, effect } = confirmTransition(restore, event);
    setRestore(state);
    if (!effect) return;
    if (effect.type === "focus") {
      setFocusId(effect.target === "warning" ? PAGE_IDS.restoreWarning : PAGE_IDS.restore);
      return;
    }
    let result: Awaited<ReturnType<typeof restoreDefaultRedLines>>;
    try {
      result = await restoreDefaultRedLines();
    } catch {
      result = { ok: false };
    }
    const next = confirmTransition(state, result.ok ? { type: "done" } : { type: "failed" });
    setRestore(next.state);
    if (result.ok) {
      // Every product row may have changed, so per-row state starts again from what is stored.
      setRedLines(result.redLines);
      setSwitches({});
      setForms({});
      setDeletes({});
      setNotice(EDIT_COPY.restored);
      setFocusId(PAGE_IDS.notice);
      return;
    }
    setFocusId(PAGE_IDS.restore);
  }

  return (
    <RedLinesView
      redLines={redLines}
      stateOf={stateOf}
      send={(redLine, event) => void sendSwitch(redLine, event)}
      editing={{
        formOf,
        sendForm: (redLine, event) => void sendForm(redLine, event),
        deleteOf,
        sendDelete: (redLine, event) => void sendDelete(redLine, event),
      }}
      addForm={addForm}
      sendAdd={(event) => void sendAdd(event)}
      restore={restore}
      sendRestore={(event) => void sendRestore(event)}
      notice={notice}
    />
  );
}
