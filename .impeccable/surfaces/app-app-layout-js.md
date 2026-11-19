---
version: 1
slug: "app-app-layout-js"
primary_target: "app/(app)/layout.js"
related_targets: []
---

# Surface brief: app shell (signed in)

Scope: the frame behind sign-in that holds every reader screen. Mode: **Operate**. Brief only;
nothing here is built yet (tickets 03 to 12). Inherits the Page Flags world chosen on 2026-11-19
for the landing page; DESIGN.md records it once written.

## Reader, task, frequency
- Reader: the primary reader in PRD.md, two or three contracts a year, so every visit is close to
  a first visit. The shell must be learnable on each return, not optimised for daily speed.
- Task: get from an unsigned contract to the flags and counter-offers they will act on, and check
  each flag against their own copy.

## What the frame holds (spec order)
1. **Upload** a PDF, Word, or plain-text file; parsed in the browser; the extracted text shown for
   confirmation before analysis. Upload only: pasting text is not in the spec (open question in
   QUESTIONS.md). Scanned or photographed documents are refused with the reason.
2. **Party selection** from the names found in the text, or typed when none are found. Never inferred.
3. **Result**: flags ranked Severe, Moderate, Minor, then document order. Each flag shows its red
   line, tier word, plain statement, exact source sentence, and counter-offer. There is no separate
   summary: the ranked flags are the summary. Beside them, **the receipt**: one line per enabled red
   line with no flag, showing the sentence that addresses it or "the document does not mention
   this". No verdict of any kind, and no word on the banned list in PRODUCT.md.
4. **Full text** with cited sentences highlighted, reachable from every flag.
5. **Question box**: answers only from the document, with the cited sentence, or "the document does
   not say".
6. **Red lines**: five on, six offered off; edit, delete, add, switch.
7. **Library**: the signed-in home (CONTEXT.md D11). Past documents with title, date, party, and
   counts per tier; upload action at the top; an empty library prompts a first upload.

## States that must be designed
Empty library; extracted-text preview; refusal (scanned, unsupported format, terms of service);
analysis running; model failure with no partial result; result with flags; result that is a full
receipt; question with no answer in the document; red line switched off; deleting a document.

## How the world extends here
The printed page and its tabs carry over as the result view: the document in the reading column,
tabs at its edge in severity order, flags as slips pulled from the tabs. Navigation and forms stay
plain and familiar; the world shows in type, paper, tab inks, and the tier stamps, not in costume.
Severity is always a word, never colour alone. WCAG 2.2 AA, phone and laptop both full targets.

## Unresolved
- Pasting text instead of uploading (QUESTIONS.md).
- Exact navigation pattern between library, red lines, and an open document: decide when ticket 03
  builds the first screen.
