# Vidcosmos — Development Status

Last updated: 11 Nov 2026 · Current focus: **F04 UI component library** (next)

This file is the single place that says where the build stands. Update it at the end of every feature, in the same commit. The plan for each feature, with its checks, is in [`docs/05-feature-plan.md`](docs/05-feature-plan.md).

**Status values:** `Not started` · `In progress` · `Blocked` · `Done` (all "Done when" checks pass and are listed under Verified).

## Progress

| Milestone | Done | Total |
| --- | --- | --- |
| M0 Foundations | 3 | 7 |
| M1 Projects and library | 0 | 3 |
| M2 Create flow | 0 | 7 |
| M3 Video | 0 | 7 |
| M4 Revisions | 0 | 1 |
| M5 Export and publish | 0 | 4 |
| M6 Account, home and admin | 0 | 4 |
| M7 Launch readiness | 0 | 3 |
| **Total** | **3** | **36** |

## Features

| ID | Feature | Milestone | Depends on | Status | Updated | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| F01 | Monorepo scaffold | M0 | — | Done | 10 Nov 2026 | TypeScript pinned to 6.0 (see Known issues) |
| F02 | Environment and configuration | M0 | F01 | Done | 11 Nov 2026 | Per-provider overrides; versioned token keys |
| F03 | Design tokens, fonts and themes | M0 | F01 | Done | 11 Nov 2026 | Tailwind 4; `/dev/tokens` |
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

### F03 Design tokens, fonts and themes · 11 Nov 2026

- `pnpm typecheck`, `pnpm lint` (now includes the colour-literal check and the theme freshness check), `pnpm test`, `pnpm test:e2e` (12: 6 tests × 1440×900 and 390×844) and `pnpm build` pass.
- Tests added:
  - `packages/config/src/tailwind-theme.test.ts`: `theme.css` matches `tokens.json`; every semantic colour is mapped; no primitives or video colours are exposed; defaults removed; breakpoints 768/1200; every radius and shadow available.
  - `packages/config/src/check-no-hex.test.ts`: finds hex, `rgb()` and `hsl()` literals; ignores ids, entities, tokens and opted-out lines; the whole repository is clean.
  - `apps/web/lib/theme.test.ts`: the inline theme script follows the system, a stored choice wins, bad values and blocked storage fall back.
  - `apps/web/components/brand/logo.test.tsx`: accessible name or hidden, brand tokens only, reversed wordmark, unique valid clip ids.
  - `apps/web/e2e/dev-tokens.spec.ts`: both theme panels with different computed grounds (slate-50, night-900) and every section; Plus Jakarta Sans, Inter and Noto Sans Devanagari load from the app's origin; system theme, then a stored choice survives reload; keyboard focus ring; reduced motion.
- Checked by hand in the browser at 1440 and 390 px, light and dark: colours, type (including Hindi), spacing, radii, per-theme shadows, logos; no horizontal scroll at 390 px. No design PNG exists for this page; checked against the design system README.
- Production: `next start` returns 404 for `/dev/tokens`; the CSS loads fonts from `/_next/static/media`.

### F02 Environment and configuration · 11 Nov 2026

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (42 tests; 37 in `apps/web`), `pnpm test:e2e` (2) and `pnpm build` pass.
- Tests added in `apps/web/lib/`:
  - `env-schema.test.ts`: the three-variable stub setup starts; each missing required variable fails with "is required but not set" and points to `.env.example`; every problem is listed at once; bad values fail with the rule (11 cases); values never appear in messages; defaults; empty means unset; live keys per provider, overrides both ways, Claude needs key and model; Google pair; renamed `TOKEN_ENCRYPTION_KEY`; versioned token keys.
  - `providers.test.ts`: in stub mode the live factory is never called; a live override picks the live factory and passes the env.
  - `env-sync.test.ts`: the schema, `.env.example` and `turbo.json` `globalEnv` list the same variables; `.env.example` parses; `.env` and `apps/web/.env` are ignored by git.
- Done-when, by hand in a clean copy with a `.env` of only `PROVIDERS`, `MONGODB_URI`, `BETTER_AUTH_SECRET`: `pnpm dev` starts, serves `/`, and a temporary route handler read the root `.env` values and defaults through `env`. With `MONGODB_URI` removed, `next dev` exited with code 1 and the message named the variable.
- CI-style run in a clean copy with no `.env` and settings only as shell variables: typecheck, lint, test and build pass; without the variables the build fails with the list of problems.
- `docker compose config` validates `compose.yaml`. Not started here: Docker Desktop was not running (see Known issues).

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
| 11 Nov 2026 | `PROVIDERS` sets every provider; optional `PROVIDERS_LLM`, `_TTS`, `_RENDER`, `_STORAGE`, `_INSTAGRAM`, `_EMAIL` override one. A provider's keys are required only when it is live (SDD §18 updated). |
| 11 Nov 2026 | Instagram token keys are `TOKEN_ENC_KEY_V1`, `_V2`, … as in DB §security; new tokens use the highest version. Replaces `TOKEN_ENCRYPTION_KEY` and `TOKEN_ENCRYPTION_KEY_VERSION` (SDD §18 updated). |
| 11 Nov 2026 | Work happens on `dev`; `main` changes only through a pull request from `dev` after a feature is tested. |
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
- **First CI run not confirmed.** `main` is pushed to `github.com/rajwantprajapati/vidcosmos`, but no Actions run had appeared when last checked, and the GitHub CLI is not signed in on this machine. Check the Actions tab, and run `gh auth login` so pull requests can be opened from here.
- **Prototype folder is empty.** `/Users/rajwant/Developer/namaste-ai/season-2/vidcosmos-prototype` has no files, but F13, F16, F18 and F20 are meant to port from it. Restore it before F13.
- **Compose MongoDB not started yet.** `compose.yaml` (mongo:8, single-node replica set `rs0`) is valid but was not run: Docker Desktop was off, and the Homebrew `mongod` already uses port 27017. Before F05, start it once and check a transaction works. The Homebrew `mongod` is probably standalone, and standalone MongoDB cannot run the transactions DB §11 needs.
- **Root `.env` changes need a restart.** Next.js reloads only `apps/web/.env*` while `pnpm dev` runs; after editing the root `.env`, restart the dev server.
- **Claude.ai originals of the docs.** SDD §18's variable table was edited here (provider overrides, token keys). The editable original on claude.ai needs the same change.
- **Fonts are not preloaded.** They load through `@font-face` in `tokens.css`, so the first paint may use the fallback for a moment. Consider `next/font/local` or preload links in F36 (performance).
- **Reduced motion is a global reset.** With `prefers-reduced-motion: reduce`, every animation and transition becomes instant (`globals.css`, `!important`). The design asks spinners to slow to a pulse and movement to become fades: F04 components that need that must define their own reduced-motion rule.
- **Theme choice is per browser.** It is stored in `localStorage` (`vc-theme`); the designs have no appearance setting, so there is no account-level choice yet.
- **Logo uses primitive tokens.** `components/brand/logo.tsx` uses `--teal-500`, `--coral-500`, `--slate-900` and `--night-50` because the logo must not change colour with the theme. It is the only place primitives are used.
- **Playwright browser.** Each machine needs `pnpm --filter @vidcosmos/web exec playwright install chromium` once; CI will need the same step when the e2e job is added (SDD §18 runs e2e against Vercel previews).
