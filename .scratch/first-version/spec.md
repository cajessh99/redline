# Spec: Redline first version

Status: ready-for-agent
Date: 2026-11-13
Source: `PRD.md` (the brief), `CONTEXT.md` (decisions D1 to D10), `GLOSSARY.md` (terms),
`docs/adr/0001-every-flag-cites-its-source.md`, `CLAUDE.md` (constraints).

Terms in this spec are used as `GLOSSARY.md` defines them: primary reader, accepted reader,
accepted document type, red line, default red lines, offered red lines, flag, severity tier,
source sentence, party, receipt.

## Problem Statement

An occasional freelancer is handed a client contract they have not signed yet. Somewhere in it
is a sentence that takes something they cannot get back: ownership of work they made before the
engagement, unlimited liability, the right to work for other clients, or payment for work
already done. Nothing about that sentence looks different from the boilerplate around it, and
they have no baseline for what is normal. Their options today are to paste it into a chatbot
that cannot show where its claims come from, upload it to a free tool that says "potential risk"
with no visible source, pay a lawyer more than the project is worth, or sign it unread.

## Solution

Redline reads the contract and checks it against the reader's own red lines. For every red line
that matches, it shows a flag: the plain English statement of what the clause does, its severity
tier, the exact sentence it came from, and a drafted counter-offer. Code verifies every source
sentence against the stored text before the flag is shown. Where nothing matches, the reader gets
a receipt, one line per red line, rather than reassurance. A question box answers only from the
document. A library keeps past documents. The reader can trust what Redline shows because they
can check every line of it against their own copy.

## User Stories

### Uploading a document

1. As a reader, I want to upload a contract as a PDF, Word document, or plain text file, so that
   I can analyse the document in whatever form the client sent it.
2. As a reader, I want the file parsed in my browser with only the extracted text sent to the
   server, so that the original file never leaves my machine.
3. As a reader, I want a scanned document (one with no extractable text layer) rejected with a
   message that says why and what to do instead, so that I am not shown an analysis of text the
   tool could not actually read.
4. As a reader, I want to see the extracted text before analysis runs, so that I can confirm the
   tool read the document I meant to upload.
5. As a reader, I want to give the document a title or accept one taken from the text, so that I
   can find it later in my library.
6. As a reader, I want an upload that fails for any reason to leave nothing behind in my library,
   so that half-processed documents do not accumulate.

### Choosing my party

7. As a reader, I want Redline to show me the party names it found in the document (such as
   "Client" and "Contractor") and let me pick which one I am, so that every flag is from my side.
8. As a reader, I want to type my role when Redline finds no party names, so that analysis can
   still run on an unusually worded document.
9. As a reader, I want analysis to refuse to start until I have picked a party, so that I never
   see flags computed from a guess about who I am.
10. As a reader, I want to change my party on a document I have already analysed and have the
    analysis rerun, so that I can correct a wrong pick without re-uploading.

### Managing my red lines

11. As a new reader, I want five default red lines switched on the first time I use Redline, so
    that I get a useful analysis before I know what to ask for.
12. As a reader, I want to see six more offered red lines switched off, with a sentence on what
    each covers, so that I can switch on the ones that matter to me.
13. As a reader, I want to read, for each red line, what matches it and what makes a match
    Severe, Moderate, or Minor, so that I understand what the tool is checking before it checks.
14. As a reader, I want to switch any red line on or off, so that the analysis reflects what I
    will and will not accept.
15. As a reader, I want to edit the wording of any red line, including the defaults, so that the
    rulebook is mine rather than the product's.
16. As a reader, I want to add a red line of my own in plain English, so that I can check for
    something the defaults do not cover.
17. As a reader, I want to delete a red line, so that I am not flagged on something I do not care
    about.
18. As a reader, I want to be told, when I delete or switch off a red line, that the risk it
    covered will no longer be flagged, so that I understand what I am giving up.
19. As a reader, I want to restore the default list in one action, so that I can recover from
    edits I regret.
20. As a reader, I want my red lines to persist across sessions and apply to every document I
    upload, so that I set them once.

### Reading the flags

21. As a reader, I want flags listed with Severe first, then Moderate, then Minor, so that the
    worst thing in the document is the first thing I see.
22. As a reader, I want each flag to name the red line it matched, so that I know which of my
    rules it broke.
23. As a reader, I want each flag to show its severity tier as one of three words and never as a
    number or percentage, so that I am not shown precision the tool does not have.
24. As a reader, I want each flag to state in plain English what the clause does to me, written
    for someone who signs a few contracts a year, so that I understand it without a lawyer.
25. As a reader, I want each flag to show the exact sentence from my document it came from, so
    that I can find it in my own copy and read it in context.
26. As a reader, I want the source sentence to match my document word for word, so that I can
    search for it and find it.
27. As a reader, I want to click a source sentence and see it highlighted in the full extracted
    text, so that I can read the surrounding clauses.
28. As a reader, I want a flag that the tool could not tie to an exact sentence never to appear,
    so that everything I see is something I can check.
29. As a reader, I want flags written as plain statements of what the clause does and never as
    "this might be" or "this could possibly," so that I am not left to guess whether the tool
    means it.
30. As a reader, I want flags that say what the clause does, not what to feel about it, so that
    the judgment is mine.
31. As a reader, I want to see which red lines were checked on this document, so that I know a
    missing flag means no match rather than no check.

### Counter-offers

32. As a reader, I want a drafted counter-offer under each flag, so that I have words to send
    back without writing them from scratch.
33. As a reader, I want the counter-offer to propose replacement wording for the cited sentence
    and nothing else, so that it does not assert facts the document does not contain.
34. As a reader, I want to copy a counter-offer in one action, so that I can paste it into an
    email to the client.
35. As a reader, I want counter-offers written from my party's side, so that I never send the
    client wording that favours them.

### Asking questions

36. As a reader, I want to type a question about the document and get an answer, so that I can
    check something specific the flags did not cover.
37. As a reader, I want every answer to cite the sentence it rests on, shown word for word, so
    that I can check it the same way I check a flag.
38. As a reader, I want "the document does not say" when the answer is not in the text, so that
    I am never given general knowledge dressed as a reading of my contract.
39. As a reader, I want questions like "is this normal" or "is this enforceable where I live" to
    receive "the document does not say," so that the tool stays inside the document even when I
    push it outside.
40. As a reader, I want answers from my party's side, so that "can I be terminated" is read as a
    question about me.
41. As a reader, I want my questions and their answers kept with the document, so that I can
    reread them later.

### The receipt

42. As a reader, I want a document that matches none of my red lines to show one line per red
    line rather than an empty page, so that I can see what was checked.
43. As a reader, I want each receipt line to show the sentence in the document that addresses
    that red line's topic when one exists, so that I can see the clause that satisfied the check.
44. As a reader, I want a receipt line to say "the document does not mention this" when nothing
    addresses the topic, so that silence is reported as a fact.
45. As a reader, I want the receipt never to say the document is safe, fine, or clean, so that I
    do not mistake "no match" for "no risk."
46. As a reader, I want the receipt to appear alongside any flags there are, so that a document
    with one flag still shows me the other red lines were checked.

### The library

47. As a reader, I want every analysed document listed with its title, date, party, and the
    number of flags per tier, so that I can find what I need at a glance.
48. As a reader, I want to reopen a past document and see its flags, counter-offers, receipt, and
    questions exactly as they were, so that I do not have to rerun anything.
49. As a reader, I want to delete a document and have its text, analysis, and questions removed,
    so that nothing I did not want kept is kept.
50. As a reader, I want my library to be mine alone, so that no other reader can see my
    documents.
51. As a reader, I want to rerun analysis on a past document after changing my red lines, so that
    the result reflects my current rulebook.

### Account

52. As a reader, I want to sign up and sign in with an email address, so that my library and red
    lines follow me.
53. As a reader, I want to be signed out of everything if I sign out, so that a shared machine
    does not expose my documents.

### Trust and limits

54. As a reader, I want a short statement on the result page that Redline shows only what it can
    prove and that a receipt is not a declaration of safety, so that I understand the limit.
55. As a reader, I want Redline to say plainly that it is not legal advice and makes no claim
    about the law where I live, so that I know what I am and am not getting.
56. As a reader, I want the product never to tell me a clause is unusual or standard, so that I
    am not given a claim about other contracts dressed as a claim about mine.
57. As a reader, I want a model failure (timeout, malformed output) to produce a clear message
    and no partial result, so that I never see a half-analysis and mistake it for a whole one.

### Developer stories

58. As a developer, I want the analysis boundary callable with a document text, a party, and a
    list of red lines, returning flags, receipt lines, counter-offers, and answers, so that I can
    test the whole pipeline without a browser or a database.
59. As a developer, I want the model client behind an interface so that tests can inject canned
    model output, including deliberate misquotes, and assert what is shown and what is dropped.
60. As a developer, I want the source-sentence check to be a pure function over the stored text,
    so that it is tested exhaustively on its own.
61. As a developer, I want the OpenRouter key read only on the server and never bundled for the
    browser, so that the credential rule in CLAUDE.md is enforced by structure rather than care.
62. As a developer, I want fixtures that encode each of the five default red lines in Severe,
    Moderate, and Minor forms, so that tier assignment is tested against known sentences.
63. As a developer, I want the test set of twenty real contracts (PRD section 4) kept outside the
    repository and referenced by the eval harness, so that real contracts are never committed.

## Implementation Decisions

### Stack and boundaries (settled in CLAUDE.md)

- Next.js application, Supabase for auth and database, deployed on Vercel. The model is called
  through OpenRouter from server code only. The key lives in the gitignored env file and is
  never shipped to the browser.
- The uploaded file is parsed in the browser. Only the extracted text, a title, the chosen party,
  and the analysis results are stored. The file itself is never uploaded or stored.

### Document intake (seam 2, browser side)

- Accepted file formats: PDF, Word (docx), plain text. Anything else is refused with a message
  naming the three formats.
- Text extraction runs in the browser. A PDF whose extracted text is empty or below a small
  threshold relative to page count is treated as scanned and refused with the message that
  Redline does not read scanned documents and why (a citation to misread text is worthless).
  Nothing is stored for a refused upload.
- The extracted text is normalised once at intake: whitespace collapsed, line breaks preserved
  only at paragraph boundaries, typographic quotes left as they are. The normalised text is the
  stored text. It is what the reader sees in the full-text view, what the model receives, and
  what source sentences are checked against. The three are the same string so that "exact
  match" means exactly one thing.
- Redline does not try to detect the document type. The accepted document types are a product
  statement, not a classifier. Terms of service are not detected and refused; they are simply not
  offered or designed for.

### Party selection

- After intake, the server extracts candidate party names from the stored text: defined terms
  introduced in the opening paragraphs (quoted or parenthesised capitalised terms such as
  "Client," "Contractor," "Company," "Consultant," "Landlord," "Tenant," "Employer,"
  "Employee"). Candidates are shown to the reader, who picks one. If none are found, the reader
  types a role.
- Candidate extraction is heuristic and may be done by the model or by pattern; either way the
  reader's choice is the only input to analysis. The product never infers the party.
- The chosen party is stored with the document. Changing it reruns analysis.

### Red lines

- A red line has: a title, a description of what matches, a description of each tier (Severe,
  Moderate, Minor) in that red line's terms, an enabled switch, and a flag marking it as a
  product default, a product offered item, or reader-authored.
- The five default red lines and six offered red lines, with their tier descriptions, are those
  in PRD.md section 5, word for word. They are seeded into a new reader's list at first sign-in.
  Edits are stored per reader; "restore defaults" rewrites the eleven product items to their
  shipped wording and leaves reader-authored items alone.
- The enabled red lines at the moment of analysis are the whole rulebook for that run. They are
  stored alongside the result so a reopened document shows what was checked.

### Analysis boundary (seam 1, server side)

- One module exposes: analyse(document text, party, enabled red lines) returning flags and
  receipt lines; counterOffer is produced within the same call per flag; answer(document text,
  party, question) returning an answer with a cited sentence or the "does not say" result.
- The model client is an interface with one implementation over OpenRouter and one fake for
  tests. The model is asked for structured output: for each enabled red line, zero or more
  candidate matches, each with the red line's id, a tier, a plain English statement, the source
  sentence copied verbatim, and a counter-offer; plus, for red lines with no match, either an
  addressing sentence copied verbatim or an explicit "not addressed."
- The prompt instructs the model to return only matches it is certain of and to omit anything
  doubtful. The output schema has no confidence field. Doubt is expressed by absence (D7, D8).
- **Source verification** is a pure function: the candidate's source sentence must occur as an
  exact substring of the stored text. No fuzzy matching, no whitespace tolerance beyond what
  intake normalisation already applied. A candidate that fails is sent back once for
  regeneration with the failure named; if it fails again it is dropped. The same check applies
  to receipt addressing sentences and to question answer citations.
- Each surviving flag records: red line id, tier, statement, source sentence, its character
  offset in the stored text (for highlighting), and the counter-offer.
- Flags are ordered Severe, Moderate, Minor, then by position in the document.
- Receipt lines are produced for every enabled red line with no surviving flag: the verified
  addressing sentence, or "the document does not mention this." The word "safe," "clean," or
  "no issues" never appears in product copy for this state.
- A question answer must carry a verified citation. If the model returns an answer with no
  citation, or a citation that fails verification after one regeneration, the shown result is
  "the document does not say." This makes the trust rule mechanical rather than a matter of
  prompt obedience.
- A model failure (timeout, unparsable output) produces an error state and stores nothing for
  that run.
- Which model is used through OpenRouter is a configuration value, not a code decision. The
  initial choice is recorded in QUESTIONS.md for the owner to confirm.

### Persistence

- Tables: readers (from Supabase auth), red lines (per reader), documents (reader id, title,
  stored text, party, created at), analyses (document id, enabled red lines snapshot, flags,
  receipt lines, created at), questions (document id, question, answer, citation, created at).
- Row-level security so that a reader can read and write only their own rows.
- Deleting a document deletes its analyses and questions.

### Product copy

- The result page carries two fixed statements: "Redline shows only what it can prove. A
  receipt means no red line matched, not that the document is safe," and a plain not-legal-advice
  line that also says Redline makes no claim about the law where the reader lives.
- Statements in flags describe what the clause does to the reader's party. They never use
  "unusual," "standard," "normal," "might," "may be," or "could possibly."

## Testing Decisions

- A good test calls the analysis boundary with a document text, a party, red lines, and a fake
  model client, and asserts on what comes back. It does not inspect prompts, internal ordering,
  or how the model client is wired. Intake tests call the extraction function with a file and
  assert on the text or the refusal.
- **Source verification** is tested exhaustively on its own: exact substring passes; a one-word
  paraphrase fails; a sentence with altered whitespace fails unless intake normalisation would
  have produced the same string; a sentence spanning two paragraphs behaves as the normalised
  text dictates.
- **Analysis boundary:**
  - A fake model returning a correct candidate yields one flag with its source sentence and
    offset (T1).
  - A fake model returning a misquoted candidate, then a correct one on regeneration, yields the
    corrected flag; a fake returning two misquotes yields no flag and a receipt line (T1).
  - A fake model returning candidates for a disabled red line yields nothing for it (D4).
  - Ordering: Severe before Moderate before Minor, then document order.
  - A fake model returning an addressing sentence that fails verification yields "the document
    does not mention this," not the unverified sentence (T4).
  - Party inversion: the same fixture with the party swapped and a fake tuned per party yields
    flags only for the correct side (T5, structural part).
  - Question answers with no verifiable citation yield "the document does not say" (T6,
    structural part).
  - A fake model that throws or returns malformed output yields an error result and no partial
    flags.
- **Intake:** a text-layer PDF yields text; a scanned PDF fixture yields the refusal; a docx
  yields text; an unsupported format yields the format refusal; the normalisation is idempotent.
- **Fixtures:** synthetic contract excerpts written for the tests, one per default red line per
  tier (fifteen), plus a benign excerpt that matches nothing. No real contracts in the repo.
- **What the automated tests do not cover:** the quality of the real model's matches. That is the
  eval suite in PRD section 4 (T2, T3, T7, T8, T9), run against the owner's twenty-contract test
  set with the real model client, and it is a separate piece of work from this spec.
- Prior art: none. This is the first code in the repository. The test runner is a dependency and
  needs the owner's approval before it is added.

## Out of Scope

- Payments, billing, OCR for scanned documents, sharing documents between readers (CLAUDE.md).
- Terms of service, memberships, subscriptions, and notice-window reminders (PRD section 7).
- Any danger analysis beyond the enabled red lines. Any "unusual" or "standard" judgment. Any
  jurisdiction-aware statement. Numeric risk scores, confidence values, or a "check this" bucket.
- Inferring the reader's party or assuming they are the weaker side.
- Answers from outside the document.
- The eval suite against real contracts with the real model (PRD section 4). This spec builds
  the product and its structural tests; the eval harness is its own effort.
- Tailored defaults for employees, renters, or small-business owners. They are accepted readers
  and get the primary reader's defaults.
- Anything not in PRD section 3.

## Further Notes

- **Dependencies need approval before install** (CLAUDE.md). The likely list: Next.js and React;
  the Supabase client and its Next.js helpers; a browser PDF text extractor; a browser docx text
  extractor; a schema validator for the model's structured output; a test runner. Each should be
  proposed to the owner by name with the reason before anything is added.
- **Model choice** through OpenRouter is open. Record the proposed default and the alternatives
  in QUESTIONS.md rather than deciding silently.
- **Scanned threshold** (how little text makes a PDF "scanned") is a tuning value. Start strict:
  refuse when extracted characters per page fall below a low fixed number, and record the number
  so it can be revisited after the first real uploads.
- **The receipt's "does not mention" line cannot be verified in code.** Absence has no substring
  to check. It is shown when the model returns no addressing sentence and is the one claim in the
  product that rests on the model alone. T4 in PRD section 4 tests it by hand. The eval suite
  should watch it closely.
- **Candidate ADRs** from CONTEXT.md remain unwritten: D1 with D2 (build for the negotiating
  reader), D4 (red lines are the whole rulebook), D7 (refuse false alarms). An implementing agent
  that finds itself needing to reopen any of them should stop and record the conflict in
  QUESTIONS.md rather than decide.
