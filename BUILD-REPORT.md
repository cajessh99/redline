# Build report: first version

Started 2026-11-20 while the owner was away. Tickets live in `.scratch/first-version/issues/`;
the brief every implementing agent received is `.scratch/first-version/build-brief.md`.

## Summary

All 14 tickets are built, and none is blocked. The criteria that need Supabase or Vercel have not
been verified, and each ticket file says which ones. At the last commit:

- `npm run typecheck` passes.
- `npm test` passes: 36 files, 473 tests, no key needed.
- `npm run build` passes.
- `npm run smoke` against the real model returned 6 verified flags and 1 receipt line, and answered 3
  questions. Details are under "Real-model smoke run".

Every ticket was built by a subagent from `.scratch/first-version/build-brief.md` plus a
ticket-specific brief. Each was then checked here (typecheck, full suite, build, and a search of
the diff for stubs and TODOs) before its commit. No ticket failed verification or needed a second
attempt. The ticket 08 agent hit a usage limit partway through and was resumed with its work intact.
The code review step was skipped, as instructed.

## Ticket status

| Ticket | Status | Not verified |
|---|---|---|
| 01 Scaffold and sign-in | Done | Live Supabase sign-up, sign-in and sign-out; Vercel deploy |
| 02 Analysis boundary and source verification | Done | — |
| 03 Plain-text upload to verified flags | Done | Storage against live Supabase |
| 04 Receipt | Done | — |
| 05 Counter-offers | Done | Copy button in a real browser |
| 06 PDF and Word intake | Done | pdf.js worker in a real browser |
| 07 Party selection | Done | Stored-document rerun against live Supabase |
| 08 Stored red lines: view and switch | Done | Live Supabase |
| 09 Red-line editing | Done | Live Supabase |
| 10 Library | Done | Live Supabase |
| 11 Question box | Done | Storage against live Supabase |
| 12 Full-text view with highlighting | Done | Scrolling and focus in a real browser |
| 13 Landing page | Done | Vercel deploy |
| 14 Landing page analytics | Done | Page views in the Vercel dashboard |

No screen has been checked visually in a browser. The run instructions ruled out an impeccable
direction round, and the Chrome extension was not connected. Layout at phone width, contrast and
focus were checked by reading the CSS and computing ratios from DESIGN.md's hex values. The
rendered markup was checked in tests. Expect visual fixes on the first look.

## Decisions taken in the owner's absence

Each of these is a point where CLAUDE.md or a ticket says to ask. The owner told this run to decide,
record the reason, and keep going. Each one is also open to reversal; see `QUESTIONS.md`.

### B1. Dependencies were added without per-package approval
CLAUDE.md says to ask before adding any dependency, and tickets 01 and 06 are `needs-info` for that
reason. The owner's instructions for this run require Supabase sign-in, a test suite, a typecheck,
PDF and Word intake, and a smoke script, none of which can be built without packages. So this run
adds the smallest set that does the job, and each one is listed here with its reason. This
conflicts with CLAUDE.md, and the conflict is recorded in `QUESTIONS.md`.

| Package | Kind | Why |
|---|---|---|
| `@supabase/supabase-js` | runtime | The Supabase client the owner told this run to build against. |
| `@supabase/ssr` | runtime | Supabase's Next.js helper. It keeps the session in cookies so server code sees who is signed in and signing out ends the session server-side. |
| `pdfjs-dist` | runtime | Mozilla's PDF text extractor. It runs in the browser, so the file never leaves the machine. |
| `mammoth` | runtime | Extracts raw text from .docx in the browser. |
| `@vercel/analytics` | runtime | Already approved by the owner on 2026-11-19 (ticket 14). |
| `typescript`, `@types/node`, `@types/react`, `@types/react-dom` | dev | The run instructions ask for a typecheck on every ticket. Typed flag shapes also make it harder to show a flag without its source. |
| `vitest` | dev | The test runner. Fast, runs TypeScript directly, and needs no Babel config. |
| `@electric-sql/pglite` | dev | Postgres compiled to WebAssembly. Lets the tests run the real SQL migrations and check row-level security without a Supabase project or Docker, neither of which exists here. |

No schema validator was added. The model's JSON output is checked by hand-written code, which saves
a dependency and keeps the checks visible.

### B2. A pasted document can be analysed (QUESTIONS.md Q1)
The run instructions say "the app must start and analyse a pasted document" with Supabase absent.
That reads as the owner answering Q1 with option B. Paste is a second intake beside upload. Pasted
text goes through the same normalisation and the same extracted-text preview. The scanned check does
not apply because there is no file. Recorded as an inference in `QUESTIONS.md` for confirmation.

### B3. Analysis works without an account and stores nothing in that case
The run instructions say only the library and red lines need an account. Ticket 03 says "a
signed-in reader uploads". This run follows the owner's later instruction. Signed out, or with
Supabase not configured, a reader can analyse a document against the five default red lines held
in code, and nothing is stored. Signed in, the document and the analysis are stored under row-level
security, and the reader's own red lines are used.

### B4. The fixture is a one-sided freelance services agreement
The run instructions ask for "an adhesion contract". PRD section 7 excludes take-it-or-leave-it
consumer documents, so the fixture is a client-drafted, one-sided services agreement for a
freelancer. That is the primary reader's document, and it keeps the take-it-or-leave-it framing.

### B5. TypeScript for new code
The landing page was written in JavaScript. The run instructions ask for a typecheck, so new code is
TypeScript and the existing `.js` files stay as they are.

### B6. The landing page action still leads to sign-up
PRD section 3 item 9 says the landing page leads to sign-up. B3 means a visitor can check a document
without an account. This run kept the landing page as designed, with "Check a contract" going to
sign-up. The sign-up page links to a check page that needs no account. When Supabase is not
configured, the sign-up page says accounts are not open yet and points to that check page.
Recorded as QUESTIONS.md Q3.

### B7. Red line ids
The eleven product red lines have fixed ids (`ip-assignment`, `uncapped-indemnity`, `non-compete`,
`discretionary-payment`, `termination-without-pay`, `auto-renewal`, `arbitration`,
`unilateral-changes`, `late-fees`, `fee-escalators`, `client-liability-cap`). Code, SQL seed,
fixtures and stored snapshots use the same ids. "Restore defaults" then knows which rows are
product items.

### B8. Email and password sign-in, with a confirm route
Ticket 01 asks for sign-in "with an email address" and does not say how. This run uses email and
password, because magic links depend on email delivery that is not set up yet. A `/auth/confirm`
route turns Supabase's confirmation link into a session. Sign-out uses Supabase's global scope, so
it ends every session the reader has.

### B9. Tooling settings
`package.json` has `"type": "module"`. `npm run typecheck` runs `next typegen` before `tsc`,
because `server-only`'s types come from Next's generated declarations. Relative imports inside
`lib/` carry their `.ts` extension, so plain Node can run the smoke script without a build step.

### B10. A flag statement with a banned word is treated like a misquote
Story 29 and D8 say flags never hedge, and PRODUCT.md bans "might" and "may". Prompt wording alone
can't enforce that, so code checks each flag statement for a banned word. A statement that uses one
is regenerated once, the same way a misquote is, and dropped if the word comes back. Counter-offers
are exempt, because they are contract drafting and "may" is ordinary there.

### B11. Normalisation rule
The spec says whitespace is collapsed and line breaks are kept only at paragraph boundaries. This
run reads a paragraph boundary as a blank line. Inside a paragraph, every whitespace run, including
a single line break and a non-breaking space, becomes one space. Paragraphs are joined by one blank
line. Typographic quotes are left alone.

### B12. Receipt edge cases
If every candidate for a red line is dropped, the receipt line for it shows the model's verified
addressing sentence, which can be the same sentence the model tried to flag, shown with no flag.
D7 refuses false alarms and accepts misses, and this follows from that. A stored sentence that no
longer matches the stored text is treated as corrupt data. The red line still shows, with a line
saying Redline isn't showing the saved sentence. It is never shown as "does not mention this",
because that would be a claim nothing supports.

### B13. Regeneration asks for exactly one correction per failed item
The first real-model run showed one regenerated candidate coming back as two flags. Regeneration
now asks for one correction per failed candidate, each keyed to that candidate, and ignores extras.

### B14. Answers follow the same rules as flag statements
PRODUCT.md applies its banned-word list to answers too. An answer that uses a banned word is
regenerated once, like a misquoted citation, and becomes "The document does not say." if the word
comes back. An answer with no citation is shown as "The document does not say." That makes T6's
trust rule work in code, so it doesn't depend on the model following the prompt. Without an
account, questions on `/check` are answered and nothing is stored, the same as analysis (B3).

## Not verified (needs Supabase, Vercel, or a key)

- Sign-up, sign-in, the confirmation email and global sign-out against a real Supabase project.
  Code paths exist and the build passes. Nothing has run against a live project.
- In Supabase, add `<site>/auth/confirm` to the allowed redirect URLs.
- `NEXT_PUBLIC_*` values are baked in at build time, so rebuild or redeploy after setting them.
- No Vercel deploy was made from this run.
- Row-level security is tested against the real migration SQL in PGlite, with a stand-in for
  Supabase's `auth` schema. The real `auth` schema has not been tested. Migrations 0001 to 0007
  have never run in Supabase's SQL editor.
- Seeding red lines at first sign-in (ticket 08) runs on the sign-in, sign-up and confirm paths,
  and none of them has run against a live project.
- Vercel Web Analytics may need switching on in the Vercel project settings before page views show.
- `maxDuration` on the analyse route is 300 seconds. Check that the Vercel plan allows it.
- No screen has been looked at in a browser (see the summary).

What was verified without Supabase: the app starts with both Supabase variables empty. A live
`POST /api/analyse` on the production server with the benign fixture returned 200, with 0 flags, a
5-line receipt, every line addressed and verbatim, and nothing stored. `/library` redirects to
sign-in, and sign-in says accounts aren't open yet. The OpenRouter key does not appear anywhere
under `.next/static`.

## Real-model smoke run

`OPENROUTER_API_KEY` is set, so `npm run smoke` ran against the real model. The model id comes from
`OPENROUTER_MODEL` (`z-ai/glm-5.3-flash`), pinned to Fireworks with no fallbacks and low reasoning
effort. The fixture is the one-sided agreement read as Contractor, which has 7 planted clauses.

| Run | When | Flags shown | Regenerated | Dropped | Missed |
|---|---|---|---|---|---|
| 1 | after ticket 03 | 6 | 1 | 0 | non-compete Minor (employee non-solicit) |
| 2 | after ticket 04 | 7 | 1 | 0 | none |
| 3 | final | 6 | 2 | 0 | non-compete Minor (employee non-solicit) |

- Every flag shown in every run was verbatim at its offset. No unverified sentence ever reached
  the output.
- In the final run, 4 candidates verified on the first pass and 2 were misquoted, regenerated, and
  verified. None was dropped.
- Every shown tier matched the sidecar's expected tier.
- The receipt line for termination quoted the fair termination sentence verbatim in every run.
- One analysis takes about 10 seconds.

The same Minor clause was missed in two of three runs. That is precision over recall working as
D7 intends, but it shows recall varies from run to run (T2 territory).

Questions, final run:
- "How many days does Client have to pay an invoice?" Answered, citing the 75-day sentence
  verbatim.
- "Is this clause normal?" "The document does not say."
- "What happens if a dispute goes to court in Germany?" Answered, citing the venue sentence
  verbatim. The answer also says the agreement "is governed by the laws of that state". That is
  true of the document, but it comes from a different sentence than the one cited. The citation
  verifies, and the answer still claims more than that one sentence holds. Code can't catch this.
  It is recorded as QUESTIONS.md Q9, and T6 and T7 should watch for it.

## Questions left for the owner

All are in `QUESTIONS.md`, each with a recommended default, and the build used that default:
- Q1: paste as well as upload (answered by inference)
- Q2: dependencies
- Q3: where "Check a contract" leads
- Q4: "does not mention" rests on the model alone
- Q5: model id
- Q6: offered red lines have no "matches when" wording
- Q7: scanned-PDF threshold, and OCR'd scans slip through
- Q8: PRD tier wording uses the banned word "may"
- Q9: answers that say more than their one citation

Other points to look at:
- The suite imports `vite` (in `vitest.config.ts`) and PDF intake uses `@napi-rs/canvas`. Neither
  is listed in `package.json`. `vite` arrives with vitest, and `@napi-rs/canvas` is an optional
  dependency of pdfjs-dist that text extraction never calls.
- The app shell brief describes index tabs on the result's full text. Ticket 12 built highlighting
  without them, because adding them would redesign the result view, which no ticket asked for.
- Party candidates are found by pattern, not by the model. A contract that names its parties
  unusually shows no candidates, and the reader types their role.

## First commands to run when you sit down

```
npm install
npm test
npm run build
npm run smoke
npm run dev            # then open http://localhost:3000/check and try a PDF, a .docx and a paste
```

Then, to turn on accounts:
1. Create a Supabase project. Put its URL and anon key in `.env.local` as
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Run `supabase/migrations/0001_readers.sql` through `0007_questions.sql` in order, in the SQL editor.
3. Under Authentication > URL Configuration, add `http://localhost:3000/auth/confirm` (and the
   production URL later) to the allowed redirect URLs.
4. Restart `npm run dev`. `NEXT_PUBLIC_*` values are read at build time, so rebuild for production.
5. Sign up, confirm the email, check `/red-lines` shows 5 on and 6 off, check a contract, and see
   it in `/library`. Then sign up a second account and confirm it sees nothing of the first.
