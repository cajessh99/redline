import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentStore, RerunRecord, StoredDocument } from "../analysis/rerun.ts";
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
        p_receipt: record.receipt,
      });
      if (error) throw new Error(`save_document_analysis failed: ${error.code ?? ""} ${error.message}`);
      if (typeof data !== "string") throw new Error("save_document_analysis returned no document id");
      return data;
    },
  };
}

/**
 * A signed-in reader's stored documents, read and rerun under their own session. Row-level
 * security hides other readers' documents, so load() returns null for them; the rerun RPC
 * (supabase/migrations/0003) writes the new party and analysis together.
 */
export function supabaseDocumentStore(supabase: SupabaseClient): DocumentStore {
  return {
    async load(documentId: string): Promise<StoredDocument | null> {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, stored_text, party")
        .eq("id", documentId)
        .maybeSingle<{ id: string; title: string; stored_text: string; party: string }>();
      if (error) throw new Error(`loading the document failed: ${error.code ?? ""} ${error.message}`);
      if (!data) return null;
      return { id: data.id, title: data.title, storedText: data.stored_text, party: data.party };
    },
    async rerun(record: RerunRecord): Promise<void> {
      const { error } = await supabase.rpc("rerun_document_analysis", {
        p_document: record.documentId,
        p_party: record.party,
        p_red_lines_snapshot: record.redLinesSnapshot,
        p_flags: record.flags,
        p_receipt: record.receipt,
      });
      if (error) throw new Error(`rerun_document_analysis failed: ${error.code ?? ""} ${error.message}`);
    },
  };
}
