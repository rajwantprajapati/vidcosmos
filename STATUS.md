# Vidcosmos — Development Status

Last updated: 11 Nov 2026 · Current focus: **F07 App shell and onboarding** (next)

This file is the single place that says where the build stands. Update it at the end of every feature, in the same commit. The plan for each feature, with its checks, is in [`docs/05-feature-plan.md`](docs/05-feature-plan.md).

**Status values:** `Not started` · `In progress` · `Blocked` · `Done` (all "Done when" checks pass and are listed under Verified).

## Progress

| Milestone | Done | Total |
| --- | --- | --- |
| M0 Foundations | 6 | 7 |
| M1 Projects and library | 0 | 3 |
| M2 Create flow | 0 | 7 |
| M3 Video | 0 | 7 |
| M4 Revisions | 0 | 1 |
| M5 Export and publish | 0 | 4 |
| M6 Account, home and admin | 0 | 4 |
| M7 Launch readiness | 0 | 3 |
| **Total** | **6** | **36** |

## Features

| ID | Feature | Milestone | Depends on | Status | Updated | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| F01 | Monorepo scaffold | M0 | — | Done | 10 Nov 2026 | TypeScript pinned to 6.0 (see Known issues) |
| F02 | Environment and configuration | M0 | F01 | Done | 11 Nov 2026 | Per-provider overrides; versioned token keys |
| F03 | Design tokens, fonts and themes | M0 | F01 | Done | 11 Nov 2026 | Tailwind 4; `/dev/tokens` |
| F04 | UI component library | M0 | F03 | Done | 11 Nov 2026 | 16 components; `/dev/components` |
| F05 | Database and migrations | M0 | F02 | Done | 11 Nov 2026 | `packages/db`; `pnpm db:migrate` |
| F06 | Sign up, sign in and workspaces | M0 | F04, F05 | Done | 11 Nov 2026 | Better Auth; `/sign-in`, `/sign-up`, `/verify`, `/reset-password` |
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

### F06 Sign up, sign in and workspaces · 11 Nov 2026

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (web 134, db 100, config 19, spec 6, integrations 5) and `pnpm build` pass; `pnpm test:e2e` 81 passed, 33 skipped.
- `apps/web/e2e/auth.spec.ts` (desktop and phone):
  - **Done-when flow:** sign up → "Check your email" → open the verification link from the stub outbox → "Email confirmed" → library (showing the new "Asha's workspace") → sign out → `/library` goes to sign-in → sign in → library → sign out.
  - **Signed out:** `/library` redirects to `/sign-in`; a deeper page returns after signing in (`?next=`); a forged session cookie gets no further than sign-in; a signed-in visit to `/sign-in` goes to the library.
  - **Duplicate email:** a second account with the same email shows "An account with this email already exists. Sign in instead, or reset your password." on the email field.
  - **Form checks:** a wrong password gets a clear message; a short password is refused before sending; the switch moves between `/sign-in` and `/sign-up`.
  - **Reset password:** request a link → open it → set a new password → sign in with it; an invalid link shows the error and offers a new one.
  - **Accessibility and layout:** axe finds no violations on `/sign-in` and `/sign-up`; no sideways scroll.
- Unit tests:
  - workspace creation (`packages/db/src/workspaces.test.ts`): IST month and day keys across month and year boundaries, workspace names, default limits and defaults, one workspace under 5 racing requests;
  - the email stub and Resend sender (`packages/integrations/src/email.test.ts`);
  - safe return paths (rejects `//host`, full URLs, backslashes), error messages and account emails (`apps/web/lib/*.test.ts`).
- Checked against the local MongoDB:
  - the user gets `role`, `timeZone`, `locale`, `status` and `notificationPrefs` (as an object);
  - ids and `session.userId` are ObjectIds;
  - the duplicate sign-up returns `422 USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`;
  - `pnpm db:migrate` added Better Auth's indexes (unique email, session token, provider account).
- Screenshots compared with Playwright, pixelmatch against `SignIn.png` (1440×900) and `MobileSignIn.png` (390 px, 2×, full page, same 1469 px height): 0.23% and 0.27% of pixels differ. The remaining difference is the slowly rotating orbit (a different moment) and text anti-aliasing. Fixed from the comparison: the segmented control's track spans the form width, the check marks use the list colour, and links keep the default underline offset.
- Production build: `/api/dev/outbox` and `/dev/components` return 404; `/library` redirects to sign-in.
- Fixed after manual QA (another session): the forms showed only the first validation error and never moved focus, so screen readers announced nothing. All field errors now show at once and focus moves to the first invalid field, for client checks and server field errors (duplicate email); form-wide errors stay in a live region. Same in the reset password forms, where an expired link is now a form message with "Ask for a new link" instead of a password error. Covered by render tests (`components/auth/*.test.tsx`: empty sign-up shows three errors and focuses the name; duplicate email focuses the email field) and two e2e checks.

### F05 Database and migrations · 11 Nov 2026

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (db 90, web 95, config 19, spec 6) and `pnpm build` pass. No UI, so no e2e or screenshots.
- Database tests run on `mongodb-memory-server` (a single-node MongoDB 8.2 replica set, one fresh database per test file):
  - **Idempotent:** `migrate` on an empty database runs `0001-initial-schema`; a second run applies nothing, the schema sync plans nothing, and collections, validators, indexes and run records are unchanged (`packages/db/src/migrate.test.ts`).
  - **Recorded:** each run is stored in `migrations` with a sha256 checksum; a changed file that already ran stops the run; a lock held by another run refuses it, an expired lock is taken over, and the lock is released afterwards; new files run in order after recorded ones.
  - **Indexes:** every index in the catalogue (DB §10) exists with its options; a dropped one is recreated by the next run; an index outside the catalogue is reported, not dropped.
  - **Workspace scope** (`scoped.test.ts`): `workspaceCollection` refuses find, findOne, count, update, findOneAndUpdate, delete and aggregate when the filter has no `workspaceId` ObjectId (missing, `undefined`, a string, an operator, inside `$or` only); another workspace's ids return nothing and cannot be updated or deleted; updates may not change `workspaceId`; inserts are parsed with zod.
  - **Round trip** (`collections.test.ts`): a sample document for each of the 15 collections parses unchanged with zod, is accepted by the generated MongoDB validator, and reads back equal. The validators reject a missing required field, a wrong BSON type and a value outside an enum, and allow unknown fields.
- `pnpm db:migrate` against the local MongoDB 8.2.2: the first run applied `0001-initial-schema` (18 collections: 15 app plus Better Auth's `session`, `verification` and `rateLimit` for their TTL indexes); the second printed "nothing to change".
- Fixed on the way: `instanceof ObjectId` fails across bson's CommonJS build (loaded by the driver) and its ESM build, so ids are recognised by their BSON type (`isObjectId`), and server code takes `ObjectId` from `@vidcosmos/db`.

### F04 UI component library · 11 Nov 2026

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (web 92, config 19) and `pnpm build` pass; `pnpm test:e2e` 51 passed, 33 skipped (the preview comparisons run on the desktop project only; the phone layout test on the mobile project only).
- Render tests: one per component in `apps/web/components/ui/*.test.tsx` (Testing Library + jsdom): roles and names, variants, states (loading, invalid, selected, edited, failed, applied, stale, near limit), keyboard (arrow keys in SegmentedControl), callbacks.
- `apps/web/e2e/dev-components.spec.ts`:
  - all 16 components in both themes;
  - axe reports no violations (desktop and phone);
  - keyboard: every interactive part in the gallery (60+ stops: buttons, inputs, textarea, radios, chips, toast actions, link, scene rows, interactive card) shows the focus ring;
  - each component in each theme, alone at 960 px (`?frame=Name-theme`), compared with `design/design-system/previews/Name_theme.png` (pixelmatch): all under 0.5% different, Icon about 1% (Lucide glyphs);
  - no sideways scroll at 390 px.
- Looked at the phone layout (390 px): composer, toasts and video cards wrap without overflow.
- Production: `/dev/components` and `/dev/tokens` return 404.
- Fixed on the way: the focus ring now sits outside Tailwind's layers, so shadow utilities (selected segment, lifted card) no longer hide it; under reduced motion, transitions are switched off (`0s`) instead of shortened, which had made every element transition.

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
| 11 Nov 2026 | Sessions last 30 days, extended at most once a day (DB §3), not 7 days (SDD §14). |
| 11 Nov 2026 | Sign-up signs the person in and sends a verification link; unverified users can use the app but not generate or post (SDD §14). Better Auth only reports a duplicate email when sign-up signs in (otherwise it returns a fake success to hide which emails exist), so F06's duplicate-email message needs this; the 3-a-minute sign-up limit guards against probing. |
| 11 Nov 2026 | The duplicate-email message (no design copy): "An account with this email already exists. Sign in instead, or reset your password." |
| 11 Nov 2026 | The breach check (`haveIBeenPwned`) calls an outside service, so it runs only when email is live, never in stub mode or tests. |
| 11 Nov 2026 | `role`, `timeZone`, `locale` and `status` are Better Auth user fields; `onboarding` and `notificationPrefs` are objects the app writes itself (Better Auth would store them as JSON text). Better Auth's indexes are in the index catalogue, because its MongoDB adapter creates none. |
| 11 Nov 2026 | Collection schemas live in `packages/spec/src/collections` (`@vidcosmos/spec/collections`), as the feature plan and SDD §6 say; MongoDB code (client settings, `workspaceCollection`, index catalogue, validators, migrations) is in a new `packages/db`. DB §1/§10/§13 say `packages/db` for all of it. |
| 11 Nov 2026 | `pnpm db:migrate` runs the migration files, then syncs validators and catalogue indexes from the code, so a new field or index needs no migration file. Files are for backfills and drops; dropping an index stays a migration (DB §13). |
| 11 Nov 2026 | `social_accounts.token` is optional: DB §8 deletes the ciphertext on disconnect and keeps the row. |
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
- **Local MongoDB is standalone.** `.env` points at the Homebrew `mongod` 8.2.2 on port 27017, which is not a replica set, so the transactions in DB §11 (first needed in F20/F24) will fail there. Before then, stop it and use `docker compose up -d` (replica set `rs0`), or turn the Homebrew one into a single-node replica set. Unit tests are not affected: they use `mongodb-memory-server`.
- **Root `.env` changes need a restart.** Next.js reloads only `apps/web/.env*` while `pnpm dev` runs; after editing the root `.env`, restart the dev server.
- **Claude.ai originals of the docs.** SDD §18's variable table was edited here (provider overrides, token keys). The editable original on claude.ai needs the same change.
- **Fonts are not preloaded.** They load through `@font-face` in `tokens.css`, so the first paint may use the fallback for a moment. Consider `next/font/local` or preload links in F36 (performance).
- **Reduced motion is a global reset.** With `prefers-reduced-motion: reduce`, animations run once instantly and transitions are off (`globals.css`, `!important`); the loading spinner pulses instead. A component that needs a fade under reduced motion must opt out with a more specific rule, as `.vc-spin` does.
- **Theme choice is per browser.** It is stored in `localStorage` (`vc-theme`); the designs have no appearance setting, so there is no account-level choice yet.
- **Toast has no queue yet.** `Toast` is the visual part only. Placement (bottom-left on desktop, bottom-centre on phones), the 5 s / 10 s timing and stacking come with the first screen that shows a toast.
- **Icons are Lucide glyphs.** The design README names Lucide; the reference bundle drew its own paths, so icons differ slightly from the previews (about 1% of pixels).
- **`cn()` and font sizes.** `tailwind-merge` drops an earlier `leading-*` when a later class sets the font size; restate the line height after the size (as `PromptComposer` does).
- **Playwright browser.** Each machine needs `pnpm --filter @vidcosmos/web exec playwright install chromium` once; CI will need the same step when the e2e job is added (SDD §18 runs e2e against Vercel previews).
- **Atlas Search index not created.** `projects_search` (DB §10) can only be built on Atlas, so the index catalogue leaves it out; add it with library search (`createSearchIndex` in a migration that runs on Atlas only).
- **VideoSpec and revision operations are placeholders.** `projects.draft.spec`, `project_versions.spec` and chat proposal `operations` use top-level schemas until F16 (VideoSpec) and F25 (revisions) define them in `packages/spec`.
- **MongoDB binary download.** The first `pnpm test` on a machine downloads MongoDB (about 70 MB) into `~/.cache/mongodb-binaries`; CI caches that folder.
- **Database users not set up.** DB §13's `app`, `migrator` and `analyst` users (with no update or delete on `admin_audit`) are Atlas configuration, to do before production; CI's deploy job will run `pnpm db:migrate` with the `migrator` user.
- **Google sign-in not tried yet.** The button and Better Auth's Google provider are in place, but no `GOOGLE_CLIENT_ID` is set, so the button says Google isn't available. To try it, create an OAuth client with the redirect URI `http://localhost:3000/api/auth/callback/google` (and the production one) and set both Google variables. Linking Google to an existing password account is done from Settings (F30).
- **Terms and Privacy policy pages don't exist yet.** The sign-in page links to `/terms` and `/privacy`; write them before beta (F32/F36), together with the DPDP consent notice in SDD §14.
- **Rate limits are per IP and production-only.** Better Auth enforces sign-in 5/min, sign-up 3/min and reset 3/hour per IP (API §16 asks for reset per email) and only in production builds, so e2e doesn't exercise them. Check them on a preview deployment.
- **Live email not tried.** The Resend sender is unit-tested only; set `PROVIDERS_EMAIL=live`, `RESEND_API_KEY` and `EMAIL_FROM` (a verified domain) to try it. The designed email templates come in F31.
- **Verify and reset screens have no design.** They reuse the SignIn layout and its type. Check them with the designer.
- **E2E accounts in the local database.** Each e2e run creates a few `e2e+…@example.com` users and workspaces in the database in `.env`. They are harmless; delete them with `db.user.deleteMany({ email: /^e2e\+/ })` (and their workspaces) if they get in the way.
