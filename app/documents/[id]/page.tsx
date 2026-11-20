import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { parseCheckedRedLines, parseStoredFlags, parseStoredReceipt } from "../../../lib/analysis/stored.ts";
import { findPartyCandidates } from "../../../lib/intake/parties.ts";
import { createSupabaseServerClient } from "../../../lib/supabase/server.ts";
import { DocumentResult } from "./document-result.tsx";

export const metadata = { title: "Saved result · Redline" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DocumentRow = { id: string; title: string; stored_text: string; party: string };
type AnalysisRow = { flags: unknown; receipt: unknown; red_lines_snapshot: unknown };

/**
 * A stored document and its latest analysis, with "Change my party" (ticket 07), read under the reader's own session, so row-level
 * security decides what is visible. Anything not visible to this reader is a 404.
 */
export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // depends on the request: the session cookie
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/sign-in");
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/sign-in");
  if (!UUID.test(id)) notFound();

  const { data: document } = await supabase
    .from("documents")
    .select("id, title, stored_text, party")
    .eq("id", id)
    .maybeSingle<DocumentRow>();
  if (!document) notFound();

  const { data: analysis } = await supabase
    .from("analyses")
    .select("flags, receipt, red_lines_snapshot")
    .eq("document_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AnalysisRow>();
  if (!analysis) notFound();

  return (
    <>
      <header className="masthead">
        <Link href="/" className="wordmark">
          Redline
        </Link>
        <Link href="/library" className="quiet-link">
          Library
        </Link>
      </header>
      <main className="check">
        <DocumentResult
          documentId={document.id}
          title={document.title}
          storedText={document.stored_text}
          candidates={findPartyCandidates(document.stored_text)}
          party={document.party}
          flags={parseStoredFlags(analysis.flags, document.stored_text)}
          receipt={parseStoredReceipt(analysis.receipt, document.stored_text)}
          checkedRedLines={parseCheckedRedLines(analysis.red_lines_snapshot)}
        />
        <p className="check-again">
          <Link href="/check" className="action">
            Check another contract
          </Link>
        </p>
      </main>
    </>
  );
}
