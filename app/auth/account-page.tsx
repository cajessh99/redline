import Link from "next/link";
import type { ReactNode } from "react";
import { MastheadLinks, type MastheadLink } from "./masthead-links.tsx";

type Props = {
  aside?: MastheadLink | readonly MastheadLink[];
  children: ReactNode;
};

/** The frame for the account screens: the masthead, then one sheet of paper on the desk. */
export function AccountPage({ aside, children }: Props) {
  return (
    <>
      <header className="masthead">
        <Link href="/" className="wordmark">
          Redline
        </Link>
        {aside ? <MastheadLinks links={Array.isArray(aside) ? aside : [aside as MastheadLink]} /> : null}
      </header>
      <main className="account">
        <div className="account-sheet">{children}</div>
      </main>
    </>
  );
}

/** Shown on sign-in and sign-up while Supabase is not configured. */
export function AccountsClosed() {
  return (
    <AccountPage>
      <h1 className="account-title">Accounts aren&apos;t open yet</h1>
      <p className="account-lead">
        You can still check a contract without one. Redline won&apos;t keep the document or the
        result.
      </p>
      <Link href="/check" className="action">
        Check a contract
      </Link>
    </AccountPage>
  );
}
