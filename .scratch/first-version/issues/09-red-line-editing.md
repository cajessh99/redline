# 09: Red-line editing

**What to build:** The reader owns their rulebook. They can edit the wording of any red line (defaults included), add one of their own in plain English, delete one, and restore the default list in one action (spec stories 15–17, 19).

**Blocked by:** 08

**Status:** done (2026-11-20; tested in PGlite only)

- [x] The reader can edit any red line's title, description, and tier descriptions
- [x] The reader can add a reader-authored red line in plain English
- [x] The reader can delete any red line, and is warned that the risk it covered will no longer be flagged
- [x] "Restore defaults" rewrites the eleven product items to their shipped wording and switch state, and leaves reader-authored items untouched
- [x] Past analyses keep their stored snapshot, so editing a red line does not change an old result
