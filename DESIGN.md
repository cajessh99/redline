---
name: Redline
description: A printed contract on a grey desk, flagged with plastic index tabs at every sentence that crosses a red line.
colors:
  desk: "#d6d5cf"
  desk-deep: "#c9c8c1"
  paper: "#f7f6f1"
  paper-bright: "#fcfbf7"
  toner: "#171716"
  toner-press: "#000000"
  toner-soft: "#4a4944"
  rule: "#c7c5bc"
  highlighter: "#f1e15a"
  severe: "#b9381f"
  severe-on: "#ffffff"
  severe-wash: "#f4ddd6"
  severe-ink: "rgb(158 44 21)"
  moderate: "#e2a11b"
  moderate-on: "#171716"
  moderate-wash: "#f7e9c9"
  moderate-ink: "rgb(226 161 27)"
  minor: "#2c6f7b"
  minor-on: "#ffffff"
  minor-wash: "#dbe9eb"
  minor-ink: "rgb(31 85 96)"
typography:
  display:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "clamp(2.6rem, 5vw, 4.9rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.015em"
  display-phone:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "clamp(2rem, 8.4vw, 2.6rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.015em"
  wordmark:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "clamp(1.85rem, 3vw, 2.75rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
  body:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 450
    lineHeight: 1.55
    fontFeature: "tnum"
  lead:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(1.0625rem, 1.25vw, 1.1875rem)"
    fontWeight: 450
    lineHeight: 1.55
  action:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 700
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 90"
  small:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 450
    lineHeight: 1.5
  caption:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 450
  document:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "clamp(0.98rem, 1.15vw, 1.0625rem)"
    fontWeight: 400
    lineHeight: 1.62
  label:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    letterSpacing: "0.08em"
  tab-label:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    letterSpacing: "0.08em"
  field-label:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.06em"
rounded:
  none: "0px"
  stamp: "2px"
  tab: "3px"
spacing:
  gutter: "clamp(16px, 4vw, 64px)"
  column-gap: "clamp(20px, 3vw, 48px)"
  band: "clamp(56px, 8vw, 112px)"
  sheet-pad: "clamp(20px, 3.4vw, 52px)"
  sheet-pad-r: "clamp(44px, 4vw, 60px)"
  tab-in: "clamp(32px, 3vw, 44px)"
  tab-out: "clamp(66px, 6vw, 88px)"
components:
  button-primary:
    backgroundColor: "{colors.toner}"
    textColor: "{colors.paper-bright}"
    rounded: "{rounded.stamp}"
    padding: "0 30px"
    height: "56px"
  button-primary-hover:
    backgroundColor: "{colors.toner-press}"
  sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.toner}"
    typography: "{typography.document}"
    rounded: "{rounded.none}"
    padding: "{spacing.sheet-pad}"
  tab-severe:
    backgroundColor: "{colors.severe-ink}"
    textColor: "{colors.severe-on}"
    typography: "{typography.tab-label}"
    rounded: "{rounded.tab}"
    height: "42px"
  tab-moderate:
    backgroundColor: "{colors.moderate-ink}"
    textColor: "{colors.moderate-on}"
    typography: "{typography.tab-label}"
    rounded: "{rounded.tab}"
    height: "42px"
  tab-minor:
    backgroundColor: "{colors.minor-ink}"
    textColor: "{colors.minor-on}"
    typography: "{typography.tab-label}"
    rounded: "{rounded.tab}"
    height: "42px"
  slip-severe:
    backgroundColor: "{colors.severe-wash}"
    textColor: "{colors.toner}"
    rounded: "{rounded.none}"
  slip-moderate:
    backgroundColor: "{colors.moderate-wash}"
    textColor: "{colors.toner}"
    rounded: "{rounded.none}"
  slip-minor:
    backgroundColor: "{colors.minor-wash}"
    textColor: "{colors.toner}"
    rounded: "{rounded.none}"
  stamp-severe:
    backgroundColor: "{colors.severe}"
    textColor: "{colors.severe-on}"
    typography: "{typography.label}"
    rounded: "{rounded.stamp}"
    padding: "3px 8px 2px"
  stamp-moderate:
    backgroundColor: "{colors.moderate}"
    textColor: "{colors.moderate-on}"
    typography: "{typography.label}"
    rounded: "{rounded.stamp}"
    padding: "3px 8px 2px"
  stamp-minor:
    backgroundColor: "{colors.minor}"
    textColor: "{colors.minor-on}"
    typography: "{typography.label}"
    rounded: "{rounded.stamp}"
    padding: "3px 8px 2px"
  stamp-plain:
    textColor: "{colors.toner-soft}"
    typography: "{typography.label}"
    rounded: "{rounded.stamp}"
    padding: "3px 8px 2px"
---

# Design System: Redline

## Overview

**Creative North Star: "The Flagged Contract"**

Redline is a laser-printed contract lying on a grey desk, with translucent plastic index tabs stuck at every sentence that crosses one of the reader's red lines. The document itself is the demonstration and, in the app, the working surface: sheets of paper carry the text, a highlighter marks each cited sentence, and a tab at the paper's edge carries the tier word. Pulling a tab out opens a flag slip in that tab's ink wash.

The register is sober office material, not legal-tech gloss. Density is reading density: a document serif on paper, a condensed grotesk for everything printed on a tab or stamp, and a plain grotesk for the interface around the paper. Depth comes from real paper lying on a desk (one soft, offset paper shadow), never from cards, gradients, or glass. Corners are square or nearly so.

The signed-in app shell inherits this world (see its surface brief). The printed page and its tabs become the result view; navigation and forms stay plain and familiar. The world shows in type, paper, tab inks, and tier stamps, not in costume.

**Key Characteristics:**
- Grey desk ground, off-white paper sheets with one soft offset shadow.
- Toner-black text; document text set in Source Serif 4.
- Highlighter yellow behind every cited sentence, multiplied into the paper.
- Three tier inks (Severe red-orange, Moderate amber, Minor teal), each always paired with its tier word.
- Condensed grotesk (Archivo Narrow) for headings, tabs, stamps; Archivo for UI and body.
- Square or near-square corners; ruled rows instead of cards.

## Colors

A neutral office palette (desk, paper, toner) with one highlighter and three tier inks that appear only where a flag exists.

### Primary
- **Toner Black** (toner): all text, the primary action fill, the focus ring, and the heavy rule above the legal note. The one interface "brand colour"; the inks belong to severity, not to branding.
- **Pressed Toner** (toner-press): the primary action's hover fill only, a step darker than toner as the button lifts. Nowhere else.

### Secondary
- **Highlighter Yellow** (highlighter): behind every cited sentence on the sheet, and as the text selection colour. Applied with `mix-blend-mode: multiply` so it reads as ink on paper. It marks evidence, never decoration.

### Tertiary (tier inks)
- **Severe Red-Orange** (severe / severe-on / severe-wash / severe-ink): the Severe stamp fill (white text), the Severe slip wash, and a deeper plastic ink for the Severe tab.
- **Moderate Amber** (moderate / moderate-on / moderate-wash / moderate-ink): the Moderate stamp and tab carry toner-black text, not white.
- **Minor Teal** (minor / minor-on / minor-wash / minor-ink): the Minor stamp fill (white text), slip wash, and a deeper plastic ink for the Minor tab.

Each tier has four roles: the solid stamp ink, its on-ink text colour, a pale wash for the slip, and a tab plastic ink. The plastic inks are authored in code as bare RGB triplets (`--severe-ink: 158 44 21`) so a tab can apply them at two alphas (see Tabs); they are never used opaque on their own.

### Neutral
- **Desk Grey** (desk): the page background everywhere; the ground the paper lies on.
- **Desk Seam** (desk-deep): hairline band dividers on the desk and the rules between "reads" list items.
- **Laser Paper** (paper): every sheet: the contract, the result list, the red-lines list.
- **Bright Paper** (paper-bright): text on the toner action.
- **Faded Toner** (toner-soft): secondary text, captions, field labels, the plain "No flag" stamp.
- **Ruled Line** (rule): hairlines between rows on paper.

### Named Rules
**The Word Before Ink Rule.** Severity is always the tier word (Severe, Moderate, Minor). Ink repeats it; ink never carries it alone. A tab, stamp, or slip without its word is a bug.

**The Ink Is Earned Rule.** Tier inks and their washes appear only on a flag, its tab, its slip, or its stamp. They are never used for links, buttons, section accents, or status unrelated to a flag.

**The Evidence Highlight Rule.** Highlighter yellow marks a sentence the product cites, and nothing else.

## Typography

**Display Font:** Archivo Narrow (with Arial Narrow, sans-serif)
**Body Font:** Archivo (with Helvetica Neue, Arial, sans-serif)
**Document Font:** Source Serif 4 (with Georgia, serif)

**Character:** Three faces with fixed jobs. The serif is the contract's own voice; anything quoted from a document is set in it. The condensed grotesk is the print on a tab: headings, tabs, stamps, the wordmark. Archivo is the plain interface voice between them. All three are self-hosted variable fonts.

### Hierarchy
- **Display** (Archivo Narrow 700, clamp(2.6rem, 5vw, 4.9rem), 0.98): the single page headline. Below 900px it steps to **Display Phone** (clamp(2rem, 8.4vw, 2.6rem)).
- **Wordmark** (Archivo Narrow 700, 1.625rem, -0.01em): the Redline name in the masthead.
- **Headline** (Archivo Narrow 800, clamp(1.85rem, 3vw, 2.75rem), 1.05): section headings, balanced wrap.
- **Title** (Archivo Narrow 700, 1.125rem): sub-headings inside a section.
- **Lead** (Archivo 450, clamp(1.0625rem, 1.25vw, 1.1875rem)): the one support sentence under the headline, 34rem measure.
- **Body** (Archivo 450, 1.0625rem, 1.55, tabular numerals): interface prose, at 32 to 34rem measure; also the plain statement in a slip.
- **Action** (Archivo 700 at 90% width, 1.1875rem, 0.01em): the primary button label.
- **Small** (Archivo, 0.9375rem): secondary lines on the desk (document types, closing note) and the slip's running text.
- **Caption** (Archivo, 0.875rem, faded toner): the hint under the sheet.
- **Document** (Source Serif 4 400, clamp(0.98rem, 1.15vw, 1.0625rem), 1.62): contract text on the sheet, quoted source sentences, counter-offers. Clause numbers 600; party line italic.
- **Label** (Archivo Narrow 700, 0.8125rem, 0.08em tracking, uppercase): the tier word on stamps. **Tab Label** is the same at 0.875rem on tabs (0.75rem, 0.04em below 560px).
- **Field label** (Archivo 700, 0.75rem, 0.06em tracking, uppercase, faded toner): names a field inside a slip ("Source sentence, clause 6.1", "Counter-offer"). It labels content directly below it; it is never a heading kicker.

### Named Rules
**The Quoted In Serif Rule.** Every sentence taken from the user's document is set in Source Serif 4 and quoted exactly; interface text never uses the serif.

**The Tab Print Rule.** Uppercase tracking belongs to the tier word and to field labels inside a slip. Headings are sentence case.

## Layout

A 12-column grid inside a 1400px container with fluid gutters (gutter) and column gaps (column-gap). The opening splits five columns of pitch (headline, support, action, document types) against seven columns of desk holding the sheet. The sheet reserves extra right padding (sheet-pad-r) plus the desk's right padding (tab-out) so tabs can sit part on the paper (tab-in) and part past its edge (tab-out).

Below the opening, each section is a band: four columns of heading and short text on the left, a paper sheet or list in columns 6 to 12 on the right, separated by a desk-seam hairline and band-sized vertical padding. The closing band is a single left-aligned column.

Responsive rules:
- **Below 900px**: every column spans the full width. The pitch dissolves (`display: contents`) and reorders to headline, action, contract sheet, support sentence, document types, so a phone sees the flagged contract right after the action. Sheet line-height tightens to 1.5; result rows collapse to one column.
- **Below 560px**: the reads/won't-read pair stacks; tabs shrink to 36px tall with 0.75rem text and 0.04em tracking.
- No horizontal scroll: `overflow-x: clip` on html and body absorbs the tabs' overhang.

## Elevation & Depth

Depth is physical: paper on a desk. Sheets cast one soft, offset shadow; tabs cast a small contact shadow as plastic stuck to paper; the toner action lifts slightly. There are no cards, no gradients, no glows, and no tonal surface ramps.

### Shadow Vocabulary
- **Paper** (`box-shadow: 0 1px 2px rgb(23 23 22 / 0.12), 0 14px 36px -10px rgb(23 23 22 / 0.28)`): every paper sheet.
- **Tab** (`box-shadow: 0 1px 1px rgb(23 23 22 / 0.18), 2px 3px 6px -2px rgb(23 23 22 / 0.3)`): a tab at rest; deepens to `4px 5px 10px -3px rgb(23 23 22 / 0.35)` when hovered or open.
- **Action** (`box-shadow: 0 1px 2px rgb(23 23 22 / 0.2), 0 10px 22px -12px rgb(23 23 22 / 0.6)`): the toner button; grows on hover as it lifts 2px.

### Named Rules
**The Clear Then Dense Rule.** A tab is clear where it lies on the paper and dense where it sticks out. The tier word is printed only on the dense part. Never print on the clear part, and never make the whole tab one opacity.

**The Only Paper Floats Rule.** Elevation belongs to paper, tabs, and the primary action. Anything else lies flat on the desk or is ruled onto a sheet.

## Shapes

Square paper. Sheets, slips, and result lists have no radius. Stamps and the action button carry a 2px corner, the softness of a die-cut label. Tabs are square where they meet the paper and 3px-rounded on their free end only; 3px is the largest radius in the system. Structure inside a sheet comes from 1px ruled lines (rule), never boxes; a 2px toner rule marks the legal note.

## Components

### Buttons
Toner-black and plain, like a printed form's one instruction.
- **Shape:** near-square (2px).
- **Primary:** toner fill, bright-paper text, Archivo 700 at 90% stretch, 1.1875rem, 56px tall, 30px side padding.
- **Hover / Focus:** fill goes to pressed toner, lifts 2px, shadow grows (0.25s, ease-out); press returns it to rest. Focus is the global 3px toner outline at 3px offset.
- **Quiet link:** Archivo 600 underlined text (masthead sign-in); underline thickens on hover.

### The Sheet
A sheet of laser paper: paper fill, paper shadow, document serif, a faded-toner caption ruled off at the top, the document title in serif 600, the party line in italic, numbered clauses. Cited sentences sit in a highlighter mark that wraps across lines.

### Tabs (signature)
Plastic index tabs, one per flagged clause, aligned to the clause's first line and running past the sheet's right edge in severity order. Each tab is two parts of one strip of plastic in its tier ink:
- **On the sheet** (tab-in wide): clear plastic, the ink at 0.42 alpha, so the paper, the sheet's edge, and its shadow read through. Nothing is printed here.
- **Past the edge** (tab-out wide): dense plastic, the ink at 0.94 alpha, with the 3px free-end radius. The tier word is printed here, centred, and only here.

The dense part carries contrast: over the desk, white on Severe is about 6.4:1, toner on Moderate above 8:1, white on Minor about 7.6:1. A tab is a real button (`aria-expanded`, controls its slip, carries the red line as hidden text). Hover or open slides it 8px outward and deepens its shadow. On load, tabs stick on one at a time (0.5s, 0.15s apart, from 40px out and 3 degrees rotated).

### Flag Slip
The tab pulled out: a full-bleed band in the tier's wash, running from the clause text to the tab's outer end, with square corners. It holds a tier stamp and the red line, the plain statement (Archivo 500), the source sentence in quoted serif under a field label, and the counter-offer in serif under a field label. It opens with a 0.45s top-down reveal.

### Tier Stamp
A small solid label in the tier ink with its word in uppercase condensed grotesk. Used in slips and in result rows. The plain variant (outlined in faded toner, transparent fill) marks a red line with no flag.

### Ruled Rows
Lists on paper (the ranked result, the red lines) are rows separated by 1px rule hairlines, no last-row rule. A result row is three columns (stamp, red line, quoted source) that collapse to one below 900px; a row with no flag sets its source line in faded-toner Archivo.

### Navigation
A masthead with the wordmark (Archivo Narrow 700, 1.625rem) at left and a quiet link at right, baseline-aligned, no bar or background.

## Do's and Don'ts

### Do:
- **Do** put every surface on the desk ground and set documents on paper sheets with the paper shadow.
- **Do** print the tier word on every tab, stamp, and slip; ink only repeats it.
- **Do** set every quoted document sentence in Source Serif 4, exactly as stored, with highlighter on the sheet and quotation marks in the slip.
- **Do** order tabs, slips, and result rows Severe, Moderate, Minor.
- **Do** build tabs from the plastic inks, clear (0.42) on the sheet and dense (0.94) past its edge, with the tier word on the dense part at 4.5:1 or better; use the solid inks for stamps.
- **Do** show tabs already placed and slips without motion under reduced motion.
- **Do** separate rows on paper with rule hairlines.

### Don't:
- **Don't** use tier inks, washes, or highlighter yellow for anything that is not a flag or a cited sentence.
- **Don't** use colour alone to signal severity.
- **Don't** put content in rounded cards, or add gradients, glows, or glass; radius stops at 3px.
- **Don't** set interface copy in the serif or quoted document text in the grotesk.
- **Don't** add uppercase kicker labels above headings; uppercase is for tier words and slip field labels.
