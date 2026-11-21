# 14: Landing page analytics

**What to build:** The owner can see how many people visit the landing page, counted with Vercel's built-in, cookieless page-view analytics. Nothing is measured anywhere else in the product, and a visitor is never asked to accept cookies (PRD section 3 item 9, CONTEXT.md D11).

**Blocked by:** 13. The owner approved Vercel's analytics package for Next.js (`@vercel/analytics`) on 2026-11-19, so it can be installed without asking again. Any other package still needs approval.

**Status:** done (2026-11-20; dashboard and deploy not verified)

- [x] Vercel's analytics package for Next.js is the only dependency added
- [ ] Page views are recorded for the landing page and appear in the Vercel dashboard after a deploy (component in place; no deploy in this run)
- [x] No analytics run on any signed-in page, and no document text, title, party, or red line is ever sent to analytics
- [x] No cookie is set and no cookie banner appears
- [ ] The build is green and the change deploys to Vercel (build green locally; no deploy in this run)
