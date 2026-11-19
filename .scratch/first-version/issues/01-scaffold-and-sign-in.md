# 01: Scaffold the app with sign-in working end to end

**What to build:** A deployed Next.js app on Vercel where a reader can sign up, sign in, and sign out with an email address through Supabase (spec stories 52–53). This lays the ground every later ticket builds on: a working test runner, the OpenRouter key read only on the server, and row-level security in place from the first table.

**Blocked by:** None. Needs the owner's approval of dependencies first (Next.js and React, the Supabase client and its Next.js helpers, a test runner). Propose each by name with its reason, per CLAUDE.md.

**Status:** needs-info

- [ ] Owner has approved each dependency by name before it is installed
- [ ] A reader can sign up and sign in with an email address
- [ ] Signing out ends the session everywhere, and no document page is reachable afterwards
- [ ] Row-level security is enabled, so a reader can read and write only their own rows
- [ ] The OpenRouter key lives in `.env.local` (gitignored), is read only in server code, and does not appear in the browser bundle
- [ ] The test runner runs with one command, and one passing test exists
- [ ] The app deploys to Vercel, and the build is green
- [ ] No secret appears in staged files at commit
