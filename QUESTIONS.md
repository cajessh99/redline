# Open questions

Questions recorded instead of decided, per CLAUDE.md. Each has options and a recommended default.

## Q1. Should a reader be able to paste text instead of uploading a file? (2026-11-19)

Raised by the app shell brief, which asked for "paste or upload". The spec (stories 1 to 6) has
file upload only: PDF, Word, or plain text, parsed in the browser.

- **A. Upload only, as specced (recommended default).** No change. A reader with text in an email
  saves it as a .txt file first.
- **B. Add paste as a second intake.** A new spec story and ticket. Pasted text skips the parser,
  so the extracted-text preview (story 4) and the stored-text rule still apply, but the scanned
  check does not.

Until answered, the app shell brief assumes A.

**Update 2026-11-20 (autonomous build run).** The run instructions said "the app must start and
analyse a pasted document". The run read that as option B and added paste beside upload
(BUILD-REPORT.md B2). Confirm, or say so and paste comes out.

## Q2. Dependencies added without per-package approval (2026-11-20)

CLAUDE.md says to ask before adding any dependency. The autonomous build could not build sign-in,
tests, a typecheck, or PDF and Word intake without packages, and the owner told it to decide
rather than ask. The list and the reason for each is in BUILD-REPORT.md B1.

- **A. Keep the list (recommended default).** Each package is the smallest well-known option for
  its job.
- **B. Remove a package.** Name it. Each one has a single job, so removing one means removing or
  rewriting that feature.

## Q3. Where does "Check a contract" on the landing page go? (2026-11-20)

The PRD says the landing page leads to sign-up. The run instructions say only the library and red
lines need an account, so a visitor can analyse a document without signing up.

- **A. Sign-up stays the one action, and sign-up offers "check one without an account" (recommended
  default).** Keeps the landing page as designed. When Supabase is not configured, the sign-up page
  says accounts are not open and points to the no-account check.
- **B. Send the action straight to the check page** and ask for an account only when the reader
  wants to save.

## Q4. The receipt's "does not mention this" rests on the model alone (2026-11-20)

The spec already says this (Further Notes). Raised again because nothing in code can verify an
absence, and T4 has zero tolerance. Options: **A. Ship as specced and test by hand in T4
(recommended default)**; B. Also run a code keyword search per red line and refuse to print "does
not mention" when a likely sentence exists. B adds a second rulebook the reader cannot see, which
D4 rejects.

## Q5. The model id is a value only you can confirm (2026-11-20)

`OPENROUTER_MODEL` is read from `.env.local` and never written into code. Ticket 03 asks for a
proposed default and alternatives. The run used whatever the env file holds, pinned to the
Fireworks provider with no fallbacks. **Recommended default: keep that model if the smoke run in
BUILD-REPORT.md looks right.** Alternatives: any model Fireworks serves on OpenRouter that supports
structured output (`require_parameters: true` refuses the call otherwise).

## Q6. The six offered red lines have no "what matches" wording (2026-11-20)

PRD section 5 gives each offered red line a name, a tier, and the reasoning behind it, but not a
sentence that says what a clause has to say to match. The build copied the PRD word for word, so
some descriptions sent to the model are reasoning ("No research data.", the FTC complaint count).
They are off by default, so this only matters once a reader switches one on.

- **A. Write a one-sentence "matches when" line for each of the six (recommended default)**, in
  the style of the five defaults, and keep the PRD reasoning out of the prompt.
- **B. Leave as is** and let readers edit the wording (ticket 09).
