"use server";

import { RedLineNotFoundError } from "../../lib/red-lines/store.ts";
import { supabaseRedLineStore } from "../../lib/server/red-line-store.ts";
import { createSupabaseServerClient } from "../../lib/supabase/server.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SetEnabledResult = { ok: true; enabled: boolean } | { ok: false };

/**
 * Switches one of the signed-in reader's red lines on or off and returns what was stored. Runs
 * under the reader's own session, so row-level security keeps it to their rows. The browser
 * shows its own message on failure, so no detail is returned.
 */
export async function setRedLineEnabled(rowId: unknown, enabled: unknown): Promise<SetEnabledResult> {
  if (typeof rowId !== "string" || !UUID.test(rowId) || typeof enabled !== "boolean") return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false };
  try {
    const saved = await supabaseRedLineStore(supabase).setEnabled(rowId, enabled);
    return { ok: true, enabled: saved.enabled };
  } catch (saveError) {
    if (!(saveError instanceof RedLineNotFoundError)) {
      console.error(`[red-lines] ${saveError instanceof Error ? saveError.message : String(saveError)}`);
    }
    return { ok: false };
  }
}
