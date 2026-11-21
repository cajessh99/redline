"use client";

// Vercel's cookieless page-view analytics, rendered by the landing page and nowhere else
// (CONTEXT.md D11). It lives in its own client component because `beforeSend` is a function,
// which a server component cannot pass across to a client one.
import { Analytics } from "@vercel/analytics/next";
import { landingPageViewsOnly } from "../lib/analytics.ts";

export default function LandingAnalytics() {
  return <Analytics beforeSend={landingPageViewsOnly} />;
}
