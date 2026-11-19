---
version: 1
slug: "app-page-js"
primary_target: "app/page.js"
related_targets: []
---

# Surface brief: landing page

Scope: the public page at the root URL, shown to visitors (GLOSSARY.md). Mode: **Persuade**.
Ticket 13; PRD section 3 item 9; spec stories 64–69; CONTEXT.md D11.

## Audience, job, action
- Visitor: the primary reader in PRD.md, an occasional freelancer holding a client contract they
  have not signed and can still push back on. Not a reader of take-it-or-leave-it documents.
- Job: decide in seconds whether Redline will read their contract and whether they can trust what
  it says.
- One action: **Check a contract**, which leads to sign-up. Sign-in is a quiet header link for
  returning readers, not a second action. Until ticket 01 ships auth, both go to a placeholder.

## Proof and content
- Demonstrated, not claimed: a synthetic client contract, labelled as a sample, turning into
  ranked flags, each tab pointing at the exact sentence it came from, the sentence repeated
  verbatim in the flag.
- The five default red lines (PRD section 5) by name. A receipt line ("the document does not
  mention this") shown beside the flags.
- Limits, stated plainly: the four accepted document types; no scanned or photographed documents;
  no terms of service; not legal advice and no claim about the law where the reader lives; no
  verdict on whether to sign.
- Never: prices, customers, testimonials, counts, accuracy figures. Banned words per PRODUCT.md.

## Unresolved
- Signed-in redirect to the library waits on ticket 01 (auth) and ticket 10 (library).
- Analytics are ticket 14, not this build.

## Direction contract

THESIS: The page is a printed client contract with plastic index tabs sticking out at every
sentence that crosses a red line. It refuses the category's split hero with a product screenshot
and a row of feature cards; the document itself is the demonstration.

OWN-WORLD: Laser-printed paper (#f6f6f2) lying on a grey desk ground, toner-black text set in a
document serif, highlighter yellow over each cited sentence, and translucent plastic tabs in three
inks (Severe red-orange, Moderate amber, Minor teal), each tab printed with its tier word so colour
never carries severity alone. UI type is a condensed grotesk like the print on a tab. Square
corners; paper casts a soft, offset shadow; no cards, no gradients.

STORY: The visitor sees a contract being flagged, reads that every flag quotes the exact sentence
it came from, sees the same sentence on the page and in the flag, learns what Redline reads and
refuses, and presses Check a contract.

FIRST VIEWPORT: Left five columns: headline at display size, one sentence of support, the Check a
contract action, and one line naming the accepted document types. Right seven columns: one printed
contract page at reading scale bleeding off the bottom edge, three sentences highlighted, three
tabs projecting past its right edge in severity order (SEVERE, SEVERE, MODERATE), labelled
"Sample contract". Signature interaction: choosing a tab pulls it out into a flag slip showing the
red line, the plain statement, and the identical source sentence. Motion: on load the tabs stick
on one at a time, a single moment; reduced motion shows them placed.

FORM: Page Flags, position 1 of my ordered list (the IMPECCABLE'S PICK card, chosen by the owner
on the decision page). seed:cc8b28313929e20f

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
