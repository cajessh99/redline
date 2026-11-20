# 02: Analysis boundary with source verification (no UI)

**What to build:** The module that enforces the trust rules, callable with a document text, a party, and a list of red lines, and testable without a browser or a database (spec stories 58–60, 62). It returns flags whose source sentences have been checked, as an exact match, against the stored text. A flag that fails the check is regenerated once and then dropped. This is the deep module the rest of the product sits on (ADR-0001, D7, D8).

**Blocked by:** 01

**Status:** done (2026-11-20)

- [x] Source verification is a pure function: a source sentence passes only when it occurs as an exact substring of the stored text
- [x] Verification is tested exhaustively: an exact substring passes, a one-word paraphrase fails, altered whitespace fails unless intake normalisation would produce the same string, and a sentence spanning paragraphs behaves as the normalised text dictates
- [x] The model client sits behind an interface, with a fake for tests and no real model call in tests
- [x] A correct candidate yields one flag with its red line id, tier, statement, source sentence, and character offset
- [x] A misquote followed by a correct regeneration yields the corrected flag. Two misquotes yield no flag
- [x] Candidates for a red line not in the enabled list are ignored
- [x] Flags are ordered Severe, Moderate, Minor, then by position in the document
- [x] A model that throws or returns malformed output yields an error result with no partial flags
- [x] The output schema has no confidence field
- [x] Fixtures: synthetic excerpts for each default red line in each tier (fifteen), plus one benign excerpt. No real contracts in the repo
