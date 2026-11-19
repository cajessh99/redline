# 13: Landing page

**What to build:** A visitor arriving at Redline sees a landing page that tells the primary reader (an occasional freelancer holding a contract they have not signed) what Redline does and leads them to sign up or sign in. It names the accepted document types, says that every flag shows the exact sentence it came from, says what Redline does not take (scanned documents, terms of service), and says that Redline is not legal advice. A signed-in reader skips it. Until the library exists they land on a placeholder; ticket 10 switches them to the library. Analytics are ticket 14 (PRD section 3 item 9, spec stories 64–69, CONTEXT.md D11).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A visitor at the root URL sees the landing page, with sign-up and sign-in actions that both work
- [ ] A signed-in reader at the root URL is sent to a placeholder signed-in page, never the landing page
- [ ] The page names the four accepted document types and says that terms of service and scanned documents are not accepted
- [ ] The page says that every flag shows the exact sentence it came from, and makes no other claim the product cannot back
- [ ] The page says Redline is not legal advice and makes no claim about the law where the reader lives
- [ ] No testimonials, customer or user counts, accuracy figures, or pricing appear (none exist; PRODUCT.md, Evidence on Hand)
- [ ] The copy uses no word on the banned-word list in PRODUCT.md (Brand Commitments)
- [ ] Every line of copy has been run through the humanizer skill before commit (CLAUDE.md, Copy)
- [ ] No analytics, tracking, or cookies are added in this ticket
- [ ] The page works at phone width and on a laptop, with no horizontal scroll, and meets WCAG 2.2 AA
- [ ] Tested: a visitor's request gets the landing page; a signed-in request gets the placeholder; the rendered copy contains no banned word
- [ ] The build is green and the page deploys to Vercel
