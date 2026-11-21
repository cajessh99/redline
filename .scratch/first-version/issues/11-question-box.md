# 11: Question box

**What to build:** On a document's page, the reader types a question and gets an answer from the document only, from their party's side. Every answer cites a sentence shown word for word and verified as an exact match. Where the document does not contain the answer, including "is this normal" or "is this enforceable where I live", the answer is "the document does not say". Questions and answers are kept with the document (spec stories 36–41, T6).

**Blocked by:** 03

**Status:** done (2026-11-20)

- [x] The boundary exposes an answer call taking a document text, a party, and a question
- [x] Every shown answer carries a cited sentence that passed the exact-match check
- [x] An answer with no citation, or a citation that fails after one regeneration, is shown as "the document does not say"
- [x] The prompt confines answers to the document and to the reader's party's side
- [x] Questions, answers, and citations are stored with the document and shown when it is reopened
- [x] Tested with the fake model client: a verified answer, a missing citation, and a misquoted citation
