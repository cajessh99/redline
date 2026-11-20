// The library as a reader sees it (ticket 10, stories 47 and 68): the upload action at the top,
// then the reader's documents newest first as ruled rows, or an empty state that prompts a first
// upload. Presentational, so it renders in tests.
//
// No tier ink here (Ink Is Earned, DESIGN.md): a count is a number and its tier word.

import Link from "next/link";
import type { LibraryEntry, TierCounts } from "../../lib/documents/library.ts";
import { LocalDate } from "./local-date.tsx";

export const LIBRARY_COPY = {
  title: "Your library",
  lead: "Redline keeps every contract you check while signed in, along with its result.",
  upload: "Check a contract",
  listLabel: "Your contracts",
  checkedAs: (party: string) => `Checked as ${party}`,
  noFlags: "No flags",
  emptyTitle: "No contracts yet",
  emptyBody: "Check a contract and Redline keeps it here with its flags, so you can come back to it before you sign.",
  emptyAction: "Check your first contract",
  deleted: "Deleted the contract and its results.",
  loadFailed: "Redline couldn't load your library. Try again in a minute.",
  signedInAs: "Signed in as",
  signOut: "Sign out everywhere",
} as const;

const TIER_ORDER = ["Severe", "Moderate", "Minor"] as const;

/** "2 Severe · 1 Moderate · 0 Minor", or "No flags" when the latest result has none. */
export function countsLine(counts: TierCounts): string {
  if (TIER_ORDER.every((tier) => counts[tier] === 0)) return LIBRARY_COPY.noFlags;
  return TIER_ORDER.map((tier) => `${counts[tier]} ${tier}`).join(" · ");
}

type Props = {
  /** Null when the library could not be loaded. */
  entries: readonly LibraryEntry[] | null;
  /** A status line to read out, such as after a delete. */
  notice: string | null;
  /** The locale used to format dates before the browser formats them in its own. */
  locale: string;
};

const TITLE_ID = "library-title";

export function LibraryView({ entries, notice, locale }: Props) {
  return (
    <>
      <div className="check-intro library-intro">
        <h1 className="check-title" id={TITLE_ID}>
          {LIBRARY_COPY.title}
        </h1>
        <p className="check-lead">{LIBRARY_COPY.lead}</p>
        <p className="library-upload">
          <Link href="/check" className="action">
            {LIBRARY_COPY.upload}
          </Link>
        </p>
      </div>

      <p className="library-notice" role="status">
        {notice ?? ""}
      </p>

      {entries === null ? (
        <p className="account-error" role="alert">
          {LIBRARY_COPY.loadFailed}
        </p>
      ) : entries.length === 0 ? (
        <section className="check-sheet library-empty" aria-labelledby="library-empty-title">
          <h2 id="library-empty-title">{LIBRARY_COPY.emptyTitle}</h2>
          <p>{LIBRARY_COPY.emptyBody}</p>
          <Link href="/check" className="action action-secondary">
            {LIBRARY_COPY.emptyAction}
          </Link>
        </section>
      ) : (
        <ul className="check-sheet library-list" aria-label={LIBRARY_COPY.listLabel}>
          {entries.map((entry) => (
            <li key={entry.id} className="library-entry">
              <h2 className="library-entry-title">
                <Link href={`/documents/${entry.id}`}>{entry.title}</Link>
              </h2>
              <p className="library-entry-meta">
                <LocalDate iso={entry.createdAt} fallbackLocale={locale} />
                <span aria-hidden="true"> · </span>
                <span className="visually-hidden">, </span>
                {LIBRARY_COPY.checkedAs(entry.party)}
              </p>
              <p className="library-entry-counts">{countsLine(entry.counts)}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
