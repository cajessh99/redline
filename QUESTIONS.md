# Open questions

Questions recorded instead of decided, per CLAUDE.md. Each has options and a recommended default.

## Q1. Should a reader be able to paste text instead of uploading a file? (2026-11-19)

Raised by the app shell brief, which asked for "paste or upload". The spec (stories 1 to 6) has
file upload only: PDF, Word, or plain text, parsed in the browser.

- **A. Upload only, as specced (recommended default).** No change. A reader with text in an email
  saves it as a .txt file first.
- **B. Add paste as a second intake.** A new spec story and ticket. Pasted text skips the parser,
  so the extracted-text preview (story 4) and the stored-text rule still apply, but the scanned
  check does not.

Until answered, the app shell brief assumes A.
