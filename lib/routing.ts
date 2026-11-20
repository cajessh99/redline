// Where a page request goes, decided from its path and whether the reader is signed in. Pure, so
// the proxy and the tests run the same decision.

/** Paths that need a signed-in reader. Everything else is open. */
export function requiresAccount(pathname: string): boolean {
  return (
    pathname === "/library" ||
    pathname.startsWith("/library/") ||
    pathname === "/red-lines" ||
    pathname.startsWith("/red-lines/") ||
    pathname.startsWith("/documents/")
  );
}

/** Where a signed-in reader lands instead of the landing page. Ticket 10 builds the library here. */
export const SIGNED_IN_HOME = "/library";

export type RouteDecision = { kind: "continue" } | { kind: "redirect"; to: string };

/**
 * The landing page is for visitors: a signed-in reader at the root goes to their library. Account
 * pages are for signed-in readers: a visitor goes to sign-in. Everything else is served as asked.
 */
export function routeRequest(pathname: string, signedIn: boolean): RouteDecision {
  if (pathname === "/" && signedIn) return { kind: "redirect", to: SIGNED_IN_HOME };
  if (requiresAccount(pathname) && !signedIn) return { kind: "redirect", to: "/sign-in" };
  return { kind: "continue" };
}
