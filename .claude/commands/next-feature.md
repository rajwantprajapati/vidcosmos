---
description: Build the next Vidcosmos feature from STATUS.md, end to end, and record it
argument-hint: "[feature ID, e.g. F06] (optional)"
---

Build one feature of Vidcosmos, following "How we work" in CLAUDE.md.

1. Read `STATUS.md`. If an ID was given ($ARGUMENTS), take that feature; otherwise take the first one that is `Not started` and whose dependencies are all `Done`. If its dependencies aren't done, or a decision it needs is still open under "Decisions needed", stop and tell me.
2. Set it to `In progress` in `STATUS.md`.
3. Read its entry in `docs/05-feature-plan.md`, every doc section it lists, and its screens in `design/screens/` (PNG and source).
4. Show me a short plan: files to add or change, tests to add, and any question the docs don't answer. Wait for my go-ahead if there is a question; otherwise continue.
5. Build only this feature, stub providers first.
6. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm test:e2e` for UI work. Fix until all pass.
7. For UI, take Playwright screenshots at 1440×900 and 390×844, compare with the design PNGs, and fix visible differences.
8. Update `STATUS.md`: status `Done`, date, the progress counts, a "Verified" entry (commands run, tests added, screenshots compared), and any follow-ups. Commit as `<ID>: <feature name>`.
9. Tell me what was built, how it was verified, and what is next.
