import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisRow, DocumentRow, LibraryRow, LibraryTransport } from "../documents/library.ts";

/**
 * The library over the signed-in reader's own Supabase session, so row-level security keeps every
 * call to that reader's documents (supabase/migrations/0002 and 0006).
 */
export function supabaseLibraryTransport(supabase: SupabaseClient): LibraryTransport {
  return {
    async listEntries(): Promise<LibraryRow[]> {
      const { data, error } = await supabase
        .from("library_entries")
        .select("id, title, party, created_at, severe_count, moderate_count, minor_count")
        .order("created_at", { ascending: false });
      if (error) throw new Error(`loading the library failed: ${error.code ?? ""} ${error.message}`);
      return (data ?? []) as LibraryRow[];
    },
    async loadDocument(id: string): Promise<DocumentRow | null> {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, stored_text, party")
        .eq("id", id)
        .maybeSingle<DocumentRow>();
      if (error) throw new Error(`loading the document failed: ${error.code ?? ""} ${error.message}`);
      return data ?? null;
    },
    async loadLatestAnalysis(documentId: string): Promise<AnalysisRow | null> {
      const { data, error } = await supabase
        .from("analyses")
        .select("flags, receipt, red_lines_snapshot")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle<AnalysisRow>();
      if (error) throw new Error(`loading the analysis failed: ${error.code ?? ""} ${error.message}`);
      return data ?? null;
    },
    async deleteDocument(id: string): Promise<boolean> {
      const { data, error } = await supabase.from("documents").delete().eq("id", id).select("id");
      if (error) throw new Error(`deleting the document failed: ${error.code ?? ""} ${error.message}`);
      return (data ?? []).length > 0;
    },
  };
}
