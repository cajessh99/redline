import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisRecord, AnalysisStore } from "../analysis/run.ts";

/**
 * The Supabase store for a signed-in reader. One RPC writes the document and its analysis
 * together (supabase/migrations/0002), under the reader's own session and row-level security.
 */
export function supabaseAnalysisStore(supabase: SupabaseClient): AnalysisStore {
  return {
    async save(record: AnalysisRecord): Promise<string> {
      const { data, error } = await supabase.rpc("save_document_analysis", {
        p_title: record.title,
        p_stored_text: record.storedText,
        p_party: record.party,
        p_red_lines_snapshot: record.redLinesSnapshot,
        p_flags: record.flags,
        p_receipt: [],
      });
      if (error) throw new Error(`save_document_analysis failed: ${error.code ?? ""} ${error.message}`);
      if (typeof data !== "string") throw new Error("save_document_analysis returned no document id");
      return data;
    },
  };
}
