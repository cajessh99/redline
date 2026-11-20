import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { openStoredResult } from "../../../lib/documents/library.ts";
import { findPartyCandidates } from "../../../lib/intake/parties.ts";
import { supabaseLibraryTransport } from "../../../lib/server/library-store.ts";
import { createSupabaseServerClient } from "../../../lib/supabase/server.ts";
import { MastheadLinks, SIGNED_IN_LINKS } from "../../auth/masthead-links.tsx";
import { DocumentResult } from "./document-result.tsx";

export const metadata = { title: "Saved result · Redline" };

/**
 * A stored document and its latest analysis, exactly as stored and with no model call (story 48),
 * with "Change my party", "Check again with my current red lines" and delete. Read under the
 * reader's own session, so row-level security decides what is visible: anything this reader
 * can't see is a 404, never a 403, so another reader's document is not shown to exist.
 */
export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // depends on the request: the session cookie
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/sign-in");
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/sign-in");

  const stored = await openStoredResult(supabaseLibraryTransport(supabase), id);
  if (!stored) notFound();

  return (
    <>
      <header className="masthead">
        <Link href="/" className="wordmark">
          Redline
        </Link>
        <MastheadLinks links={[SIGNED_IN_LINKS.library, SIGNED_IN_LINKS.redLines]} />
      </header>
      <main className="check">
        <DocumentResult
          documentId={stored.id}
          title={stored.title}
          storedText={stored.storedText}
          candidates={findPartyCandidates(stored.storedText)}
          party={stored.party}
          flags={stored.flags}
          receipt={stored.receipt}
          checkedRedLines={stored.checkedRedLines}
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
