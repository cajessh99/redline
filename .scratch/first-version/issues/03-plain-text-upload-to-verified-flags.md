# 03: Tracer bullet: plain-text upload to verified flags on screen

**What to build:** A signed-in reader uploads a `.txt` contract. It is parsed and normalised in the browser, and the reader sees the extracted text before analysis (story 4). The reader types their party, and analysis runs through OpenRouter against the five default red lines (from PRD section 5, held in code for now). The reader then sees a result page of flags: each shows the red line it matched, the severity tier as a word, a plain English statement, and the exact source sentence. The document text and the analysis are stored. This is the first complete path through every layer.

**Blocked by:** 02

**Status:** done (2026-11-20; live Supabase storage not verified)

- [x] The `.txt` file is read in the browser, and only the extracted text is sent to the server. The file is never uploaded or stored
- [x] Normalisation happens once at intake (whitespace collapsed, paragraph breaks kept, typographic quotes untouched) and is idempotent. The normalised text is what is stored, shown, sent to the model, and checked against
- [x] The reader sees the extracted text before analysis runs
- [x] Analysis does not start without a party (typed role for now)
- [x] The model is called through OpenRouter from server code only. The model name is a configuration value, and the proposed default and alternatives are recorded in `QUESTIONS.md`
- [x] The prompt asks only for matches the model is certain of
- [x] Every flag on screen shows its red line, tier word, statement, and verified source sentence. Nothing unverified is ever rendered
- [x] Flag statements use no word on the banned-word list in PRODUCT.md (Brand Commitments)
- [x] The result page carries both fixed statements: "Redline shows only what it can prove. A receipt means no red line matched, not that the document is safe." and the not-legal-advice line, which says Redline makes no claim about the law where the reader lives
- [x] Document and analysis rows are stored under row-level security, owned by the reader
- [x] A model failure or a failed upload shows a clear message and stores nothing (stories 6, 57)

## Comments

2026-11-20, build run: the real-model smoke run returned 6 of 7 planted clauses, all verified (missed: non-compete Minor, the employee non-solicit). Row-level security is tested in PGlite only. Signed-out analysis stores nothing (BUILD-REPORT.md B3).
