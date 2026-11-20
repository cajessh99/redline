import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RedLine } from "../red-lines/defaults.ts";
import {
  enabledRedLines,
  redLineStore,
  type RedLineRow,
  type RedLineStore,
  type RedLineTransport,
  type SeedRow,
} from "../red-lines/store.ts";

const COLUMNS = "id, product_id, kind, title, description, tiers, enabled, position";

/**
 * The red lines table and seed RPC (supabase/migrations/0004) over the signed-in reader's own
 * session, so row-level security keeps every call to that reader's rows.
 */
export function supabaseRedLineTransport(supabase: SupabaseClient): RedLineTransport {
  return {
    async seed(rows: SeedRow[]): Promise<number> {
      const { data, error } = await supabase.rpc("seed_red_lines", { p_rows: rows });
      if (error) throw new Error(`seed_red_lines failed: ${error.code ?? ""} ${error.message}`);
      return typeof data === "number" ? data : 0;
    },
    async selectRows(): Promise<RedLineRow[]> {
      const { data, error } = await supabase
        .from("red_lines")
        .select(COLUMNS)
        .order("position", { ascending: true });
      if (error) throw new Error(`loading red lines failed: ${error.code ?? ""} ${error.message}`);
      return (data ?? []) as unknown as RedLineRow[];
    },
    async updateEnabled(rowId: string, enabled: boolean): Promise<RedLineRow | null> {
      const { data, error } = await supabase
        .from("red_lines")
        .update({ enabled })
        .eq("id", rowId)
        .select(COLUMNS)
        .maybeSingle<RedLineRow>();
      if (error) throw new Error(`switching a red line failed: ${error.code ?? ""} ${error.message}`);
      return data ?? null;
    },
  };
}

export function supabaseRedLineStore(supabase: SupabaseClient): RedLineStore {
  return redLineStore(supabaseRedLineTransport(supabase));
}

/**
 * The red lines a signed-in reader's analysis uses: their enabled ones, seeding the list first if
 * this is their first use.
 */
export async function readerEnabledRedLines(supabase: SupabaseClient): Promise<RedLine[]> {
  return enabledRedLines(await supabaseRedLineStore(supabase).listForReader());
}

/**
 * Seeds a reader's list right after they sign in, so it exists from their first session. Failure
 * is logged and otherwise ignored: the list is seeded on first use anyway, and sign-in must not
 * fail because of it.
 */
export async function seedRedLinesAfterSignIn(supabase: SupabaseClient): Promise<void> {
  try {
    await supabaseRedLineStore(supabase).listForReader();
  } catch (error) {
    console.error(`[red-lines] seeding after sign-in failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
