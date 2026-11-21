// The question store over PGlite: the same reads and insert lib/server/question-store.ts makes,
// sent as SQL through row-level security as the signed-in reader. Only the Supabase client is
// replaced; the orchestration, the migration, its checks and its policies run for real.
import type { QuestionDocument, QuestionRecord, QuestionRow, QuestionStore } from "../../lib/analysis/ask.ts";
import type { TestDb } from "./harness.ts";

const COLUMNS = "id, question, party, kind, answer, citation, citation_offset, created_at";

export function pgQuestionStore(t: TestDb, reader: string): QuestionStore {
  return {
    async loadDocument(documentId: string): Promise<QuestionDocument | null> {
      const { rows } = await t.asUser<{ id: string; stored_text: string; party: string }>(
        reader,
        "select id, stored_text, party from public.documents where id = $1",
        [documentId],
      );
      const row = rows[0];
      return row ? { id: row.id, storedText: row.stored_text, party: row.party } : null;
    },
    async save(record: QuestionRecord): Promise<QuestionRow> {
      const answered = record.result.kind === "answered" ? record.result : null;
      const { rows } = await t.asUser<QuestionRow>(
        reader,
        `insert into public.questions (document_id, question, party, kind, answer, citation, citation_offset)
         values ($1, $2, $3, $4, $5, $6, $7) returning ${COLUMNS}`,
        [
          record.documentId,
          record.question,
          record.party,
          record.result.kind,
          answered?.answer ?? null,
          answered?.citation ?? null,
          answered?.offset ?? null,
        ],
      );
      return rows[0];
    },
    async list(documentId: string): Promise<QuestionRow[]> {
      const { rows } = await t.asUser<QuestionRow>(
        reader,
        `select ${COLUMNS} from public.questions where document_id = $1 order by created_at desc, id desc`,
        [documentId],
      );
      return rows;
    },
  };
}
