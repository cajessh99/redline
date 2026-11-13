# Redline: product brief

Date: 2026-11-13. Owner: Jessica Hill. Status: first version, decisions settled in `CONTEXT.md`.
Vocabulary in `GLOSSARY.md`. Technical constraints in `CLAUDE.md`. Research in `research/`.

Redline reads a contract the reader has not signed yet and shows them the clauses that match
their own red lines, each with the exact sentence it came from.

## 1. Who this is for

**The primary reader is an occasional freelancer holding a client's contract they have not
signed yet.** Occasional means two or three contracts a year. They have no baseline for what is
normal, they do not have a lawyer, and they can still say no. Every default, example, and
sentence in the product is written for this person.

Three other readers are accepted but not designed for. They get the same analysis with the same
defaults, and nothing is tuned for them:

- An employee holding an offer letter or a non-compete.
- A renter holding a lease.
- A small-business owner holding a vendor or supplier contract.

The veteran freelancer who signs twenty contracts a year and has their own templates is welcome
and is not who the words are written for.

One reader is named as not served: a consumer holding a gym membership, a subscription
agreement, or a website's terms of service. Section 7 says why.

**What the primary reader does today instead.** The research gives four substitutes, in rough
order of how often they appear:

1. **Paste the contract into a general chatbot.** The research summary calls this "the real
   substitute" and says "your closest competitor may be pasting a contract into a chatbot." A
   vendor survey (Rev) found 65% of Americans have used an AI chatbot for legal help. The Stanford
   study it cites found 69% to 88% hallucination on specific legal queries, measured on legal
   questions rather than contract review.
2. **Upload it to a free review tool from a brand they know.** Rocket Lawyer's Rocket Copilot
   Contract Review (free, launched August 2025) will "highlight key terms, flag potential risks,
   and share what might need a second look before you sign." LegalZoom's Doc Assist gives a
   red, yellow, green rating. Neither advertises quoting the source text. See
   `research/competitors-addendum.md`.
3. **Sign it unread.** One Reddit author who reviewed more than a hundred UK freelance
   contracts wrote that "almost none of the freelancers I spoke to had spotted them," meaning
   the IP, indemnity, and non-compete terms inside. The survey evidence that small businesses
   skip legal review because of cost is weak and vendor-run.
4. **Pay a lawyer.** Employment contract reviews run about $100 to $430. One California attorney
   lists $1,000 flat for contract review. The occasional freelancer with a $3,000 project does
   not do this.

## 2. The problem

A freelancer is handed a contract by someone with more leverage and more practice. It contains
a sentence that takes something they cannot get back, and they do not see it because nothing in
the document looks different from anything else.

The closest the research gets to this reader is a developer who caught the clause in time:

> "I almost signed it." The clause covered code "I'd written before the engagement"; "All of it.
> Theirs. The moment I delivered the project."; "I walked away from the project."
> Source: https://dev.to/not_varunkv/the-contract-clause-that-almost-cost-me-my-entire-codebase-j9d

That is a near miss, not a loss. The research found no freelancer who signed an IP, indemnity,
or non-compete clause and reported a dollar figure afterwards. Say that plainly: the primary
reader's harm is asserted here, not measured.

The measured harm in the research belongs to a different reader. A renter on BiggerPockets:

> "Just found out my lease on the townhome I have leased for a year has an auto renew clause."
> "...since I didn't give them 60 days notice."
> Source: https://biggerpockets.com/forums/52/topics/975476-now-what-locked-into-auto-renew-lease-on-townhome-bought-home

They paid a $400 fee and still owed about $14,000 in rent before the unit re-rented. That is the
one first-person dollar loss in the research, and the research summary's own verdict is that
it "is a deadline problem" that "a calendar reminder addresses as well as a summary does."

What the two cases share is the shape of the problem: one sentence, buried in boilerplate,
whose effect the reader did not understand until it was too late or almost too late. Redline
exists for the moment before signing, when seeing that sentence still changes something.

The second half of the problem is trust. The existing fixes are either unverifiable (a chatbot
or a free tool that says "potential risk" with no visible source) or expensive (a lawyer). The
research records that the consumer incumbent, DoNotPay, settled with the FTC for $193,000 over
overstated "robot lawyer" claims. A tool that says "here is what you are signing" and is
sometimes wrong, with no way for the reader to check, is worse than no tool.

## 3. What the first version does

Nothing beyond this list is in the first version.

1. **Takes an upload and keeps only the text.** The reader uploads a contract. The file is
   parsed in the browser and only the extracted text is stored. A scanned document, meaning one
   with no extractable text layer, is rejected with a message that says why. Accepted document
   types: a client contract, a vendor or supplier contract, an employment offer or non-compete,
   a lease.
2. **Asks which party the reader is.** Before analysis, Redline shows the party names it found
   in the text (for example "Client" and "Contractor") and the reader picks theirs. If no names
   are found, the reader types their role. Redline never infers it. Everything downstream is
   from that party's side.
3. **Keeps the reader's red lines.** An editable list of terms the reader will not accept. Five
   are switched on by default and six more are offered switched off (Section 5). The reader can
   edit, delete, add, and switch. Nothing is flagged unless it matches a red line on this list.
4. **Shows flags, ranked by severity, each with its source sentence.** A flag names the red
   line it matched, its severity tier (Severe, Moderate, Minor), a plain English statement of
   what the clause does, and the exact sentence from the document it came from. Code checks that
   sentence against the stored text as an exact match before the flag is shown. A flag that fails
   the check is dropped or regenerated, never shown. A match the model is unsure of is dropped.
5. **Drafts a counter-offer for each flag.** A replacement sentence or short paragraph the
   reader can paste into a reply. It asserts nothing the cited sentence does not support.
6. **Answers questions from the document only.** A question box. Where the document does not
   contain the answer, the response is "the document does not say," not an answer from general
   knowledge.
7. **Produces a receipt when little or nothing matches.** For each red line on the list, the
   result shows the flag, or the sentence in the document that addresses that topic, or the
   statement "the document does not mention this." A receipt never says the document is safe.
8. **Keeps a library of past documents.** The reader's stored texts and their results, listed,
   reopenable, deletable. One reader's library is theirs alone.

## 4. What good looks like

The analysis is good when a reader can check every claim against their own document and finds
it holds. Each test below is specific enough to run. Numbers are the owner's starting
thresholds, set on 2026-11-13, to be revised against the first test set.

**Test set.** Twenty real freelance contracts, collected before building begins, each hand-marked
by the owner against the five default red lines: which sentences match, at what tier. The same
twenty are reused for every test below. At least five of the twenty should contain no match at
all, so the receipt is tested.

**T1. Citation integrity (hard gate).** Every displayed flag's source sentence is present
verbatim in the stored text. Target: 100%, enforced in code, with an automated test that feeds a
deliberately misquoted flag and asserts it is not shown. Any failure is a release-blocking bug.

**T2. Precision over recall.** Of the flags Redline shows on the test set, the share the owner
agrees are real matches to the stated red line: at least 95%. Of the Severe sentences the owner
marked, the share Redline flagged: at least 70%. When these two pull against each other, T2's
precision figure wins. A wrong flag is a bug to fix. A miss is a gap to log.

**T3. Severity agreement.** Of the flags the owner agrees with, the share where Redline's tier
matches the owner's: at least 80%. A Severe marked Minor counts as two steps off and is logged
separately.

**T4. The receipt is honest.** On the five no-match documents, Redline produces a receipt with
zero flags, and every "the document does not mention this" line is true: no sentence in the text
addresses that red line. Zero tolerance for a false "does not mention."

**T5. Party inversion.** Each test contract is run twice, once as each party. Flags that are
Severe for one side and absent for the other appear on the correct side only. A flag that
appears for both parties with the same tier is reviewed by hand and is a bug unless the clause
is genuinely mutual.

**T6. The question box stays inside the document.** Thirty questions, ten per set: answerable
from the text, answerable only with outside knowledge ("is this normal," "is this enforceable in
my state"), and unanswerable. Target: 100% of the second and third sets receive "the document
does not say" or equivalent. 90% of the first set receive an answer the owner judges correct and
that cites a sentence present in the text.

**T7. Counter-offers claim nothing extra.** The owner reads every counter-offer produced on the
test set and marks any sentence that asserts a fact about the parties, the law, or the market
that the cited text does not contain. Target: zero.

**T8. Beats the baseline on verifiability.** The same twenty contracts are pasted into a general
chatbot with the prompt "what in this contract could hurt me as the contractor." Count, for each
tool, claims that cannot be traced to a sentence in the document. Redline's count must be zero.
The chatbot's count is recorded as the number the brief is competing against.

**T9. A reader can follow it.** Five people matching the primary reader (freelance, a few
contracts a year, no lawyer) each receive one test contract and Redline's result. Each is asked
to find every quoted sentence in their copy and say whether the plain English statement matches
what they read. Target: every sentence found, and at least 4 of 5 readers agree with every
statement. Any disagreement is reviewed as a wording bug.

**T10. Scanned documents are refused.** Three scanned PDFs produce the rejection message and no
analysis, no stored text, no library entry.

## 5. My red lines

The default list is where Redline's opinion of what is dangerous lives. It is written for the
primary reader and it is editable. The research ranked clause types by how loud the complaints
were, which is not severity, and found no frequency or loss data for liability caps, indemnity,
IP assignment, or termination without cause. The five defaults below are the owner's judgment,
and the brief says so.

Severity measures what the reader cannot get back, as the clause is written. Severe takes
something unrecoverable. Moderate costs bounded money or time. Minor is friction the reader can
live with. There is no numeric score. "Unusual" is never a flag, because it is a claim about
other contracts and Redline states only what this document says.

### Default on

**1. Assignment of IP I created before or outside this engagement.**
Severe when the assignment reaches work, code, tools, or libraries made before or outside the
engagement. Moderate when deliverables transfer to the client before payment is received. Minor
when the reader is barred from showing the work in a portfolio.
Why: this is the one clause the research has a first-person account of, the dev.to near miss.
Losing the right to your own prior work is the largest unrecoverable loss a freelancer faces,
and the Reddit review of UK contracts notes IP "upon delivery" means a freelancer "can't even use
it in your portfolio."

**2. Uncapped indemnity or unlimited liability on me.**
Severe when the reader indemnifies the client without a cap, or for the client's own acts.
Moderate when the reader's liability is capped but the client's is not, or the reader's cap
exceeds the contract value. Minor when indemnity is mutual with narrow carve-outs.
Why: an uncapped indemnity turns a $3,000 project into unlimited exposure. The same Reddit author
wrote that indemnification "makes you liable for their legal costs if anything goes wrong." No
frequency data exists; this is on the list because the downside has no ceiling.

**3. A non-compete or non-solicit that bars me from other clients.**
Severe when the reader may not work for other clients, or in their field, during or after the
engagement. Moderate when the reader may not solicit the client's customers for a fixed period.
Minor when the reader may not solicit the client's own employees.
Why: the FTC estimates about 30 million workers are bound by non-competes. That is an employee
figure, not a freelance one, but a freelancer bound by one has lost their income, not one job.

**4. Payment that depends on the client's discretion or on a third party paying first.**
Severe when payment is conditioned on acceptance at the client's sole discretion, or on the
client being paid by their own customer first ("pay when paid"). Moderate when payment is due
later than 30 days after invoice. Minor when invoicing formalities delay payment, such as
invoices accepted only on a fixed day.
Why: the Freelancers Union survey found 91% of New York freelancers "reported experiencing late
or overdue wages at least once" and 62% "had lost wages at least once." The research notes this
is payment behavior, not clause wording. The clause forms above are the ones that make
non-payment legal.

**5. Termination without notice, or without pay for work already done.**
Severe when the client may terminate and owe nothing for work in progress or delivered. Moderate
when the client may terminate without notice but must pay for work done, or when there is no
kill fee on unilateral termination. Minor when the notice period is under seven days.
Why: no research evidence. The owner's judgment: for an occasional freelancer, one unpaid month
of work is the difference between a bad quarter and a missed rent payment.

### Offered, default off

Each is a real clause type the research surfaced. They are off because for a client contract
their cost is bounded, or because they matter most to the readers Redline is not designed for.

6. **Auto-renewal.** Moderate. The research's top-ranked clause type by complaint volume (FTC:
   "nearly 70 consumer complaints per day" in 2024), but the evidence is consumers and leases.
   For a freelancer it is an auto-renewing retainer, an inconvenience.
7. **Arbitration or class-action waiver.** Moderate for arbitration in a distant forum (cost of
   pursuing an unpaid invoice), Minor for a class waiver (rarely relevant to a freelancer).
8. **Unilateral changes to terms.** Moderate. The client may change the agreement without the
   reader's consent. Research has commentary only.
9. **Late fees and penalties on me.** Moderate. Fees the reader pays for missing a deadline.
10. **Fee escalators.** Minor. Prices or rates that rise automatically. No research data.
11. **A cap on the client's liability to me set below what I am owed.** Moderate. Distinct from
    red line 2, which is the reader's own exposure.

## 6. The calls I made and what I gave up

Each of these is a decision someone could disagree with. Full reasoning is in `CONTEXT.md`.

**Built for the freelancer, not the renter.** Chose against the one segment with a measured
loss ($14,000) and regulator complaint data, because a counter-offer and a red-line list only
work for a reader who can negotiate. Worse off: the renter, whose documented harm Redline does
not address, and the brief, which rests on asserted rather than measured pain.

**Freelancer, not small-business owner.** Chose against the broader "small business" pitch after
finding Rocket Lawyer and LegalZoom already serve vendor and supplier contract review free.
Worse off: the business owner on the paying side, who gets no tailored defaults, and the product's
reach, which gives up the word "business."

**The occasional freelancer, not the veteran.** Chose against the reader most likely to pay and
return. Worse off: the veteran, who finds the plain English explanations slow and would prefer a
scan.

**Consumers with memberships, subscriptions, and terms of service are not served.** Chose against
the loudest pain in the research and a document type CLAUDE.md originally listed. Worse off: the
gym member and the subscriber, who are the people in three of the four strongest pain quotes.

**Red lines are the whole rulebook.** Chose against a general danger analysis with red lines
layered on top. Worse off: the reader who deletes a red line and is not flagged on it, and the
reader who did not know to list something, which by Section 1 is the primary reader.

**Severity by what you cannot get back, three tiers, no score.** Chose against likelihood (needs
knowledge of the client) and departure from normal (a claim about other contracts). Worse off:
the reader who wants to hear "this is standard, relax," which Redline will never say.

**Five defaults, not eleven.** Chose against covering every clause type the research named.
Worse off: the reader whose contract has a nasty arbitration clause and gets a receipt.

**Refuse false alarms, accept misses.** Chose against showing weak matches with a hedge. Worse
off: the reader hurt by a clause Redline did not flag. Redline never says "you are safe," and
the reader has to understand that a receipt is not reassurance.

**Uncertainty is never shown as language.** Chose against a "check this yourself" bucket. Worse
off: the reader who would have wanted to see the borderline cases, and the builder, who has
nowhere to put them.

**A receipt, not an empty page or a padded one.** Chose against padding with Minor flags so the
page always looks busy. Worse off: the reader who wanted to feel they got something, and the
product's perceived value on a benign document.

**The reader picks their party.** Chose against inferring it from the text. Worse off: every
reader, by one click per upload.

## 7. What we are not building, and why

- **Payments and billing.** This version exists to prove the analysis can be trusted. Nothing is
  charged until it is.
- **OCR for scanned documents.** A citation is worthless when the text it points at was misread.
  Scans are rejected with a clear message.
- **Sharing a document between users.** Not needed to prove the analysis.
- **Terms of service, memberships, subscriptions.** Take-it-or-leave-it documents. A
  counter-offer has no one to receive it, and the harm the research found there is a missed
  deadline.
- **Notice-window reminders.** The fix for the renter's $14,000 loss. It is a different product
  and it would make the renter the primary reader.
- **A general danger analysis beyond the red lines.** Every flag must trace to a rule the reader
  can read.
- **"Is this normal," "is this enforceable here," or any jurisdiction-aware statement.** Claims
  about other contracts or about the law are not claims about this document. Severity ignores
  jurisdiction entirely, and the brief accepts that a non-compete void in the reader's state is
  still flagged Severe.
- **Numeric risk scores, confidence percentages, or a "check this" bucket.** Precision the model
  does not have, or hedging moved into layout.
- **Inferring the reader's party, or assuming they are the weaker side.** Get it wrong and every
  flag inverts under a perfect citation.
- **Answers from outside the document.** The question box says "the document does not say."
- **Anything not in Section 3.** If it looks like the obvious next step, it is asked about first.

## 8. What the research could not tell us

The research was four agents reading 8 to 11 pages each, mostly as search summaries, dated
2026-11-09. Its own summary says: "Treat everything below as directional, not validated."

- **Whether the primary reader has ever lost money.** No first-person account from a freelancer
  who signed an IP, non-compete, indemnity, or payment clause and reported a dollar loss. Only a
  near miss and an advice post.
- **Whether anyone will pay.** "No end-user stated a price for an AI contract explainer." The
  only anchors are competing tools at free to $29 a month and lawyers at $100 to $1,000. This
  version does not charge, so the question is deferred, not answered.
- **Whether anyone negotiates once they know.** "Nobody in the evidence asked for a drafted
  counter-offer. Whether people negotiate once they know a term is risky is untested."
- **How severe each clause type is.** No source compares harm across clause types. The ranking
  in the research is by complaint volume and "is not a measured league table." Section 5 is the
  owner's judgment.
- **How well the baseline already works.** The research did not test pasting a contract into a
  chatbot. T8 in Section 4 is the first time that gets measured.
- **Whether the free incumbents quote the source text.** Rocket Lawyer and LegalZoom do not
  advertise it. Neither was tested on a document.
- **Current law.** The status of the FTC click-to-cancel rule and the non-compete ban was not
  verified. Redline makes no legal claims, so this does not change what gets built.
- **Forum evidence for freelancers.** Hacker News and Indie Hackers produced nothing. Quora,
  Trustpilot, and Stack Exchange were not searched. Reddit was read through mirrors.

What would change this brief: a freelancer with a dollar loss from one of the five default red
lines, a willingness-to-pay figure from someone in the primary segment, or a baseline test
showing a general chatbot already meets T1 through T8.
