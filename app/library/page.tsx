import { connection } from "next/server";
import { redirect } from "next/navigation";
import { currentReader } from "../../lib/supabase/server.ts";
import { signOut } from "../auth/actions.ts";
import { AccountPage } from "../auth/account-page.tsx";

export const metadata = { title: "Library · Redline" };

// The signed-in placeholder that ticket 13 allows. Ticket 10 replaces it with the library.
export default async function LibraryPage() {
  await connection(); // depends on the request: the session cookie
  const reader = await currentReader();
  if (!reader) redirect("/sign-in");

  return (
    <AccountPage>
      <h1 className="account-title">Library</h1>
      <p className="account-lead">
        Signed in as <strong>{reader.email}</strong>
      </p>
      <form action={signOut}>
        <button type="submit" className="action">
          Sign out everywhere
        </button>
      </form>
    </AccountPage>
  );
}
