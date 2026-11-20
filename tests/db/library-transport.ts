// The library transport and the document store over PGlite: the same reads, deletes and RPC calls
// the Supabase transports in lib/server make, sent as SQL through row-level security as the
// signed-in reader. Only the Supabase client is replaced; the library code, the migrations, the
// policies, the view and the RPCs run for real.
import type { DocumentStore, RerunRecord, StoredDocument } from "../../lib/analysis/rerun.ts";
import type { AnalysisRow, DocumentRow, LibraryRow, LibraryTransport } from "../../lib/documents/library.ts";
import type { TestDb } from "./harness.ts";

export function pgLibraryTransport(t: TestDb, reader: string): LibraryTransport {
  return {
    async listEntries() {
      const { rows } = await t.asUser<LibraryRow>(
        reader,
        `select id, title, party, created_at, severe_count, moderate_count, minor_count
         from public.library_entries order by created_at desc`,
      );
      return rows;
    },
    async loadDocument(id) {
      const { rows } = await t.asUser<DocumentRow>(
        reader,
        "select id, title, stored_text, party from public.documents where id = $1",
        [id],
      );
      return rows[0] ?? null;
    },
    async loadLatestAnalysis(documentId) {
      const { rows } = await t.asUser<AnalysisRow>(
        reader,
        `select flags, receipt, red_lines_snapshot from public.analyses
         where document_id = $1 order by created_at desc, id desc limit 1`,
        [documentId],
      );
      return rows[0] ?? null;
    },
    async deleteDocument(id) {
      const { rows } = await t.asUser<{ id: string }>(reader, "delete from public.documents where id = $1 returning id", [id]);
      return rows.length > 0;
    },
  };
}

export function pgDocumentStore(t: TestDb, reader: string): DocumentStore {
  return {
    async load(documentId: string): Promise<StoredDocument | null> {
      const { rows } = await t.asUser<{ id: string; title: string; stored_text: string; party: string }>(
        reader,
        "select id, title, stored_text, party from public.documents where id = $1",
        [documentId],
      );
      const row = rows[0];
      return row ? { id: row.id, title: row.title, storedText: row.stored_text, party: row.party } : null;
    },
    async rerun(record: RerunRecord): Promise<void> {
      await t.asUser(reader, "select public.rerun_document_analysis($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)", [
        record.documentId,
        record.party,
        JSON.stringify(record.redLinesSnapshot),
        JSON.stringify(record.flags),
        JSON.stringify(record.receipt),
      ]);
    },
  };
}

/** Saves a document and its first analysis through the real RPC, as `reader`, and returns its id. */
export async function saveDocument(
  t: TestDb,
  reader: string,
  record: { title: string; storedText: string; party: string; snapshot: unknown; flags: unknown; receipt?: unknown },
): Promise<string> {
  const { rows } = await t.asUser<{ id: string }>(
    reader,
    "select public.save_document_analysis($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb) as id",
    [
      record.title,
      record.storedText,
      record.party,
      JSON.stringify(record.snapshot),
      JSON.stringify(record.flags),
      JSON.stringify(record.receipt ?? []),
    ],
  );
  return rows[0].id;
}
