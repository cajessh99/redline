import Link from "next/link";

export type MastheadLink = { href: string; label: string };

/** The plain links at the right of the masthead (app shell brief: navigation stays plain). */
export function MastheadLinks({ links }: { links: readonly MastheadLink[] }) {
  if (links.length === 0) return null;
  if (links.length === 1) {
    return (
      <Link href={links[0].href} className="quiet-link">
        {links[0].label}
      </Link>
    );
  }
  return (
    <nav aria-label="Your account" className="masthead-nav">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="quiet-link">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

/** Where a signed-in reader can go from any signed-in page. Each page leaves out itself. */
export const SIGNED_IN_LINKS = {
  library: { href: "/library", label: "Library" },
  redLines: { href: "/red-lines", label: "Red lines" },
  check: { href: "/check", label: "Check a contract" },
} as const;
