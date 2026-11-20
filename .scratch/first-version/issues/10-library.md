# 10: Library

**What to build:** A reader's past documents are listed with title, date, party, and flag count per tier. The reader can reopen any document and see its flags, counter-offers, receipt, and questions exactly as they were, without rerunning anything. They can delete a document and everything attached to it, or rerun analysis after changing their red lines. The title is set at upload: typed by the reader or taken from the text (spec stories 5, 47–51).

**Blocked by:** 03, 08

**Status:** done (2026-11-20; tested in PGlite only)

- [x] At upload, the reader can type a title or accept one taken from the text
- [x] The library lists each document with title, date, party, and counts of Severe, Moderate, and Minor flags
- [x] Reopening a document shows the stored result as it was, with no model call
- [x] Deleting a document removes its text, analyses, and questions
- [x] Rerun applies the reader's current enabled red lines and stores a new analysis with its own snapshot
- [x] A reader cannot see or reach another reader's documents (row-level security, tested)
- [x] The library is the signed-in home: a signed-in reader at the root URL lands here, with the upload action at the top, replacing ticket 13's placeholder redirect (spec story 68)
- [x] An empty library prompts a first upload, and its copy has been run through the humanizer skill
