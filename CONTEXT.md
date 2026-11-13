# Redline brief: decisions in progress

Started 2026-11-13 during a grilling session for the PRD. Each decision below was made by the
product owner, not inferred. Vocabulary lives in `GLOSSARY.md`. Hard-to-reverse decisions with
real alternatives get an ADR under `docs/adr/`.

Sources read before the session: `research/summary.md`, `research/clause-types.md`,
`CLAUDE.md`, `docs/adr/0001-every-flag-cites-its-source.md`.

The brief written from these decisions is `PRD.md` (2026-11-13). Where the two disagree, the
PRD is the one to fix, and this file records why the decision was made.

## Decisions

### D1. The primary reader is an occasional freelancer holding a client's contract they have not signed yet (2026-11-13, tightened same day)
Chosen over renters holding a lease, who have the only first-person dollar loss and the only
regulator complaint data in the research. Reason: a drafted counter-offer and an editable list
of red lines presuppose a reader who can push back before signing. A renter facing a standard
lease mostly cannot, so two of the five settled capabilities would be decoration for them.
Given up: the segment with proven loss. The brief states this openly rather than claiming the
evidence supports the choice.

Tightened later the same day after a competitor check (see `research/competitors-addendum.md`).
The first wording included small-business owners. Removed because the small-business owner on the
paying side, uploading a vendor or supplier contract, is already served free by Rocket Lawyer's
Rocket Copilot Contract Review and LegalZoom's Doc Assist, and the research found no pain
evidence for that slice. Small-business owners now sit in the same tier as employees and renters:
accepted, not designed for.
Consequence for the brief: the differentiator is not the audience. It is the trust mechanics
(D4, D7, D8, D9 and ADR-0001). The brief names Rocket Copilot Contract Review and the general
chatbot as the free incumbents and states that Redline wins on verifiability or not at all.
Given up: the word "business" in the pitch and the easier-to-reach buyer.

### D2. Redline does not serve consumers holding a membership, subscription, or terms of service (2026-11-13)
Named in the brief as the segment not served. Terms of service leave the accepted document
types. Employees with offer letters and renters with leases stay accepted and get the same
analysis, but every default (starter red lines, counter-offer tone, severity examples) is
written for the primary reader, and the brief says so.
Reason: these documents are take-it-or-leave-it. A counter-offer to a gym is a joke, and the
harm the research found there (missed notice windows) is solved by a reminder, not a summary.
Given up: the segment with the loudest pain and the only regulator complaint data. The top-ranked
clause type in the research (auto-renewal) becomes a secondary concern.
Follow-up, done 2026-11-13 at the owner's request: `CLAUDE.md` line 3 no longer lists "terms of
service" and now names the four accepted document types.

### D3. Within the primary segment, the words are written for the occasional freelancer (2026-11-13)
Someone who signs two or three client contracts a year, does not know what is normal, and needs
the plain English explanation. The veteran who signs twenty and has their own templates is
welcome but not who the defaults, examples, or tone are for.
Given up: the reader most likely to pay and return. The veteran is already served well enough by
pasting the contract into a chatbot.

### D4. The red lines are the whole rulebook (2026-11-13)
Nothing is flagged unless it matches a red line on the reader's list. There is no separate
model-driven danger analysis underneath. Redline's own opinion of what is dangerous lives in the
default red-line list it ships, which the reader can read and edit.
Rejected: a baseline danger analysis with red lines raising severity on top. It would catch what
the occasional freelancer did not think to list, at the cost of flags nobody can trace to a
stated rule.
Given up: the product never surprises the reader with a danger not on a list they can see. If a
red line is deleted, the risk it covered is not flagged. The brief says this plainly.

### D5. Severity has three tiers, defined by what the reader cannot get back (2026-11-13)
- Severe: the clause takes something unrecoverable. Examples: ownership of work made before the
  engagement, unlimited liability, the right to work for other clients, payment for work already
  delivered.
- Moderate: a bounded cost in money or time. Examples: payment later than 30 days, termination
  without notice, a one-sided liability cap.
- Minor: friction the reader can live with. Examples: venue, a short notice period.
No numeric score, because a number implies precision the model does not have.
Rejected as axes: likelihood (needs knowledge of the client, not in the document) and departure
from normal (a claim about other contracts, which the trust rules forbid).
Given up: "this is standard, relax." It is the sentence the occasional freelancer most wants and
the product cannot say it.

### D6. The default red-line list has five entries; six more are offered but off (2026-11-13)
Default on, the five that take something unrecoverable from a freelancer:
1. Assignment of IP created before or outside the engagement.
2. Uncapped indemnity or unlimited liability on the reader.
3. A non-compete or non-solicit that bars work for other clients.
4. Payment that depends on the client's discretion or on a third party paying first.
5. Termination without notice, or without pay for work already done.
Offered, default off: auto-renewal, arbitration or class waiver, unilateral changes to terms,
late fees, fee escalators, one-sided liability caps.
Given up: default coverage of the research's top-ranked clause type, auto-renewal. For a client
contract an auto-renewing retainer is an inconvenience; for a gym it is the whole problem, and
D2 chose not to serve the gym.

### D7. Redline refuses false alarms and accepts that this means some misses (2026-11-13)
When the model is unsure whether a clause matches a red line, the flag is dropped, not shown with
a hedge. Every flag that appears must be correct. The purpose is "what Redline shows you, you can
believe," not "catch everything." A false alarm breaks that promise once and the reader stops
checking real flags. A miss leaves the promise intact, because Redline only promised to check the
document against the red lines and show what it could prove.
Brief sentence: Redline shows only what it can prove. A receipt means no red line matched, not
that the document is safe.
Given up: the right to say "you are safe." A reader can be hurt by a clause Redline did not flag,
and the product accepts that.

### D8. Uncertainty never reaches the reader as language (2026-11-13)
A flag is either shown in plain declarative language or not shown at all. The flag says what the
clause does ("this clause gives the client ownership of code you wrote before the engagement"),
never what to feel about it. The evidence is the source sentence, the judgment is the severity
tier, and nothing in between carries a "might."
Rejected: a separate "check this yourself" bucket for weak matches. It is hedging moved into
layout, and every weak flag would end up there to avoid a decision.
Given up: maybe-flags, entirely. Follows from D7.

### D9. A document with few or no matches produces a receipt, one line per red line (2026-11-13)
For each red line on the reader's list, the result shows one of three things: the flag; the
sentence in the document that addresses the topic; or the plain statement "the document does not
mention this." All three are checkable against the stored text. Silence on a topic is reported as
a fact, not a flag, because ADR-0001 says omissions need a quotable anchor.
Rejected: an empty "no issues" page (reads as failure) and padding with Minor flags (a tool that
always finds something stops being believed).
Given up: the busy page. Some readers will feel they got nothing.

### D10. The reader picks which party they are; Redline never infers it (2026-11-13)
Blind spot raised during the session: nothing in CLAUDE.md, ADR-0001, or the research asks who
the reader is in the document. "Contractor shall indemnify Client" is Severe for the contractor
and nothing for the client. Freelancers subcontract, and small-business owners (accepted, not
designed for) upload contracts as the paying side as often as the paid side. Get the party wrong and every flag inverts, with a
perfect citation under each one.
Before analysis, Redline shows the party names it found in the document and the reader picks
theirs. If no names are found, the reader types their role. Every flag, counter-offer, and
answer is from that party's side.
Rejected: inferring the party from the text; assuming the reader is always the weaker party.
Given up: one click of friction on every upload.

## Round 1: who this is for (settled: D1, D2, D3)

Segments the research surfaced:
- A. Freelancers and small-business owners holding a client's contract (later narrowed to
  freelancers; see D1)
- B. Employees holding an offer letter or non-compete
- C. Renters holding a lease
- D. Consumers holding a membership, subscription, or terms of service

## Round 2: what counts as dangerous (settled: D4, D5, D6)

## Round 3: trade-offs and blind spots (settled: D7, D8, D9, D10)

## Session closed 2026-11-13

Ten questions asked, ten decisions recorded. Not asked, for the brief's author to consider:
- Jurisdiction. The same clause's bite depends on where the reader lives (a non-compete is void
  in some states). Redline states only what the document says, so it cannot say "unenforceable
  here." The brief should say whether severity ignores jurisdiction entirely.
- The baseline. The research names pasting the contract into a chatbot as the real competitor.
  The brief has no success measure against that baseline yet.

Candidate ADRs (not written; the owner decides): D1 with D2 (build for the negotiating reader,
not the evidenced one), D4 (red lines are the whole rulebook), D7 (refuse false alarms). Each is
hard to reverse, surprising without context, and the result of a real trade-off.
