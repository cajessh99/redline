# 07: Party selection

**What to build:** After intake, Redline shows the party names it found in the document (defined terms such as "Client" and "Contractor") and the reader picks which one they are. If none are found, the reader types their role. Analysis refuses to start until a party is chosen, and changing the party on an analysed document reruns the analysis (spec stories 7–10, D10, T5).

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Candidate party names are extracted from the opening of the stored text and shown to the reader
- [ ] The reader picks one, or types a role when no candidates are found
- [ ] Analysis cannot start without a chosen party, and the party is never inferred or defaulted
- [ ] The chosen party is stored with the document
- [ ] Changing the party reruns the analysis and replaces the shown result
- [ ] Structural party-inversion test: the same fixture with the party swapped, using a fake model tuned per party, yields flags only for the correct side
