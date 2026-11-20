import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { listLibrary, type LibraryEntry } from "../../lib/documents/library.ts";
import { supabaseLibraryTransport } from "../../lib/server/library-store.ts";
import { createSupabaseServerClient } from "../../lib/supabase/server.ts";
import { signOut } from "../auth/actions.ts";
import { MastheadLinks, SIGNED_IN_LINKS } from "../auth/masthead-links.tsx";
import Link from "next/link";
import { LIBRARY_COPY, LibraryView } from "./library-view.tsx";

export const metadata = { title: "Library · Redline" };

/** The first language tag the request prefers, for dates before the browser takes over. */
function preferredLocale(acceptLanguage: string | null): string {
  const first = acceptLanguage?.split(",")[0]?.split(";")[0]?.trim();
  return first && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(first) ? first : "en";
}

// The signed-in home (story 68): a signed-in reader at the root URL is sent here (lib/routing.ts).
// Account required; the proxy sends a visitor to sign-in, and the redirects here are the same rule.
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection(); // depends on the request: the session cookie
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/sign-in");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/sign-in");

  let entries: LibraryEntry[] | null = null;
  try {
    entries = await listLibrary(supabaseLibraryTransport(supabase));
  } catch (loadError) {
    console.error(`[library] ${loadError instanceof Error ? loadError.message : String(loadError)}`);
  }

  const params = await searchParams;
  const notice = params.deleted === "1" ? LIBRARY_COPY.deleted : null;
  const locale = preferredLocale((await headers()).get("accept-language"));

  return (
    <>
      <header className="masthead">
        <Link href="/" className="wordmark">
          Redline
        </Link>
        <MastheadLinks links={[SIGNED_IN_LINKS.redLines]} />
      </header>
      <main className="check">
        <LibraryView entries={entries} notice={notice} locale={locale} />
        <form action={signOut} className="library-account">
          <p>
            {LIBRARY_COPY.signedInAs} <strong>{data.user.email}</strong>
          </p>
          <button type="submit" className="quiet-button">
            {LIBRARY_COPY.signOut}
          </button>
        </form>
      </main>
    </>
  );
}
