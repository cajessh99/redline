# Redline

Web app: a user uploads a contract, lease, freelance agreement, or terms of service and gets a
plain English summary of the clauses that could hurt them. No application code exists yet.

## Capabilities (the complete scope)
- Clauses that could hurt the user, ranked by severity, each showing its exact source sentence
- A drafted counter-offer for each flagged clause
- A question box that answers only from the uploaded document
- An editable list of the user's own red lines, which drives the analysis
- A saved library of past documents

## Settled decisions (do not reinterpret)
- Next.js, with Supabase for auth and database, deployed on Vercel.
- The uploaded file is parsed in the browser. Only extracted text is stored, never the file.
- The product calls its model through OpenRouter.
- Every risk flag cites the exact sentence it came from. A flag whose source cannot be shown is a bug.

## Scope
- Build the capabilities above and stop. If something looks like the obvious next step and is
  not listed, ask first.
- Excluded on purpose: payments, billing, OCR for scanned documents, sharing a document between
  users. This version exists to prove the analysis can be trusted. OCR would undermine that,
  because a citation is worthless when the text it points at was misread. Reject scanned
  documents with a clear message instead of attempting to read them.

## Trust rules
- State only what the document says. Where the text does not support a claim, the product
  does not make it. This applies to summaries, counter-offers, and question answers.
- Check each cited sentence against the stored text in code, as an exact match, before showing a
  flag. A flag that fails the check is dropped or regenerated, never shown without its source.
- The question box answers "the document does not say" rather than drawing on outside knowledge.

## Credentials
- Keep credentials in .env.local, which is gitignored. Never commit a secret: a key is public
  the moment it is pushed and has to be rotated.
- Before every commit, check the staged files for keys, tokens, and .env contents.
- Never put a key in client-side code. The OpenRouter key stays server-side only.

## Dependencies
- Ask before adding any dependency, including dev dependencies.

## Working while the user is away
- Do not stop to wait on a question. Write it to QUESTIONS.md with the options and your
  recommended default, then continue with other in-scope work that does not depend on the answer.
- Never resolve a question by widening scope or picking an excluded feature as the default.
- If a requirement here conflicts with what the code or a document needs, follow this file and
  record the conflict in QUESTIONS.md.
- Leave the repo working at every commit. Do not leave half-built features behind a broken build.

## Pointers
- research/summary.md holds the user research. Read it before deciding what the product should do.
- The brief will live in PRD.md once it exists. Read it before building.

## Agent skills
- Issue tracker: local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.
- Triage labels: the five default roles. See `docs/agents/triage-labels.md`.
- Domain docs: single-context (`GLOSSARY.md` and `docs/adr/` at root). See `docs/agents/domain.md`.
