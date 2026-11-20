import Link from "next/link";
import { connection } from "next/server";
import { supabaseConfig } from "../../lib/env.ts";
import { currentReader } from "../../lib/supabase/server.ts";
import { CheckFlow } from "./check-flow.tsx";

export const metadata = { title: "Check a contract · Redline" };

// Open to everyone. Signed in, the result is stored; signed out, it is not (BUILD-REPORT.md B3).
export default async function CheckPage() {
  await connection(); // depends on the request: the session cookie
  const reader = await currentReader();

  return (
    <>
      <header className="masthead">
        <Link href="/" className="wordmark">
          Redline
        </Link>
        {reader ? (
          <Link href="/library" className="quiet-link">
            Library
          </Link>
        ) : (
          <Link href="/sign-in" className="quiet-link">
            Sign in
          </Link>
        )}
      </header>
      <main className="check">
        <CheckFlow accountsOpen={supabaseConfig() !== null} />
      </main>
    </>
  );
}
