import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  aside?: { href: string; label: string };
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
        {aside ? (
          <Link href={aside.href} className="quiet-link">
            {aside.label}
          </Link>
        ) : null}
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
