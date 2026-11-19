# 13: Landing page

**What to build:** A signed-out visitor arriving at Redline sees a page that tells the primary reader (an occasional freelancer holding a contract they have not signed) what Redline does and leads them to sign up or sign in. It names the accepted document types, explains that every flag shows the exact sentence it came from, and says what Redline does not take (scanned documents, terms of service). A signed-in reader goes straight to the app. The page claims only what PRODUCT.md and the PRD support (landing page confirmed by the owner 2026-11-19; PRODUCT.md, Positioning and Brand Commitments).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A signed-out visitor at the root URL sees the landing page, with a sign-up action and a sign-in action that both work
- [ ] A signed-in reader at the root URL goes to the app, not the landing page
- [ ] The page names the four accepted document types and says that terms of service and scanned documents are not accepted
- [ ] The page states that every flag shows the exact sentence it came from, and makes no other claim the product cannot back
- [ ] No testimonials, customer or user counts, accuracy figures, or pricing appear (none exist; PRODUCT.md, Evidence on Hand)
- [ ] The words "safe", "standard", "clean", "no issues", "might" and "may" do not appear in the copy
- [ ] Every line of copy has been run through the humanizer skill before commit (CLAUDE.md, Copy)
- [ ] The page works at phone width and on a laptop, with no horizontal scroll, and meets WCAG 2.2 AA
- [ ] The build is green and the page deploys to Vercel
