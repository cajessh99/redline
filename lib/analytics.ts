// The filter every analytics event passes through before it leaves the browser (CONTEXT.md D11).
// Vercel's analytics component is mounted on the landing page only, but its script stays loaded
// after a client-side navigation away from it. This filter is the second guard: whatever the
// script tries to send, only a page view of `/` goes out, and its URL carries no query string or
// hash, so no document text, title, party, red line or question can ride along. Pure, so it is
// tested directly.

/** The event shape Vercel's analytics hands to `beforeSend` (`@vercel/analytics` BeforeSendEvent). */
export type AnalyticsEvent = { type: "pageview" | "event"; url: string };

/** The only path analytics may report. */
export const LANDING_PATH = "/";

/**
 * Keeps a page view of the landing page, reduced to origin plus `/`. Drops everything else:
 * other paths, custom events, and URLs that do not parse.
 */
export function landingPageViewsOnly<E extends AnalyticsEvent>(event: E): E | null {
  if (event.type !== "pageview") return null;
  let url: URL;
  try {
    url = new URL(event.url);
  } catch {
    return null;
  }
  if (url.pathname !== LANDING_PATH) return null;
  return { ...event, url: `${url.origin}${LANDING_PATH}` };
}
