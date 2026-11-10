# Vidcosmos — Feature Plan (V1)

10 Nov 2026 · build order for Claude Code, one feature at a time

V1 is built as 36 small features in 8 milestones. Each one ends in something you can run, see or test. A feature is **done** only when its checks pass and `STATUS.md` says so. Work moves in this order unless a feature's dependencies say otherwise.

**Abbreviations:** PRD = `docs/01-prd.md`, SDD = `docs/02-system-design.md`, DB = `docs/03-database-design.md`, API = `docs/04-api-design.md`. The design screens are in `design/screens/` (desktop and mobile PNGs, plus the source files with exact copy and spacing).

## How a feature is built

1. **Read.** Read the feature below, then the doc sections and screens it lists.
2. **Plan.** Write a short plan in the pull request or the commit body: the files to touch, the tests to add, and any question the docs don't answer. When a question changes behaviour, stop and ask.
3. **Build.** Build the smallest version that meets "Done when". Nothing from later features.
4. **Test.** Add the automated tests named in the feature. `pnpm typecheck`, `pnpm lint` and `pnpm test` must pass.
5. **Look.** For UI, take Playwright screenshots at 1440 px and 390 px wide and compare them with the design screens. Fix visible differences in layout, spacing, type and colour.
6. **Record.** Update `STATUS.md`: the status, the date, what was verified, and any follow-ups. Then commit.

**Stub first.** Every AI, voice, render, storage and Instagram call sits behind an interface with a `stub` implementation (`PROVIDERS=stub`). So every feature can be built and tested without API keys or cost. Live providers are switched on and checked separately.

## Milestones at a glance

| Milestone | Features | What you can do at the end |
| --- | --- | --- |
| M0 Foundations | F01–F07 | Run the app, sign up, sign in and finish onboarding, in a shell that matches the designs on desktop and phone |
| M1 Projects and library | F08–F10 | Create, list, rename, duplicate, delete and restore videos; see usage |
| M2 Create flow | F11–F17 | Go from an idea to angles, a script and a validated storyboard, with real or stub AI |
| M3 Video | F18–F24 | Generate narration, preview the video live in the editor in any format, change scenes by hand, undo |
| M4 Revisions | F25 | Change the video by chatting, with a proposal you approve |
| M5 Export and publish | F26–F29 | Download an MP4 and post or schedule it to Instagram |
| M6 Account, home and admin | F30–F33 | Settings, notifications and email, the marketing home page, the admin console |
| M7 Launch readiness | F34–F36 | Monitoring, cleanup jobs, the full end-to-end suite, accessibility and load checks |

## M0 Foundations

### F01 Monorepo scaffold
- **Goal:** an empty, working monorepo that every later feature builds on.
- **Scope:** git repository; pnpm workspaces and Turborepo; `apps/web` (Next.js App Router, TypeScript strict); `packages/spec`, `packages/video`, `packages/pipeline`, `packages/integrations`, `packages/config` (empty, with `index.ts` and a sample test); ESLint, Prettier, Vitest, Playwright; root scripts `dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`; GitHub Actions workflow for typecheck, lint, test and build; `vercel.json` with region `bom1`.
- **Docs:** SDD §3 (stack, repository layout), SDD §18 (deployment pipeline).
- **Done when:** `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass from a clean clone; `pnpm dev` serves a placeholder page; the CI workflow file runs the same commands.

### F02 Environment and configuration
- **Goal:** the app refuses to start with a missing or bad setting, and can run with no keys at all.
- **Scope:** `env.ts` zod schema for every variable in SDD §18; `.env.example` kept in sync; `PROVIDERS=stub|live`; a provider registry that returns stub implementations in stub mode; Docker Compose with `mongo:8` for local development.
- **Docs:** SDD §18 (environments, environment variables).
- **Done when:** unit tests show a missing required variable fails with a clear message; with only `MONGODB_URI`, `BETTER_AUTH_SECRET` and `PROVIDERS=stub` set, `pnpm dev` starts; `.env` is ignored by git.

### F03 Design tokens, fonts and themes
- **Goal:** the Vidcosmos look is available to every page.
- **Scope:** import `design/design-system/tokens.css` (or generate it from `tokens.json`); map tokens to Tailwind theme values that point at the CSS variables; self-host the fonts in `design/design-system/fonts`; light and dark theme through `data-theme`; `prefers-reduced-motion` respected; the logo SVGs as React components.
- **Docs:** `design/design-system/README.md` (colour, type, spacing, states, motion).
- **Done when:** a `/dev/tokens` page shows colours, type styles, spacing and radii in both themes; Plus Jakarta Sans, Inter and Noto Sans Devanagari load from the app's own origin; no hex colours outside the token files (lint rule or grep check in CI).

### F04 UI component library
- **Goal:** the 16 design-system components exist as typed React components.
- **Scope:** port Button, Icon, TextField, SegmentedControl, Chip, Badge, ProgressBar, Toast, Card, Logo, PromptComposer, VideoCard, SceneRow, ChatMessage, ProposalCard and UsageMeter from `design/design-system/components` (behaviour and props from each component README and `index.d.ts`) into `apps/web/components/ui`. Use Radix primitives where shadcn/ui would, styled only with tokens. Add a `/dev/components` gallery.
- **Docs:** each component's `README.md`; previews in `design/design-system/previews`.
- **Done when:** the gallery matches the component previews in light and dark; keyboard focus rings show on every interactive part; an axe check of the gallery reports no violations; each component has a render test.

### F05 Database and migrations
- **Goal:** a typed MongoDB layer that every feature uses the same way.
- **Scope:** one cached `MongoClient`; zod schemas for app collections in `packages/spec`; a typed collection helper that adds the `workspaceId` filter; `pnpm db:migrate` creating indexes and validators from DB §10 and recording runs in `migrations`; `mongodb-memory-server` test setup.
- **Docs:** DB §1, §10, §13; SDD §6.
- **Done when:** `pnpm db:migrate` is idempotent (running it twice changes nothing); a test proves a query without `workspaceId` is refused by the helper; collection schemas compile and round-trip sample documents.

### F06 Sign up, sign in and workspaces
- **Goal:** people can create an account and get their own workspace.
- **Scope:** Better Auth with the MongoDB adapter; email and password with email verification, and Google sign-in; reset password; `user` extra fields (role, time zone, locale, onboarding, notificationPrefs); a workspace created on sign-up with default limits and defaults (`format: '9:16'`); route protection for app pages; the Sign in and Create account screen. In stub mode, verification and reset emails are written to the server log instead of being sent.
- **Docs:** API §4; DB §3, §4; SDD §14 (authentication).
- **Design:** `SignIn.png`, `MobileSignIn.png`.
- **Done when:** Playwright: sign up → open the logged verification link → sign in → reach the app → sign out; a signed-out visit to `/library` redirects to sign-in; a second sign-up with the same email fails with the designed message; the page matches the design at 1440 and 390 px.

### F07 App shell and onboarding
- **Goal:** the frame every app screen sits in, and the first-run questions.
- **Scope:** desktop sidebar (New video, Library, Posts, Settings, usage meter, profile); mobile bottom tab bar (Library, New video, Posts, Settings) below 768 px; top bar; empty placeholder pages for each route (route map below); the onboarding screen (what you make, topic area, narration language, default narrator) writing `user.onboarding` and `workspace.defaults`; first sign-in goes to onboarding, later sign-ins go to the library.
- **Docs:** API §4 (`PUT /me/onboarding`); SDD §4 (routes; see the route map below for the names used in the designs).
- **Design:** `AppSidebar.png`, `MobileTabBar.png`, `Onboarding.png`.
- **Done when:** the sidebar and tab bar match the designs; every route in the route map loads its placeholder; onboarding saves and redirects, and "Skip for now" works; screenshots at 1440 and 390 px.

## M1 Projects and library

### F08 Projects API
- **Goal:** the server side of a video project, safe for concurrent edits.
- **Scope:** `POST/GET/PATCH/DELETE /api/v1/projects`, restore, list with filters (stage, format, language, `q`, trash) and cursor paging; the error envelope and codes; idempotency keys; `rev` checks on draft writes; the edit lease (acquire, renew, release, takeover); moderation of text fields stubbed as "allow" until F13.
- **Docs:** API §1, §2, §3, §5; DB §5 (projects), §11.
- **Done when:** database tests cover ownership (another workspace gets 404), `409 REV_CONFLICT`, `423 LEASE_HELD`, idempotent create, soft delete and restore, and every list filter; responses match the API types in `packages/spec`.

### F09 Library screen
- **Goal:** the home screen of the app.
- **Scope:** "Start a new video" prompt box (creates a project and opens step 1 with the text as the topic); video grid with VideoCards (stage, length, format shape, thumbnail placeholder); filter chips with counts; search; rename, duplicate, delete and Trash; the empty state for a new user; the mobile layout.
- **Docs:** PRD F6; API §5.
- **Design:** `Library.png`, `MobileLibrary.png`.
- **Done when:** Playwright creates, renames, duplicates, deletes and restores a project; filters and search change the grid; the empty state shows for a new account; screenshots match at 1440 and 390 px.

### F10 Usage and limits (read side)
- **Goal:** people always see how many videos they have left.
- **Scope:** `GET /me` usage block; the IST month rollover; UsageMeter in the sidebar, the library and settings; limit-reached state (Generate disabled with the reset date). Reserve, commit and release come in F20.
- **Docs:** API §3 (Usage), DB §4, §11 (usage reservation); SDD §15.
- **Done when:** unit tests cover the month key in IST across a month boundary; the meter shows `used of limit · resets <date>`; a workspace at its limit sees the limit state.

## M2 Create flow (AI text steps)

### F11 Jobs and background functions
- **Goal:** slow work runs in the background, survives refreshes and shows progress.
- **Scope:** Inngest client and `/api/inngest`; the `jobs` collection; one running job per project; `GET /jobs/:id`, list, cancel and retry; a demo function with fake steps; a progress component that polls every 1.5 s and survives a page reload.
- **Docs:** API §11; DB §7 (jobs); SDD §8.
- **Done when:** with the Inngest Dev Server, the demo job moves through its stages in the UI; reload shows the same job; cancel stops it; `@inngest/test` covers retry and cancel; starting a second job on the same project returns `409 JOB_IN_PROGRESS`.

### F12 Storage (Cloudflare R2)
- **Goal:** files go to one place, with short-lived signed links.
- **Scope:** `ArtifactStore` interface in `packages/integrations`; R2 implementation (S3 API, presigned GET and PUT); a local filesystem stub for `PROVIDERS=stub`; the key layout; `assets` collection helpers (content hash, `lastUsedAt`).
- **Docs:** SDD §12; DB §7 (assets, R2 layout).
- **Done when:** unit tests for key building and hashing; an integration test (skipped without R2 keys) puts, signs and gets a file; the stub serves files to the browser in dev.

### F13 LLM providers and moderation
- **Goal:** one way to call an LLM, whichever provider is set.
- **Scope:** `LlmProvider` with Gemini (default), Claude and stub implementations, ported from the prototype; schema-constrained JSON from zod; retry with the validation errors fed back (up to 3 attempts); `usage_events` with tokens and cost; the moderation check with the small model, writing `moderation_events`.
- **Docs:** SDD §8 (LLM providers), §15 (moderation, cost tracking); DB §4.
- **Done when:** unit tests with mocked HTTP for both providers (request shape, retry with feedback, cost recorded); `pnpm check:llm` runs a live check when a key is present and skips cleanly when not; a blocked topic returns `422 CONTENT_BLOCKED`.

### F14 New video: idea and angles (step 1)
- **Goal:** step 1 of the create flow.
- **Scope:** the New video screen: topic, notes, video type chips, format, length, language, narrator, tone and audience; `suggestIdeas` function (5–10 angles with hooks); pick an angle or "Use my idea"; the step indicator; autosave of the step.
- **Docs:** PRD F2, M1; API §6 (ideas); SDD §8 (functions).
- **Design:** `NewVideo.png`, `MobileNewVideo.png`, `Stepper.png`.
- **Decision needed first:** where the video type is stored (`STATUS.md`, decision D1).
- **Done when:** with stub AI, Playwright fills step 1, gets angles, picks one and lands on step 2; settings persist after reload; screenshots match at 1440 and 390 px.

### F15 Script (step 2)
- **Goal:** a script sized to the chosen length that people can edit.
- **Scope:** `writeScript` function (length check ±10%, one retry); script editor with live word count, estimated duration and the "Fits 60 s" badge; rewrite chips (shorter, longer, simpler, more engaging, custom); the overwrite question when the user has edited; stale flags when step 1 changes.
- **Docs:** PRD M2; API §6 (script); DB §5 (`script`, `stageHashes`).
- **Design:** `Script.png`, `MobileScript.png`.
- **Done when:** unit tests for word count and duration estimate in English and Hindi; Playwright writes, edits and rewrites a script with stub AI; editing the idea marks the script stale.

### F16 Video spec schema and template contracts
- **Goal:** the single data contract for a video, shared by AI, editor, preview and render.
- **Scope:** `VideoSpec` zod schema in `packages/spec` with `format`, theme, voice, music and scenes; content schemas and limits for all 12 templates; semantic checks (triggers appear in narration in order, scene count, total length, narration matches the script); `specHash`; `migrateSpec()` reading prototype specs without `format` as `'9:16'`; typed revision operations (`updateScene`, `addScene`, `removeScene`, `moveScene`, `setFormat`, `setTheme`, `setVoice`, `setMusic`, `rewriteAll`) with `applyOperations`.
- **Docs:** DB §6 (VideoSpec, formats, templates, rules); SDD §7, §10.
- **Done when:** unit tests cover every rule and every operation, including `setFormat` keeping `narrationHash`; the prototype's sample storyboards migrate and validate.

### F17 Storyboard (step 3)
- **Goal:** the script becomes scenes that people can check and edit before generating.
- **Scope:** `buildStoryboard` function (scenes with templates and triggers, checks fed back up to 3 attempts); the storyboard screen: scene cards with narration, highlighted trigger words, on-screen elements, template picker, issues banner ("Scene 6 needs a fix"), rebuild; edits saved to the draft with `rev`.
- **Docs:** PRD M3; API §6 (storyboard), §5 (draft autosave).
- **Design:** `Storyboard.png`, `MobileStoryboard.png`.
- **Done when:** with stub AI, a storyboard is built, a scene is edited and saved, an invalid trigger shows the issue banner and blocks Generate; screenshots match at 1440 and 390 px.

## M3 Video

### F18 Remotion package and the first 4 templates
- **Goal:** specs turn into motion graphics, in all three formats.
- **Scope:** `packages/video`: the `Explainer` composition sized from `spec.format`; the title, bullets, flowchart and comparison templates ported from the prototype, each with layouts for 9:16, 16:9 and 1:1 and the safe areas; video themes (midnight, paper, ocean, sunset); captions with the spoken-word highlight; Remotion Studio for development; still-render tests.
- **Docs:** SDD §9; DB §6 (formats, templates); PRD M4.
- **Done when:** `pnpm video:stills` renders every template in 3 formats × 4 palettes, in English and Hindi, at the shortest and longest allowed text; image diffs are approved; an automated check confirms no text box leaves its safe area.

### F19 The other 8 templates
- **Goal:** the full V1 template library.
- **Scope:** keyTerm, timeline, iconGrid, statCallout, barChart, pieChart, quiz and recap, each in 3 formats with still tests. Icons from Iconify or Lucide, resolved and cached.
- **Docs:** DB §6 (templates); PRD FR-4.2.
- **Done when:** the same still-render checks as F18 pass for all 12 templates.

### F20 Narration and generate video
- **Goal:** "Generate video" records narration and produces a playable draft.
- **Scope:** `TtsProvider` with ElevenLabs (`with-timestamps`, multilingual model) and a stub (fixture audio with word timings); the narration hash cache in `assets`; trigger-to-word timing and captions (ported from the prototype); the `generateVideo` function (validate and reserve usage, moderate, snapshot, narrate up to 4 scenes at a time, timing, finalize); usage reserve, commit and release; per-scene failure with "Retry this scene"; the Generating screen with live stage progress.
- **Docs:** SDD §8 (functions, narration step), §15 (reserve, commit, release); API §7; DB §11.
- **Design:** `Generating.png`.
- **Done when:** `@inngest/test` covers the happy path, one scene failing while others finish, and a stuck job; a database test shows parallel reservations never exceed the limit; with stub providers, Playwright clicks Generate and reaches the editor; one live run with real keys is recorded in `STATUS.md`.

### F21 Editor: live preview
- **Goal:** people watch their video in the browser, exactly as it will export.
- **Scope:** the editor page: Remotion Player with the draft spec and signed audio URLs; scene list and thumbnail strip; play, seek and jump to scene; captions toggle; video theme, caption style and narrator quick settings; the format switch (`setFormat`); the mobile editor layout with the dark stage.
- **Docs:** SDD §4 (project editor, preview player), §9 (preview); API §7 (audio URLs).
- **Design:** `Editor.png`, `MobileEditor.png`.
- **Done when:** a generated stub video plays with captions in sync with the words; switching format re-lays out the player without new narration; screenshots match at 1440 and 390 px.

### F22 Autosave, edit lease and offline
- **Goal:** no edit is ever lost, and two tabs never overwrite each other.
- **Scope:** debounced draft autosave with `rev`; "Saved", "Saving…" and "Offline – changes kept locally" states; local queue and replay on reconnect; the lease with takeover, and read-only mode for the second tab.
- **Docs:** SDD §4 (autosave, one editor per project); API §5 (draft autosave, edit lease); DB §11.
- **Done when:** Playwright edits offline, reconnects and finds the edits saved; a second tab shows read-only with "Take over editing"; a `rev` conflict shows the designed message, never a silent overwrite.

### F23 Manual scene editing
- **Goal:** people can change any scene by hand.
- **Scope:** edit narration, on-screen text, elements and template; add, remove, duplicate and reorder scenes; stale narration marked per scene with "Update narration" (`POST` narration for some scenes); the rule that user-edited scenes are flagged before an AI rewrite.
- **Docs:** API §5, §7 (narration for some scenes); SDD §7 (stage staleness).
- **Done when:** editing one scene's narration re-records only that scene (verified by asset hashes); reorder and template changes show in the preview at once.

### F24 Versions and undo
- **Goal:** every generation and applied change is a version people can go back to.
- **Scope:** versions created on generate, apply and "Save version"; the version history panel; restore and undo without new narration; pruning to the last 50.
- **Docs:** API §8; DB §5 (project_versions); SDD §7 (when versions are created, undo).
- **Design:** `Editor.png` (versions panel).
- **Done when:** database tests for numbering and pruning; Playwright restores an older version and the preview changes back with no new jobs.

## M4 Revisions

### F25 Chat revisions
- **Goal:** change the video by asking.
- **Scope:** the chat panel (desktop) and bottom sheet (mobile); scope "Whole video" or "Scene N"; `proposeRevision` returning typed operations and a summary; the proposal card with Apply and Cancel; `applyRevision` re-recording only changed narration; stale proposals; the clarifying-question reply; suggestion chips; the revision limit and counter.
- **Docs:** PRD F3, M6; SDD §10; API §9; DB §5 (chat_messages).
- **Design:** `Editor.png`, `MobileEditorChat.png`.
- **Done when:** with stub AI, Playwright asks for a change, sees the proposal, applies it and the preview updates; undo restores it; a proposal made before a manual edit is refused as stale; a scene-scoped request only changes that scene.

## M5 Export and publish

### F26 Export and downloads
- **Goal:** an MP4 people can download.
- **Scope:** the Remotion bundle build; `Renderer` with Vercel Sandbox (live) and local `renderMedia` (stub and dev); `exportVideo` with the `specHash` + resolution cache; upload to R2; MP4, MP3 and SRT downloads; cover frame choice; the download half of the Export screen.
- **Docs:** SDD §9 (export function, render settings, other downloads); API §10; DB §7 (exports).
- **Design:** `ExportPost.png`, `MobileExport.png`.
- **Done when:** a local export produces an MP4 of the right size for each format, H.264 and AAC, with the right duration; a second export of the same version is a cache hit; one live Sandbox render is timed and recorded in `STATUS.md`.

### F27 Connect Instagram
- **Goal:** people link a professional Instagram account.
- **Scope:** Instagram Login OAuth with `oauth_states`; long-lived token, encrypted at rest; `social_accounts` with connected, expiring and revoked states; personal-account detection with the designed help text; connect and disconnect in Settings and on the Export screen.
- **Docs:** SDD §11 (Meta app setup, connecting an account, keeping tokens alive); API §12 (connect, callback); DB §8.
- **Prerequisite:** a Meta app in development mode with a tester account (`STATUS.md`, long-lead items).
- **Done when:** unit tests for token encryption and state checks; with a tester account, connect and disconnect work end to end; the stub simulates connected, expiring and revoked.

### F28 Post now and schedule
- **Goal:** a finished video reaches Instagram, now or later.
- **Scope:** the AI caption and hashtags (`suggestCaption`); post now and schedule (IST display, stored in UTC, 10 minutes to 75 days ahead); `publishPost` (sleep, export if needed, container, poll every 15 s, publish, permalink); the publishing-limit check; edit and cancel until 5 minutes before; the non-9:16 warning; the Posts screen with calendar, statuses and Try again.
- **Docs:** SDD §11 (publishing a Reel, scheduling rules, post states); API §10 (caption), §12 (posts); DB §8 (posts).
- **Design:** `ExportPost.png`, `Posts.png`, `MobileExport.png`, `MobilePosts.png`.
- **Done when:** `@inngest/test` covers publish success, an `ERROR` container, timeout and cancel; with stub Instagram, Playwright schedules, edits and cancels a post; one real post to the tester account is recorded in `STATUS.md`.

### F29 Token refresh and post reconciliation
- **Goal:** scheduled posts keep working while people are away.
- **Scope:** daily token refresh cron; `expiring` and `needs_reconnect` handling with email; reconcile missed posts after downtime (post within 15 minutes if under 2 hours late, else ask).
- **Docs:** SDD §11 (keeping tokens alive), §16 (scheduled jobs); API §15 (scheduled functions).
- **Done when:** `@inngest/test` covers refresh success, refresh failure and a missed post in both branches.

## M6 Account, home and admin

### F30 Settings and account deletion
- **Goal:** people control their account and defaults.
- **Scope:** profile, time zone, app language; video defaults (format, language, narrator, length, captions, theme, audience); Instagram section; usage; notification preferences; change password; sign out of other devices; delete account (cancels posts, revokes the token, deletes data within 30 days).
- **Docs:** API §4 (account endpoints); DB §12 (account deletion); SDD §14 (privacy).
- **Design:** `Settings.png`, `MobileSettings.png`.
- **Done when:** each section saves and survives reload; a new project picks up the new defaults; Playwright deletes an account and can no longer sign in; screenshots match at 1440 and 390 px.

### F31 Notifications and email
- **Goal:** people hear about what finished or failed.
- **Scope:** in-app notifications with the bell and unread count; Resend with React Email templates (verify email, reset password, video ready, export ready, post published, post failed, Instagram expiring); notification preferences respected; the stub writes emails to the log.
- **Docs:** API §13; DB §9 (notifications); SDD §16.
- **Design:** `Library.png` (notifications tweak in the canvas).
- **Done when:** each event creates one notification (idempotent); emails render in a preview route; a muted preference sends no email.

### F32 Marketing home page
- **Goal:** the public front door.
- **Scope:** the home page with the animated hero (reduced-motion version included), how it works, examples, English and Hindi, revise by chat, closing call to action; header and footer; Terms and Privacy placeholder pages; metadata and Open Graph image.
- **Design:** `Main.png`, `MobileHome.png`; the motion is in the source file `design/screens/source/Main.dc.html`.
- **Done when:** Lighthouse performance and accessibility ≥ 90 on mobile; with reduced motion, nothing moves; screenshots match at 1440 and 390 px.

### F33 Admin console
- **Goal:** the operator can see and fix problems.
- **Scope:** admin-only routes; overview (users, active, videos, failures); cost by provider; provider health; jobs that need attention with retry; moderation flags; limit overrides; block and unblock a workspace; `admin_audit` for every action. Desktop only.
- **Docs:** API §14; DB §9 (admin_audit); PRD FR-10.7.
- **Design:** `Admin.png`.
- **Done when:** a non-admin gets 404 on every admin route and endpoint; every admin action writes an audit row; the page matches the design at 1440 px.

## M7 Launch readiness

### F34 Monitoring and cleanup jobs
- **Goal:** problems are seen before users report them, and storage stays clean.
- **Scope:** Sentry (app and jobs); PostHog product events from SDD §16; alerts; crons for stuck jobs, version pruning, orphaned assets, expired exports and purging projects deleted over 30 days ago; the nightly `mongodump` to R2 while on the free cluster; runbooks in `docs/runbooks/`.
- **Docs:** SDD §13, §16; DB §12, §14.
- **Done when:** a thrown test error appears in Sentry with source maps; each cron has an `@inngest/test` test; a restore from the nightly dump is rehearsed once and noted in `STATUS.md`.

### F35 Full end-to-end and failure suite
- **Goal:** the whole journey is tested on every pull request.
- **Scope:** Playwright journey with stub providers (sign up → idea → script → storyboard → generate → preview → chat revision → undo → export → schedule → cancel); offline autosave and two tabs; failure injection (ElevenLabs 500s, render crash, stuck job, token revoked, Instagram `ERROR` and `EXPIRED`).
- **Docs:** SDD §19.
- **Done when:** the suite runs in CI against preview deployments and passes; each injected failure shows the designed message and recovery action.

### F36 Accessibility, performance, security and beta
- **Goal:** ready for a closed beta of 20–50 users.
- **Scope:** keyboard and screen-reader pass on every screen; WCAG AA contrast; k6 load test (50 generations, 10 renders, API p95 under 300 ms); security review against SDD §14 (ownership on every query, rate limits, signed URLs, secrets); privacy policy and terms; production environment, domain, Meta App Review approved.
- **Docs:** SDD §14, §17, §19; PRD §9.
- **Done when:** the checklist in `STATUS.md` for this feature is complete and the first beta users are invited.

## Route map (designs → app)

The designs use these names; SDD §4 lists slightly different ones, and these win.

| Screen (design file) | Route |
| --- | --- |
| Home (`Main`) | `/` |
| Sign in / Create account (`SignIn`) | `/sign-in`, `/sign-up`, `/verify`, `/reset-password` |
| Onboarding | `/onboarding` |
| Library (app home) | `/library` |
| New video, steps 1–4 | `/projects/[id]/idea`, `/script`, `/storyboard`, `/generating` |
| Editor | `/projects/[id]` |
| Export and post | `/projects/[id]/export` |
| Posts | `/posts` |
| Settings | `/settings` |
| Admin | `/admin` |

## Parallel track (not code)

These take weeks of waiting, so they start now and run beside the build: the Meta developer app and App Review submission, the domain and Instagram handle, ElevenLabs voice choices in Hindi, a licensed music library, and the prototype batch with real keys (cost and render time per video).
