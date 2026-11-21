import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuestionDocument, QuestionRecord, QuestionRow, QuestionStore } from "../analysis/ask.ts";

const COLUMNS = "id, question, party, kind, answer, citation, citation_offset, created_at";

/**
 * A signed-in reader's questions over their own Supabase session, so row-level security keeps
 * every read and write to that reader's documents (supabase/migrations/0007).
 */
export function supabaseQuestionStore(supabase: SupabaseClient): QuestionStore {
  return {
    async loadDocument(documentId: string): Promise<QuestionDocument | null> {
      const { data, error } = await supabase
        .from("documents")
        .select("id, stored_text, party")
        .eq("id", documentId)
        .maybeSingle<{ id: string; stored_text: string; party: string }>();
      if (error) throw new Error(`loading the document failed: ${error.code ?? ""} ${error.message}`);
      if (!data) return null;
      return { id: data.id, storedText: data.stored_text, party: data.party };
    },
    async save(record: QuestionRecord): Promise<QuestionRow> {
      const answered = record.result.kind === "answered" ? record.result : null;
      const { data, error } = await supabase
        .from("questions")
        .insert({
          document_id: record.documentId,
          question: record.question,
          party: record.party,
          kind: record.result.kind,
          answer: answered?.answer ?? null,
          citation: answered?.citation ?? null,
          citation_offset: answered?.offset ?? null,
        })
        .select(COLUMNS)
        .single<QuestionRow>();
      if (error) throw new Error(`saving the question failed: ${error.code ?? ""} ${error.message}`);
      if (!data) throw new Error("saving the question returned no row");
      return data;
    },
    async list(documentId: string): Promise<QuestionRow[]> {
      const { data, error } = await supabase
        .from("questions")
        .select(COLUMNS)
        .eq("document_id", documentId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      if (error) throw new Error(`loading the questions failed: ${error.code ?? ""} ${error.message}`);
      return (data ?? []) as QuestionRow[];
    },
  };
}
