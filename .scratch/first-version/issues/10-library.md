# 10: Library

**What to build:** A reader's past documents are listed with title, date, party, and flag count per tier. The reader can reopen any document and see its flags, counter-offers, receipt, and questions exactly as they were, without rerunning anything. They can delete a document and everything attached to it, or rerun analysis after changing their red lines. The title is set at upload: typed by the reader or taken from the text (spec stories 5, 47–51).

**Blocked by:** 03, 08

**Status:** ready-for-agent

- [ ] At upload, the reader can type a title or accept one taken from the text
- [ ] The library lists each document with title, date, party, and counts of Severe, Moderate, and Minor flags
- [ ] Reopening a document shows the stored result as it was, with no model call
- [ ] Deleting a document removes its text, analyses, and questions
- [ ] Rerun applies the reader's current enabled red lines and stores a new analysis with its own snapshot
- [ ] A reader cannot see or reach another reader's documents (row-level security, tested)
