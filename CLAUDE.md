# Vidcosmos

Vidcosmos is an AI video studio: a person describes a video, and Vidcosmos writes the script, plans the scenes, records an Indian narrator in English or Hindi, animates every scene to the spoken word, and posts the result to Instagram. Tagline: "A universe of videos, made by AI." Explainers ship first; the product covers any kind of short AI video.

## Where things are

| Path | What it is |
| --- | --- |
| `STATUS.md` | **Read first.** Where the build stands, the current feature, open decisions. Update it at the end of every feature. |
| `docs/05-feature-plan.md` | The 36 features in build order, each with scope, doc references, design screens and "Done when" checks. |
| `docs/01-prd.md` | What we are building and why: flows, functional requirements, edge cases. |
| `docs/02-system-design.md` | How it is built: architecture, stack, repository layout, pipeline, rendering, Instagram, storage, security, testing. |
| `docs/03-database-design.md` | Every MongoDB collection, field, index and consistency rule; the `VideoSpec`. |
| `docs/04-api-design.md` | Every `/api/v1` endpoint with request and response types, errors, jobs, events, limits. |
| `design/screens/desktop/`, `design/screens/mobile/` | PNGs of every screen. What the UI must look like. |
| `design/screens/source/` | The source of each screen (HTML with inline styles and copy). Read it for exact text, spacing, sizes and states. It does not run on its own. |
| `design/design-system/` | Tokens (`tokens.json`, `tokens.css`), fonts, logos, and the 16 reference components (`components/<Name>/README.md`, `index.d.ts`, `bundle.js`). |
| `/Users/rajwant/Developer/namaste-ai/vidcosmos-prototype` | The working pipeline prototype (spec schema, LLM step, ElevenLabs, timing, Remotion templates). Port from it; don't rewrite what works. |

When documents disagree: the PRD's "Revised 10 Nov" notes and the decision log in `STATUS.md` are newest, then DB and API, then the System Design. The route names in the feature plan's route map win over SDD §4. For how things look, the design screens win. If a conflict changes behaviour, ask before building.

## How we work: one feature at a time

**Branches:** all work happens on `dev`. Nobody commits to `main` directly; `main` only changes through a pull request from `dev`, opened once a feature is built and tested.

**Review before commit:** nothing is committed or pushed until the user has reviewed the changes and said to. Finish a feature with the changes left uncommitted on `dev`, summarise them, and wait. This applies to every commit, not only feature commits.

0. Switch to `dev` and bring it up to date (`git switch dev && git pull`).
1. Open `STATUS.md` and take the first feature that is `Not started` and whose dependencies are `Done`, unless told otherwise. Set it to `In progress`.
2. Read its entry in `docs/05-feature-plan.md`, the doc sections it lists, and its design screens.
3. Write a short plan (files, tests, questions). If a decision is missing (see "Decisions needed" in `STATUS.md`), stop and ask.
4. Build only that feature. Nothing from later features, no speculative abstractions.
5. Add the tests the feature names. Run `pnpm typecheck`, `pnpm lint`, `pnpm test` (and `pnpm test:e2e` for UI features). All must pass.
6. For UI: screenshot the page with Playwright at 1440×900 and 390×844 and compare with the PNGs in `design/screens/`. Fix differences in layout, spacing, type and colour.
7. Update `STATUS.md`: status `Done`, date, a "Verified" entry listing what was run and checked, follow-ups under "Known issues". Leave the changes uncommitted and ask the user to review them.
8. After the user approves, commit on `dev` with a message starting with the feature ID, e.g. `F06: sign up, sign in and workspaces`, and push `dev`.
9. Once CI passes on `dev`, open a pull request from `dev` to `main` titled with the same message (ask first). Merge only after its checks pass.

Never mark a feature `Done` with failing checks. If something blocks it, set `Blocked` and say why in Notes.

## Rules

- **Secrets:** API keys live only in `.env` (git-ignored). Never commit secrets, never print them, never overwrite an existing `.env`. Add new variables to `.env.example` and to the zod schema in `env.ts`.
- **Stub first:** every external call (LLM, ElevenLabs, render, R2, Instagram, email) goes through an interface with a stub. `PROVIDERS=stub` must run the whole app with no keys and no cost. Tests never call paid APIs.
- **One contract:** types and validation come from zod schemas in `packages/spec`, shared by the API, jobs, LLM output and the UI. No duplicate type definitions.
- **Ownership:** every app query is filtered by `workspaceId` through the typed collection helper. A missing record and someone else's record both return 404.
- **Packages stay pure:** `packages/*` never import from `apps/`.
- **TypeScript strict**, no `any` without a comment saying why.
- **Region:** Vercel `bom1`, Atlas Mumbai; times shown in the user's time zone (default IST), stored in UTC.

## Design rules (from `design/design-system/README.md`)

- Use semantic tokens (`--bg`, `--surface`, `--ink`, `--brand`, `--on-brand`, …), never hex values or primitive tokens in components.
- Teal `brand` is the one thing to do next: one primary button per view, its label is `on-brand` (ink), never white.
- Coral `highlight` only marks the spoken word in captions and, at most once per screen, one word in a marketing headline. Never for status.
- Status uses `success`, `warning`, `danger`, `info` with a word or icon, never colour alone.
- Plus Jakarta Sans for headings, Inter for everything people read or operate, Noto Sans Devanagari for Hindi (`hi-` styles). Tabular figures for durations and counters.
- Sentence case everywhere; buttons start with a verb; no emoji in the UI.
- Focus ring on `:focus-visible`: `box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--focus-ring)`.
- Under 768 px the sidebar becomes the bottom tab bar, create steps become full screens with a sticky bottom button, and the editor chat becomes a bottom sheet.
- Respect `prefers-reduced-motion`.

## Commands

Node 24 (`.nvmrc`), pnpm 10 (`packageManager` in `package.json`). Run from the repository root; Turborepo runs each task in every workspace that has it.

| Command | What it does |
| --- | --- |
| `pnpm install` | Install all workspaces |
| `pnpm dev` | Next.js dev server for `apps/web` on http://localhost:3000 |
| `pnpm build` | Production build (`next build`) |
| `pnpm typecheck` | `tsc --noEmit` in every package; `next typegen` first in `apps/web` |
| `pnpm lint` | `prettier --check .`, the colour-literal check (no hex, `rgb()` or `hsl()` in `apps/` or `packages/`), the Tailwind theme freshness check, then ESLint in every package |
| `pnpm tokens` | Regenerate `packages/config/tailwind/theme.css` from `design/design-system/tokens.json` |
| `pnpm format` | Rewrite files with Prettier |
| `pnpm test` | Vitest unit tests in every package |
| `pnpm db:migrate` | Run migrations and sync validators and indexes on `MONGODB_URI` (root `.env`); safe to run again |
| `docker compose up -d` | Local MongoDB 8 as a single-node replica set on port 27017 (`compose.yaml`); `docker compose down` stops it |
| `pnpm test:e2e` | Playwright in `apps/web/e2e` at 1440×900 and 390×844; starts `pnpm dev` if nothing is on port 3000. First run: `pnpm --filter @vidcosmos/web exec playwright install chromium` |

Settings: one `.env` at the repository root (copy `.env.example`). `apps/web/env.ts` validates it at start-up; server code imports `env` from `@/env` and never reads `process.env` directly. A new variable goes in `lib/env-schema.ts`, `.env.example` and `globalEnv` in `turbo.json` (a test checks all three). External services are picked with `selectProvider` in `apps/web/lib/providers.ts`.

Styling: Tailwind 4 with the design tokens only. Colours are semantic classes (`bg-surface`, `text-ink-muted`, `border-line`, `bg-brand text-on-brand`); type uses the design classes (`h1`, `body`, `label`, `overline`, `hi-body`, …); radii `rounded-md`/`lg`/`xl`; shadows `shadow-sm`/`md`/`lg`; `max-w-content`, `max-w-reading`; breakpoints `md` (768) and `lg` (1200). Tailwind's default palette is removed. `/dev/tokens` shows everything in both themes (dev only). Theme: `data-theme` on `<html>`, set by `lib/theme.ts`.

Database: collection schemas are in `@vidcosmos/spec/collections`; `@vidcosmos/db` has the client settings, the index catalogue and migrations. App code gets the database from `getDb()` in `lib/db.ts` and queries through `workspaceCollection(db, name)`, which refuses any filter without the session's `workspaceId`; `systemCollection` is only for crons, sweepers, admin and migrations. Create ids with `ObjectId` from `@vidcosmos/db`. A new field or index needs no migration file (`db:migrate` syncs them); backfills and drops do (`packages/db/src/migrations`). Run `pnpm db:migrate` after pulling changes that add indexes, before running the app or e2e tests. Project rules (create, list, PATCH rules, lease, draft, Trash) live in `packages/db/src/projects.ts` and throw `ProjectError`, which `apiRoute` turns into the API error envelope.

Auth: Better Auth in `lib/auth.ts` (server only), `authClient` from `lib/auth-client.ts` in the browser. Server pages call `requireSession(path)` from `lib/session.ts`, which returns the user and their workspace or redirects to sign-in; `proxy.ts` sends visitors without a session cookie away from the app routes listed in `lib/auth-routes.ts`. With the stub email provider, verification and reset links appear in the server log and at `/api/dev/outbox?to=<email>` (development only).

App pages live in `app/(app)/`, whose layout adds the shell (sidebar on desktop, top bar and tab bar under 768 px), checks the session and sends users who haven't finished or skipped onboarding to `/onboarding`. `/api/v1` route handlers are wrapped in `apiRoute` from `lib/api.ts` (session, Origin check, error envelope) and read bodies with `readJson(request, schema)`; request and response schemas and their mappers are in `@vidcosmos/spec/api`.

Components: the 16 design-system components are in `apps/web/components/ui` (import from `@/components/ui`; merge classes with `cn()`). Build screens from them, not from raw elements. `/dev/components` shows each with its preview examples in both themes; `/dev/components?frame=Button-light` shows one frame alone for comparison with `design/design-system/previews`.

Jobs (F11): slow work is an Inngest function in `apps/web/inngest/functions/`, built by a factory that takes a `JobStore` (`inngest/job-store.ts`) so `@inngest/test` can run it against an in-memory store; register it in `inngest/index.ts` (served at `/api/inngest`). Event data schemas live in `@vidcosmos/spec/events`, event types in `inngest/events.ts`. Routes create the job with `createJob` from `@vidcosmos/db` (one running job per project, concurrent-jobs limit), then `startedResponse` from `lib/jobs.ts` sends the start event (a job still queued gets it again from `resendIfWaiting` when read or replayed); steps write through `startJob`/`advanceJob`/`finishJob`, which are conditional on the job still running. `pnpm inngest` runs the Inngest Dev Server on 127.0.0.1:8288; `/dev/jobs` starts a demo job (development only). `components/jobs/job-progress.tsx` shows a job and polls it.

Storage (F12): files go through `getStorage()` from `lib/storage.ts`, an `ArtifactStore` from `@vidcosmos/integrations`: R2 when storage is live, files in `apps/web/.storage/` served by `/api/dev/storage` with the stub. Build keys only with the helpers in `packages/integrations/src/storage/keys.ts` (`narrationKey`, `exportKey`, `thumbnailKey`, `musicKey`), and hand out files only as signed URLs with a lifetime from `urlLifetimes`. Narration assets are found by `narrationHash` (`findAsset`, `recordAsset`, `touchAssets` in `@vidcosmos/db`). `/dev/storage` shows a stored image and audio clip (development only).

LLM (F13): every model call goes through an `LlmProvider` from `@vidcosmos/pipeline` (Gemini, Claude or the stub), got with `getLlm("main" | "small")` from `lib/llm.ts`. Ask for JSON with `callStructured` (a zod schema, up to 3 attempts with the problems fed back) and pass `onAttempt: recordLlmUsage(scope, operation)`, so each attempt becomes a priced usage event (`pricing.ts`). Moderate what people type with `requireAllowed(scope, inputs)` from `lib/moderation.ts` (422 `CONTENT_BLOCKED`; lets the request through when moderation is unavailable). The stub answers by output name: add a handler with `createStubLlm({ submit_x: … })` when a feature adds a new call. `pnpm check:llm` runs a live check (it skips without a key).

Added by later features: `pnpm video:studio` and `pnpm video:stills` (F18), `pnpm check:llm` (F13).
