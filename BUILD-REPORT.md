# Build report: first version

Started 2026-11-20 while the owner was away. Tickets live in `.scratch/first-version/issues/`;
the brief every implementing agent received is `.scratch/first-version/build-brief.md`.

## Ticket status

(Filled in as each ticket is verified and committed.)

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

## Not verified (needs Supabase, Vercel, or a key)

- Sign-up, sign-in, the confirmation email and global sign-out against a real Supabase project.
  Code paths exist and the build passes. Nothing has run against a live project.
- In Supabase, add `<site>/auth/confirm` to the allowed redirect URLs.
- `NEXT_PUBLIC_*` values are baked in at build time, so rebuild or redeploy after setting them.
- No Vercel deploy was made from this run.
- Row-level security is tested against the real migration SQL in PGlite, with a stand-in for
  Supabase's `auth` schema. The real `auth` schema has not been tested.

## Real-model smoke run

(Filled in at the end.)

## First commands to run when you sit down

(Filled in at the end.)
