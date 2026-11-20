# 08: Stored red lines: view and switch

**What to build:** Each reader has their own stored list of red lines, seeded at first sign-in with the five default red lines (on) and six offered red lines (off), word for word from PRD section 5. The reader can read what each one matches and what makes a match Severe, Moderate, or Minor, and switch any of them on or off. Analysis uses exactly the enabled red lines, and the result shows which red lines were checked (spec stories 11–14, 18, 20, 31, D4, D6).

**Blocked by:** 03

**Status:** done (2026-11-20; tested in PGlite only)

- [x] A new reader's list is seeded once with the 5 defaults on and the 6 offered off, worded exactly as in PRD section 5
- [x] Each red line has a title, a description of what matches, a description for each tier, an enabled switch, and a kind (default, offered, or reader-authored)
- [x] The reader can view each red line's tier descriptions
- [x] Switching a red line off warns the reader that the risk it covers will no longer be flagged
- [x] Red lines persist across sessions and are owned by the reader under row-level security
- [x] Analysis uses the reader's enabled red lines, replacing the set held in code from ticket 03
- [x] A snapshot of the enabled red lines is stored with each analysis, and the result page lists what was checked
