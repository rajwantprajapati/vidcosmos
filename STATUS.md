# Vidcosmos — Development Status

Last updated: 10 Nov 2026 · Current focus: **F02 Environment and configuration** (next)

This file is the single place that says where the build stands. Update it at the end of every feature, in the same commit. The plan for each feature, with its checks, is in [`docs/05-feature-plan.md`](docs/05-feature-plan.md).

**Status values:** `Not started` · `In progress` · `Blocked` · `Done` (all "Done when" checks pass and are listed under Verified).

## Progress

| Milestone | Done | Total |
| --- | --- | --- |
| M0 Foundations | 1 | 7 |
| M1 Projects and library | 0 | 3 |
| M2 Create flow | 0 | 7 |
| M3 Video | 0 | 7 |
| M4 Revisions | 0 | 1 |
| M5 Export and publish | 0 | 4 |
| M6 Account, home and admin | 0 | 4 |
| M7 Launch readiness | 0 | 3 |
| **Total** | **1** | **36** |

## Features

| ID | Feature | Milestone | Depends on | Status | Updated | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| F01 | Monorepo scaffold | M0 | — | Done | 10 Nov 2026 | TypeScript pinned to 6.0 (see Known issues) |
| F02 | Environment and configuration | M0 | F01 | Not started | | |
| F03 | Design tokens, fonts and themes | M0 | F01 | Not started | | |
| F04 | UI component library | M0 | F03 | Not started | | |
| F05 | Database and migrations | M0 | F02 | Not started | | |
| F06 | Sign up, sign in and workspaces | M0 | F04, F05 | Not started | | |
| F07 | App shell and onboarding | M0 | F06 | Not started | | |
| F08 | Projects API | M1 | F05, F06 | Not started | | |
| F09 | Library screen | M1 | F07, F08 | Not started | | |
| F10 | Usage and limits (read side) | M1 | F08 | Not started | | |
| F11 | Jobs and background functions | M2 | F08 | Not started | | |
| F12 | Storage (Cloudflare R2) | M2 | F02 | Not started | | |
| F13 | LLM providers and moderation | M2 | F11 | Not started | | |
| F14 | New video: idea and angles | M2 | F09, F13 | Not started | | Needs decision D1 |
| F15 | Script | M2 | F14 | Not started | | |
| F16 | Video spec schema and template contracts | M2 | F05 | Not started | | Can run beside F11–F15 |
| F17 | Storyboard | M2 | F15, F16 | Not started | | |
| F18 | Remotion package and first 4 templates | M3 | F16 | Not started | | Can start after F16 |
| F19 | The other 8 templates | M3 | F18 | Not started | | |
| F20 | Narration and generate video | M3 | F12, F17, F18 | Not started | | |
| F21 | Editor: live preview | M3 | F20 | Not started | | |
| F22 | Autosave, edit lease and offline | M3 | F21 | Not started | | |
| F23 | Manual scene editing | M3 | F21 | Not started | | |
| F24 | Versions and undo | M3 | F21 | Not started | | |
| F25 | Chat revisions | M4 | F23, F24 | Not started | | |
| F26 | Export and downloads | M5 | F21 | Not started | | |
| F27 | Connect Instagram | M5 | F07 | Not started | | Needs the Meta app |
| F28 | Post now and schedule | M5 | F26, F27 | Not started | | |
| F29 | Token refresh and post reconciliation | M5 | F28 | Not started | | |
| F30 | Settings and account deletion | M6 | F27 | Not started | | |
| F31 | Notifications and email | M6 | F20, F28 | Not started | | |
| F32 | Marketing home page | M6 | F04 | Not started | | Can be done any time after F04 |
| F33 | Admin console | M6 | F20 | Not started | | |
| F34 | Monitoring and cleanup jobs | M7 | F28 | Not started | | |
| F35 | Full end-to-end and failure suite | M7 | F34 | Not started | | |
| F36 | Accessibility, performance, security and beta | M7 | F35 | Not started | | |

## Verified

For each finished feature, list how it was checked: commands run, tests added, screenshots compared, live runs. Newest first.

### F01 Monorepo scaffold · 10 Nov 2026

- From a clean export of the git index: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all pass.
- `pnpm test`: 6 Vitest files, 6 tests (one sample test in each of `packages/config`, `spec`, `video`, `pipeline`, `integrations` and `apps/web`).
- `pnpm test:e2e`: `apps/web/e2e/home.spec.ts` passes at 1440×900 and 390×844; it starts `pnpm dev`, so the dev server serving the placeholder page is checked too.
- Packages stay pure: an import from `apps/` inside `packages/spec` fails ESLint (`no-restricted-imports`); checked with a throwaway file.
- `.github/workflows/ci.yml` runs install, typecheck, lint, test and build (not run on GitHub yet: no remote). `vercel.json` sets `regions: ["bom1"]`.
- No design screens for this feature; the placeholder page is unstyled until F03 and F32.

## Decisions needed

| ID | Question | Needed by | Recommendation | Decision |
| --- | --- | --- | --- | --- |
| D1 | Where to store the video type chosen in step 1 (explainer, product ad, story, travel, quote, music visual) | F14 | Add `idea.videoType` to the project, the API and the LLM prompts; keep `idea.goal` for explain/teach/summarise/promote | Open |
| D2 | Captions burned into the video, a separate SRT, or both | F26 | Both: burned in by default (with a "None" caption style to turn off), SRT always available | Open |
| D3 | Default usage limit for beta (20 videos a month) | F36 | Keep 20; revisit after the first 2 beta weeks | Open |

## Decision log

Decisions already made, newest first. Details are in the docs.

| Date | Decision |
| --- | --- |
| 10 Nov 2026 | Three video formats in V1: 9:16 (default), 16:9, 1:1. Stored in the spec; `setFormat` keeps narration (DB §6). |
| 10 Nov 2026 | Vidcosmos is for any kind of AI video; explainers ship first. |
| 10 Nov 2026 | Brand: Lagoon Classic (light) and Lagoon Night (dark); Plus Jakarta Sans, Inter, Noto Sans Devanagari. |
| 10 Nov 2026 | Full app works on phones: bottom tab bar under 768 px; admin is desktop-only. |
| 10 Nov 2026 | Gemini is the default LLM; Claude through the same interface (`LLM_PROVIDER`). |
| 10 Nov 2026 | Live preview in the Remotion Player; MP4 rendered only on export, in Vercel Sandbox. |
| 10 Nov 2026 | V1 visuals: icons, diagrams, charts, kinetic text (12 templates); AI illustrations and stock in V2. |
| 9 Nov 2026 | ElevenLabs is the only voice provider, for English and Hindi. |

## Long-lead items (parallel track)

| Item | Why it matters | Status |
| --- | --- | --- |
| Meta developer app, tester Instagram account | Needed for F27 and F28 | Not started |
| Meta App Review submission | Needed before real users can post (F36) | Not started |
| Domain and Instagram handle | Email sending, OAuth redirect, launch | Not started |
| ElevenLabs voices: pick and audition male and female in Hindi | F20 quality | Shortlisted: Ani (male), Rishika (female) |
| Licensed music library | F20 music bed, launch licensing | Not started |
| Prototype batch with real keys (15 topics) | Confirms cost and render time per video | Waiting for keys |

## Known issues and follow-ups

- **TypeScript 6.0, not 7.** `typescript-eslint` 8.72 supports TypeScript `<6.1`, so the repo pins `typescript@6.0.3`. Move to 7 when typescript-eslint supports it.
- **ESLint 9.** ESLint 9.39 is marked deprecated in favour of 10; kept on 9 because `eslint-config-next` 16 pulls in React plugins that are tested on 9. Revisit with the next Next.js upgrade.
- **No git remote.** The CI workflow has not run on GitHub yet. Add the remote and check the first run.
- **Prototype folder is empty.** `/Users/rajwant/Developer/namaste-ai/season-2/vidcosmos-prototype` has no files, but F13, F16, F18 and F20 are meant to port from it. Restore it before F13.
- **Playwright browser.** Each machine needs `pnpm --filter @vidcosmos/web exec playwright install chromium` once; CI will need the same step when the e2e job is added (SDD §18 runs e2e against Vercel previews).
