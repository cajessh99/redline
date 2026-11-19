# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Settled in CLAUDE.md, not reopened here: Next.js, Supabase for auth and database, deployed on
Vercel. The model is called through OpenRouter, server-side only. No application code exists yet
(2026-11-19).

## Users

**Primary reader:** an occasional freelancer holding a client's contract they have not signed
yet. They sign two or three contracts a year, have no baseline for what is normal, have no
lawyer, and can still say no. Every default, example, and sentence is written for this person.

**Accepted readers**, served by the same analysis but not designed for: an employee with an
offer letter or non-compete, a renter with a lease, a small-business owner with a vendor or
supplier contract. The veteran freelancer is welcome but is not who the words are written for.

**Not served:** consumers holding a gym membership, subscription, or terms of service
(take-it-or-leave-it documents; PRD.md section 7).

What they do today instead: paste the contract into a general chatbot, use a free brand-name
review tool (Rocket Lawyer, LegalZoom), sign unread, or pay a lawyer.

## Product Purpose

Redline reads a contract the reader has not signed yet and shows them the clauses that match
their own red lines, each with the exact sentence it came from. It exists for the moment before
signing, when seeing that sentence still changes something.

Success means a reader can check every claim against their own document and find that it
holds. PRD.md section 4 defines the tests (T1 to T10).

## Positioning

Redline wins on verifiability or not at all. The audience is not the differentiator; the trust
mechanics are. Every flag cites a source sentence that code checks for an exact match against
the stored text. The red lines the reader can see and edit are the whole rulebook. Redline
refuses false alarms rather than hedging, and it never says a document is safe. The free
incumbents and general chatbots do not show their sources.

## Operating Context

- The reader is holding an unsigned contract and decides whether to sign, push back, or walk
  away. They compare quoted sentences against their own copy of the document.
- The reader uses it on a laptop and on a phone. Both are full design targets.
- Flow: upload, then pick your party from the names found in the text (never inferred), then
  flags ranked by severity, or a receipt when little or nothing matches.
- Accepted document types: client contract, vendor or supplier contract, employment offer or
  non-compete, lease.

## Capabilities and Constraints

Capabilities (the complete scope, per CLAUDE.md and PRD.md section 3):
- Flags ranked by severity tier (Severe, Moderate, Minor), each with its exact source sentence.
- A drafted counter-offer for each flag.
- A question box that answers only from the document, otherwise "the document does not say."
- An editable list of red lines: five on by default, six offered and switched off.
- A receipt, one line per red line, when few or no flags match.
- A saved library of past documents, private to each reader.
- A landing page (confirmed by the owner 2026-11-19).

Constraints:
- The file is parsed in the browser; only extracted text is stored.
- Scanned documents are rejected with a message that says why. No OCR.
- Excluded: payments, billing, sharing between users, notice-window reminders, jurisdiction-aware
  statements, "is this normal" answers, numeric risk scores, confidence percentages, a
  "check this yourself" bucket.
- Vocabulary is in GLOSSARY.md (red line, flag, severity tier, receipt, source sentence, party).

## Brand Commitments

- Name: Redline. No logo or other brand assets exist yet.
- Voice: plain, declarative sentences. No hedging ("might", "may"). Never reassuring: no "safe",
  "standard", "clean", "no issues", "unusual". Nothing is said that the document does not say.
  A flag says what the clause does, not how to feel about it.
- All copy the reader sees (landing page, UI labels, error messages, empty states) goes through
  the humanizer skill before it is committed. Copy that reads as model-written is a defect
  (CLAUDE.md, Copy).

## Evidence on Hand

- User research: `research/` (summary.md, pain-voices.md, clause-types.md, existing-tools.md,
  willingness-to-pay.md, competitors-addendum.md). Directional, not validated.
- One first-person near miss from a freelancer (the dev.to IP clause); no freelancer with a
  measured dollar loss.
- No testimonials, customers, users, accuracy figures, or pricing exist. Do not invent them.
  Make no accuracy claims until the PRD section 4 test set has been run (see the DoNotPay FTC
  settlement in research/summary.md).

## Product Principles

1. What Redline shows, the reader can check. A claim without a visible source does not appear.
2. Refuse false alarms and accept misses. A receipt is not reassurance.
3. Uncertainty never shows up in the wording. A flag is stated plainly, or it is not shown.
4. The reader's red lines are the rulebook. Redline flags nothing the reader cannot see a rule for.
5. Written for someone who has never done this before and can still say no.

## Accessibility & Inclusion

WCAG 2.2 AA. Severity tiers are never conveyed by color alone. Quoted source sentences stay
selectable and readable at phone width.
