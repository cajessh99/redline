"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { RedLineNotFoundError, type RedLineStore, type StoredRedLine } from "../../lib/red-lines/store.ts";
import { validateRedLineDraft, type DraftErrors } from "../../lib/red-lines/validation.ts";
import { supabaseRedLineStore } from "../../lib/server/red-line-store.ts";
import { createSupabaseServerClient } from "../../lib/supabase/server.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SetEnabledResult = { ok: true; enabled: boolean } | { ok: false };

/** A save of wording: the red line as stored, or field errors (null when the failure was not the fields). */
export type WordingResult = { ok: true; redLine: StoredRedLine } | { ok: false; errors: DraftErrors | null };

export type DeleteResult = { ok: boolean };

export type RestoreResult = { ok: true; redLines: StoredRedLine[] } | { ok: false };

/**
 * The signed-in reader's store, over their own session, so row-level security keeps every call to
 * their rows. Null when accounts are not configured or nobody is signed in.
 */
async function readerStore(): Promise<RedLineStore | null> {
  const supabase: SupabaseClient | null = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return supabaseRedLineStore(supabase);
}

function logUnexpected(error: unknown): void {
  if (error instanceof RedLineNotFoundError) return;
  console.error(`[red-lines] ${error instanceof Error ? error.message : String(error)}`);
}

/**
 * Switches one of the signed-in reader's red lines on or off and returns what was stored. The
 * browser shows its own message on failure, so no detail is returned.
 */
export async function setRedLineEnabled(rowId: unknown, enabled: unknown): Promise<SetEnabledResult> {
  if (typeof rowId !== "string" || !UUID.test(rowId) || typeof enabled !== "boolean") return { ok: false };
  const store = await readerStore();
  if (!store) return { ok: false };
  try {
    const saved = await store.setEnabled(rowId, enabled);
    return { ok: true, enabled: saved.enabled };
  } catch (saveError) {
    logUnexpected(saveError);
    return { ok: false };
  }
}

/** Rewords one red line. The draft is checked here, whatever the browser already checked. */
export async function saveRedLineWording(rowId: unknown, draft: unknown): Promise<WordingResult> {
  if (typeof rowId !== "string" || !UUID.test(rowId)) return { ok: false, errors: null };
  const checked = validateRedLineDraft(draft);
  if (!checked.ok) return { ok: false, errors: checked.errors };
  const store = await readerStore();
  if (!store) return { ok: false, errors: null };
  try {
    return { ok: true, redLine: await store.updateWording(rowId, checked.value) };
  } catch (saveError) {
    logUnexpected(saveError);
    return { ok: false, errors: null };
  }
}

/** Adds a red line the reader wrote: switched on, at the end of their list. */
export async function addRedLine(draft: unknown): Promise<WordingResult> {
  const checked = validateRedLineDraft(draft);
  if (!checked.ok) return { ok: false, errors: checked.errors };
  const store = await readerStore();
  if (!store) return { ok: false, errors: null };
  try {
    return { ok: true, redLine: await store.addOwn(checked.value) };
  } catch (saveError) {
    logUnexpected(saveError);
    return { ok: false, errors: null };
  }
}

/** Deletes one red line. */
export async function deleteRedLine(rowId: unknown): Promise<DeleteResult> {
  if (typeof rowId !== "string" || !UUID.test(rowId)) return { ok: false };
  const store = await readerStore();
  if (!store) return { ok: false };
  try {
    await store.remove(rowId);
    return { ok: true };
  } catch (deleteError) {
    logUnexpected(deleteError);
    return { ok: false };
  }
}

/** Restores the eleven product red lines and returns the whole list afterwards. */
export async function restoreDefaultRedLines(): Promise<RestoreResult> {
  const store = await readerStore();
  if (!store) return { ok: false };
  try {
    return { ok: true, redLines: await store.restoreDefaults() };
  } catch (restoreError) {
    logUnexpected(restoreError);
    return { ok: false };
  }
}
