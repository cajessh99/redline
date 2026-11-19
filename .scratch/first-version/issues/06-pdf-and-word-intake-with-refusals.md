# 06: PDF and Word intake, with refusals

**What to build:** A reader can upload a PDF or Word (docx) contract as well as plain text, with text extracted in the browser. A scanned PDF (no usable text layer) is refused with a message saying Redline does not read scanned documents and why: a citation to misread text is worthless. Any other format is refused with a message naming the three accepted formats. A refused upload stores nothing (spec stories 1–3, T10). No OCR, under any circumstances.

**Blocked by:** 03. Needs the owner's approval of a browser PDF text extractor and a browser docx text extractor, each proposed by name with its reason, before install.

**Status:** needs-info

- [ ] Owner has approved both extractor dependencies by name
- [ ] A PDF with a text layer yields text that goes through the same normalisation as plain text
- [ ] A docx yields text that goes through the same normalisation
- [ ] A PDF whose extracted characters per page fall below a fixed threshold is refused. The threshold is a named constant, and its value is recorded in `QUESTIONS.md` for revisiting
- [ ] The scanned-document refusal says why and what to do instead
- [ ] An unsupported format is refused with a message naming PDF, Word, and plain text
- [ ] A refused upload leaves no stored text, no analysis, and no library entry
- [ ] Tests: a text-layer PDF, a scanned PDF fixture, a docx, and an unsupported file
