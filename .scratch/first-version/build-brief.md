# Build brief shared by every implementing agent

Read this whole file before you start. It travels with each ticket brief. You are a fresh agent with
no memory of earlier work; everything you need is in the repository.

## Read first
- `CLAUDE.md` (constraints), `PRD.md`, `.scratch/first-version/spec.md`, `GLOSSARY.md`,
  `docs/adr/0001-every-flag-cites-its-source.md`, and your ticket file.
- For anything a reader sees: `DESIGN.md`, `PRODUCT.md` (banned words are in Brand Commitments),
  and the app shell brief `.impeccable/surfaces/app-app-layout-js.md`. The landing page brief is
  `.impeccable/surfaces/app-page-js.md`.
- `BUILD-REPORT.md` at the root records decisions already taken in the owner's absence. Follow them.

## The owner's answers (do not ask again)
1. **Model.** The model is whatever `OPENROUTER_MODEL` says, called through OpenRouter's
   OpenAI-compatible endpoint (`https://openrouter.ai/api/v1/chat/completions`) with
   `OPENROUTER_API_KEY`. Pin the provider: `provider: { order: ["fireworks"], allow_fallbacks: false,
   require_parameters: true }`. Set reasoning effort to low (`reasoning: { effort: "low" }`).
   Request structured JSON output (`response_format: { type: "json_schema", json_schema: {...,
   strict: true } }`) for every analysis and answer call. Never write a model id into code. Both
   variables are read only in server code; never prefix them with `NEXT_PUBLIC_`.
2. **Supabase.** No Supabase project exists yet. Build sign-in, the library and red lines against
   the Supabase client, reading its URL and anon key from `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Write every table and policy as SQL migration files under
   `supabase/migrations/` (the owner runs them by hand). The app must start and analyse a pasted
   document with those two variables absent; only the library and red lines need an account.
   Do not mock auth in the product. When the variables are absent, account features say plainly
   that accounts are not available, and never pretend to sign anyone in.

## Routes decided for this build (BUILD-REPORT.md B2, B3, B6)
- `/` landing page for visitors; a signed-in reader is redirected to `/library` (a placeholder
  signed-in page until ticket 10 builds the library).
- `/check` is the analysis flow: upload a file OR paste text, preview the normalised text, pick a
  party, analyse, see the result. It works with no account and with Supabase unconfigured; then
  it uses the five default red lines held in code and stores nothing, and says so in one plain line.
  Signed in, it stores the document and analysis and uses the reader's own red lines (ticket 08+).
- `/sign-up`, `/sign-in`: real Supabase email auth. The landing page's "Check a contract" stays
  pointed at `/sign-up`; sign-up offers a link to `/check` without an account. With Supabase
  unconfigured, both pages say accounts are not open yet and link to `/check`.
- `/red-lines`, `/library`, `/documents/[id]` require an account.

## Rules on what counts as done
None of the following counts as done; a ticket containing one is still open:
- a function that returns a fixed value in place of real behaviour;
- a TODO, a "not implemented" error, or a placeholder screen standing in for the feature;
- a test that checks only that a file exists or a function is defined;
- a test that mocks the thing it is meant to test. The model client may be faked (it is the
  external boundary); the verification, ordering, receipt, and parsing logic must run for real.
Write tests that call real code with real inputs and assert on real outputs.

## Red line ids (use these everywhere: code, fixtures, SQL seed, tests)
Default on: `ip-assignment`, `uncapped-indemnity`, `non-compete`, `discretionary-payment`,
`termination-without-pay`. Offered, off: `auto-renewal`, `arbitration`, `unilateral-changes`,
`late-fees`, `fee-escalators`, `client-liability-cap`. Wording is PRD.md section 5, word for word.
Tiers are exactly `Severe`, `Moderate`, `Minor`.

## Fixtures
- `tests/fixtures/one-sided-services-agreement.txt` with sidecar
  `tests/fixtures/one-sided-services-agreement.flags.json` (planted clauses: exact sentence,
  red line id, expected tier, party it hurts).
- `tests/fixtures/benign-services-agreement.txt` (no planted clause).
- In tests the model client is a fake that builds its payloads from the sidecar, so the suite
  runs without a key. Every test that needs a document uses these (plus any ticket-specific
  excerpts the ticket asks for).

## Screens
- Every screen obeys `DESIGN.md`, `PRODUCT.md` and the app shell brief. Reuse the tokens and
  classes in `app/globals.css`; do not invent a second visual language.
- Do NOT start an impeccable direction round or anything that opens a browser page and waits for a
  person. You may use the impeccable skill's non-interactive guidance only.
- All copy a reader sees (labels, messages, empty states, errors) goes through the humanizer skill
  (`Skill` tool, skill `humanizer:humanizer`) before you finish, and uses no banned word from
  PRODUCT.md. The fixed result-page statement is the only exception.
- WCAG 2.2 AA. Severity is always a word, never colour alone. Works at phone width.

## Engineering conventions (set by ticket 01; follow them)
- New code is TypeScript (`.ts`/`.tsx`). Existing landing-page `.js` files may stay JS.
- Server-only modules start with `import "server-only"` where they touch secrets, or live under
  `lib/server/`. The OpenRouter key must never reach a client bundle.
- Commands: `npm run typecheck`, `npm test` (vitest, runs once, no watch), `npm run build`,
  `npm run smoke`.
- Do not add any dependency beyond those recorded in `BUILD-REPORT.md`. If you believe you need
  one, do not install it: finish what you can and say so in your final report.
- Do not commit. The orchestrator verifies and commits. Never touch `.env.local` or print its values.
- Leave the build and the full test suite passing.

## Your final report (keep it short)
Files added or changed (paths only), test names added, the exact commands you ran with pass/fail,
any acceptance criterion you could not meet and why, any decision you took that the owner should
know about, and every line of reader-facing copy you added.
