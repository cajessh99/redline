# 04: Receipt

**What to build:** Every enabled red line with no surviving flag gets a receipt line on the result page. The line shows either the sentence in the document that addresses the red line's topic (verified as an exact match) or the statement "the document does not mention this". The receipt appears alongside any flags, so a reader can see that every red line was checked (spec stories 42–46, D9, T4).

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Each enabled red line appears once, as either a flag or a receipt line
- [ ] An addressing sentence that passes verification is shown verbatim
- [ ] An addressing sentence that fails verification after one regeneration becomes "the document does not mention this", and the unverified sentence is never shown
- [ ] A document with no matches shows a full receipt, not an empty page
- [ ] The words "safe", "clean", and "no issues" never appear in receipt copy
- [ ] Receipt lines are stored with the analysis
- [ ] Tested with the fake model client, including a failed addressing sentence
