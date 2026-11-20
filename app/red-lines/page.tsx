import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import type { StoredRedLine } from "../../lib/red-lines/store.ts";
import { supabaseRedLineStore } from "../../lib/server/red-line-store.ts";
import { createSupabaseServerClient } from "../../lib/supabase/server.ts";
import { MastheadLinks, SIGNED_IN_LINKS } from "../auth/masthead-links.tsx";
import { RED_LINES_COPY } from "./red-line-list.tsx";
import { RedLinesEditor } from "./red-lines-editor.tsx";

export const metadata = { title: "Red lines · Redline" };

// Account required. With accounts not configured, the proxy has already sent the visitor to
// sign-in, which says accounts aren't open; the redirects here are the same rule again.
export default async function RedLinesPage() {
  await connection(); // depends on the request: the session cookie
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/sign-in");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/sign-in");

  let redLines: StoredRedLine[] | null = null;
  try {
    // Seeds the eleven product red lines the first time a reader gets here.
    redLines = await supabaseRedLineStore(supabase).listForReader();
  } catch (loadError) {
    console.error(`[red-lines] ${loadError instanceof Error ? loadError.message : String(loadError)}`);
  }

  return (
    <>
      <header className="masthead">
        <Link href="/" className="wordmark">
          Redline
        </Link>
        <MastheadLinks links={[SIGNED_IN_LINKS.library, SIGNED_IN_LINKS.check]} />
      </header>
      <main className="check">
        <div className="check-intro">
          <h1 className="check-title">{RED_LINES_COPY.title}</h1>
          <p className="check-lead">{RED_LINES_COPY.lead}</p>
        </div>
        {redLines ? (
          <RedLinesEditor initial={redLines} />
        ) : (
          <p className="account-error" role="alert">
            {RED_LINES_COPY.loadFailed}
          </p>
        )}
      </main>
    </>
  );
}
