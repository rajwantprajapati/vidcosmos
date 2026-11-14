# Vidcosmos — Development Status

Last updated: 13 Nov 2026 · Current focus: **F12 Storage (Cloudflare R2)** (built, waiting for review)

This file is the single place that says where the build stands. Update it at the end of every feature, in the same commit. The plan for each feature, with its checks, is in [`docs/05-feature-plan.md`](docs/05-feature-plan.md).

**Status values:** `Not started` · `In progress` · `Blocked` · `Done` (all "Done when" checks pass and are listed under Verified).

## Progress

| Milestone | Done | Total |
| --- | --- | --- |
| M0 Foundations | 7 | 7 |
| M1 Projects and library | 3 | 3 |
| M2 Create flow | 2 | 7 |
| M3 Video | 0 | 7 |
| M4 Revisions | 0 | 1 |
| M5 Export and publish | 0 | 4 |
| M6 Account, home and admin | 0 | 4 |
| M7 Launch readiness | 0 | 3 |
| **Total** | **12** | **36** |

## Features

| ID | Feature | Milestone | Depends on | Status | Updated | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| F01 | Monorepo scaffold | M0 | — | Done | 10 Nov 2026 | TypeScript pinned to 6.0 (see Known issues) |
| F02 | Environment and configuration | M0 | F01 | Done | 11 Nov 2026 | Per-provider overrides; versioned token keys |
| F03 | Design tokens, fonts and themes | M0 | F01 | Done | 11 Nov 2026 | Tailwind 4; `/dev/tokens` |
| F04 | UI component library | M0 | F03 | Done | 11 Nov 2026 | 16 components; `/dev/components` |
| F05 | Database and migrations | M0 | F02 | Done | 11 Nov 2026 | `packages/db`; `pnpm db:migrate` |
| F06 | Sign up, sign in and workspaces | M0 | F04, F05 | Done | 11 Nov 2026 | Better Auth; `/sign-in`, `/sign-up`, `/verify`, `/reset-password` |
| F07 | App shell and onboarding | M0 | F06 | Done | 11 Nov 2026 | Sidebar, tab bar, placeholders, `/onboarding` |
| F08 | Projects API | M1 | F05, F06 | Done | 12 Nov 2026 | `/api/v1/projects`; `packages/db/src/projects.ts` |
| F09 | Library screen | M1 | F07, F08 | Done | 12 Nov 2026 | `/library`: create, search, filters, rename, duplicate, Trash |
| F10 | Usage and limits (read side) | M1 | F08 | Done | 12 Nov 2026 | `GET /me`, `/usage`; meters; limit state |
| F11 | Jobs and background functions | M2 | F08 | Done | 12 Nov 2026 | Inngest at `/api/inngest`; `/api/v1/jobs`; `packages/db/src/jobs.ts`; `/dev/jobs` |
| F12 | Storage (Cloudflare R2) | M2 | F02 | Done | 13 Nov 2026 | `ArtifactStore` (R2 and a local stub); key layout; `packages/db/src/assets.ts`; `/dev/storage` |
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

### F12 Storage (Cloudflare R2) · 13 Nov 2026

- `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` pass. Unit tests: db 167, web 211, integrations 18 plus 1 skipped, spec 25, config 19. `pnpm test:e2e`: 165 passed, 51 skipped.
- Tests added:
  - `packages/integrations/src/storage/keys.test.ts` (5):
    - every key in the DB §7 layout;
    - parts that could leave their folder are refused (`..`, bad ids or hashes, odd track ids);
    - only layout keys and prefixes are accepted;
    - the signed-URL lifetimes;
    - the download header, including Hindi names and RFC 5987 escaping.
  - `local.test.ts` (8): put, head, get and delete; layout-only keys; prefix delete; signed GET with Range (206, open-ended, suffix, 416) and HEAD; a signed download name; tampered key, signature or expiry, the wrong method and expired links refused with 403; a signed PUT only with its Content-Type; 404 for a missing file.
  - `r2.test.ts`: put, head, a signed GET with a download name and Range, a signed PUT, delete and prefix delete against a real bucket. It passes against `vidcosmos-dev`: an Asia-Pacific bucket created 13 Nov, with a token named `vidcosmos-dev` limited to Object Read & Write on that bucket.
  - `packages/db/src/assets.test.ts` (5):
    - SHA-256;
    - the narration hash changes with the text, language, voice, model or speed, and the fields can't run into each other;
    - lookup by hash within a workspace;
    - two parallel records give the second the first's asset;
    - `lastUsedAt` only moves forward.
  - `e2e/storage.spec.ts`: in the browser the stub's image loads; the audio link returns 200 and a Range request 206; the download is an attachment; a tampered, unsigned or wrong-method link gets 403; axe is clean; no sideways scroll on a phone.
- Screenshots of `/dev/storage` at 1440×900 and 390×844. There's no design screen for this development page; it uses the tokens and type classes.
- Fixed after manual QA (another session; no bugs found):
  - Every stub response now has `X-Content-Type-Options: nosniff` and `Content-Security-Policy: sandbox`.
  - A signed PUT whose declared `Content-Length` is over 200 MB is refused before the body is read; the real size is still checked.
  - With a production build (`next build`, `next start`), `/dev/storage`, `/api/dev/storage/…`, `/dev/jobs` and `/api/dev/jobs/demo` all return 404.
  - Tests added: safety headers on 200, 206, 416, 403 and 405 responses, and the early 413, in `local.test.ts`; the e2e checks the headers and HEAD.

### F11 Jobs and background functions · 12 Nov 2026

- `pnpm db:migrate` (jobs validator gains `demo`), `pnpm typecheck`, `pnpm lint`, `pnpm test` (db 160, web 203, spec 25, config 19, integrations 5) and `pnpm build` pass. `pnpm test:e2e`: 159 passed, 50 skipped; three `shell.spec.ts` 404 checks timed out once under full parallel load and pass when run again (16 of 16).
- Tests added:
  - `packages/db/src/jobs.test.ts` (15, in-memory MongoDB):
    - one running job per project, with the holder's id;
    - two parallel starts, one gets through;
    - a stale claim from a finished job is cleared;
    - the concurrent-jobs limit, with nothing kept;
    - another workspace gets 404;
    - progress never goes down, and step writes are refused after a cancel;
    - finishing frees the project but never a newer job's claim;
    - cancel, for queued and for running jobs, and `NOT_CANCELLABLE`;
    - retry and `NOT_RETRYABLE`;
    - the list, its filters and its cursor.
  - `apps/web/inngest/functions/demo-job.test.ts` (8, `@inngest/test`):
    - a full run through every stage;
    - cancel stops at the next step and ends `cancelled`;
    - a job cancelled before it started doesn't run;
    - retry: a step failing on attempt 0 succeeds on attempt 1;
    - a step that keeps failing fails every attempt;
    - `onFailure` marks the job failed and retryable;
    - the `inngest/function.cancelled` handler ends the job, and ignores other runs.
  - `components/jobs/job-progress.test.tsx` (5): polls every 1.5 s with the ETag (304 keeps the job), stops when finished, Cancel shows "Stopping…", Try again only for retryable errors.
  - `e2e/jobs.spec.ts`, with the real Inngest Dev Server started by the Playwright config:
    - UI flow: the demo job reaches "Recording narration"; a reload shows the same job id still running; a second start shows "Something is already running on this video."; Cancel ends it `cancelled` below 100%; a new run on the freed video reaches `succeeded` at 100%; axe is clean.
    - API: `202` with Location; `409 JOB_IN_PROGRESS` with `jobId`; ETag `304`; `?active=true`; another workspace gets 404 on read and cancel; `409 NOT_CANCELLABLE` and `NOT_RETRYABLE` after a cancel.
    - Phone: no sideways scroll, axe clean.
- Fixed after manual QA (another session):
  - **Stuck jobs.** A job whose start event couldn't reach Inngest stayed queued and blocked its video for good, because a replay of the request didn't send the event again. Now `GET /jobs/{id}`, `GET /jobs` and a replayed start or retry send it again for a job that is still queued and never started, at most every 10 s (`claimStartResend`). The event id makes that safe.
  - **Progress card.** A failed bar is red and a cancelled one grey; the badge, the icon and the words still say the status.
  - **Focus.** After Cancel, focus moves to the job's title; after Try again, to the new job's title.
  - **Repeated text.** A finished job's label says where it got to ("Stopped during: …") instead of repeating the badge. The extra screen-reader copy is gone: the bar's label is the live region.
  - **Dev Server address.** `pnpm inngest` and the Playwright config bind the Inngest Dev Server to 127.0.0.1, so its dashboard isn't reachable from the LAN.
  - **Tests added:**
    - `claimStartResend` (2 database tests): one re-send per interval, even with two pollers at once, and none once started or cancelled;
    - `lib/jobs.test.ts` (4): a failed send keeps the job queued; a re-send uses the same event id; a replay re-sends;
    - ProgressBar tone and live label (2);
    - JobProgress text, bar colour and focus (2);
    - the e2e flow checks focus after Cancel.
  - **Live check:** a job started while Inngest was down was queued, then ran to `succeeded` once the Dev Server started and the job was polled.
- Screenshots of `/dev/jobs` at 1440×900 and 390×844 while a job runs. There's no design screen for this development page; the progress row (stage label, percentage, teal bar, Cancel as a text button) follows the Generating design.

### F10 Usage and limits (read side) · 12 Nov 2026

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (db 145, web 190, config 19, spec 25, integrations 5) and `pnpm build` pass; `pnpm test:e2e` 159 passed, 47 skipped.
- Unit tests for the IST month (`packages/spec/src/api/me.test.ts`): the last second of November in IST is still November; midnight IST on 1 December starts December at zero, with the next reset on 31 Dec 18:30 UTC; 1 January 2027 rolls the year over; counters from an earlier month read as zero. `videoAllowance`: reserved videos count as taken, near from 80%, reached at the limit, never negative. Reset date in the user's time zone: "1 Dec" in India, "30 Nov" in New York (`apps/web/lib/usage.test.ts`).
- Database tests (`packages/db/src/usage.test.ts`): only this workspace's queued and running jobs count as active; `readUsage` reads this month's counters, exports and per-video limits.
- `apps/web/e2e/usage.spec.ts` (account set-up through `e2e/support/set-videos-used.ts`, which writes to the development database):
  - `GET /api/v1/usage` and `/me` match the shared schemas and agree (7 used, 1 reserved, 20 max; no active jobs);
  - Settings' Usage card shows "of 20 · resets <date>" with the progress bar at 12, exports today, and the per-video limits; the sidebar meter agrees (desktop);
  - at the limit (19 used + 1 reserved), the Library says "You’ve used all 20 videos this month. You can make new videos again on <date>.", Generate video is disabled (desktop) and the "Start a new video" card is disabled (phone); existing videos still open; back under the limit, Generate works again;
  - a new account at its limit sees the message in the empty state.
- Fixed after manual QA (another session):
  - **Meters and notice disagreed:** the meters showed only used videos while the notice also counted reserved ones (19 + 1 generating read "19 of 20" beside "You’ve used all 20"). The sidebar and Settings meters now show used plus reserved, so the number, the warning colour (from 80%) and "reached" agree; e2e checks 19 + 1 (both meters at 20) and 15 + 1 (warning at 16).
  - **Exports reset outside India:** "resets midnight" is now the user's local time of midnight IST ("1:30 pm" in New York); unit test for India, New York and London.
  - **Smaller:** the New video page also shows the limit (the create step itself is F14); the progress bar's value never goes above its maximum ("25 of 20" stays as text); a workspace with a limit of 0 reads "New videos are turned off for this workspace." with no reset date (render test; the first attempt at this edit didn't apply and QA caught it); the composer refuses a submit at the limit even if one is forced.
- Screenshots: Settings' Usage card at 1440 next to the card in `Settings.png` (same width, 306 vs 312 px tall, same text and meters; the list bullets were missing and are fixed); the limit state on the Library at 1440 and 390 px (no design: the warning uses the warning colour with an icon and words).

### F09 Library screen · 12 Nov 2026

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (db 143, web 183, config 19, spec 20, integrations 5) and `pnpm build` pass; `pnpm test:e2e` 148 passed, 46 skipped.
- `apps/web/e2e/library.spec.ts`:
  - **Empty state:** a new account sees "Make your first video" and no filters; axe finds no violations.
  - **Create (desktop):** a suggestion fills the prompt; type "Product ad" and format 16:9 are kept; Generate video opens `/projects/[id]/idea`; the card shows the type and "Draft · idea"; an empty prompt shows "Describe your video in a few words." and focuses the field; the library's own prompt box creates a second video.
  - **Card actions:** rename through the dialog; duplicate ("(copy)"); Move to Trash with the "Moved to Trash" message and Undo; delete again, open Trash, Restore, back to the library.
  - **Filters and search:** search by title and topic changes the grid and the address; "No videos match"; "Show all videos" clears the search (the box follows the address); chips show "All 3, Drafts 3, Ready 0, Failed 0", "Ready" shows the empty message and is marked current, "Drafts" and "All" bring the videos back; axe finds no violations.
  - **Phone:** no prompt box, the "Start a new video" card opens `/projects/new`; the search spans the width; cards sit two to a row; no sideways scroll.
- Unit tests: the card for each stage and wizard step (where it opens, the badge, "Generating 62%" and "62%" on phones, the length from scene timings, Trash, pre-D1 projects as Explainer) in `apps/web/lib/library.test.ts`; `idea.videoType` and `countProjects` in `packages/db/src/projects.test.ts`.
- Screenshots: a seeded account with the design's seven videos (titles, types, themes, stages) against `Library.png` (1440, full page, 1420 vs 1421 px tall) 2.3% different, and `MobileLibrary.png` (390×844 at 2×) 11% different. Differences:
  - no notifications bell (F31) and no Scheduled chip (F28);
  - "Ready 4" instead of 3, because the design's scheduled and published cards are ready projects until posts exist;
  - the "More actions" button beside each card's title, which the design doesn't show;
  - on phones, the four chips fit on one line where the design's five squeeze onto two, so the cards sit 20 px higher.
  Fixed from the comparison: the sidebar column now runs the full page height, the phone search spans the width, and the generating badge reads "62%" on phones.
- Fixed on the way: the search box navigated once on mount in development (React runs effects twice), which could cancel the navigation to step 1 after Generate video.
- Fixed after manual QA (another session):
  - **Menu button misplaced in mixed-format rows:** grid rows stretched every card to the tallest, and the "More actions" button sat at the row's bottom; cards no longer stretch. e2e check with 9:16, 16:9 and 1:1 cards: each button is centred on its own title (it was 160 px off without the fix).
  - **NUL in a search was a 500** (MongoDB refuses a NUL in a regex), and a NUL in a topic was saved. A shared plain-text check (`packages/spec/src/api/text.ts`) now refuses control characters in topics, notes, titles, scripts and the onboarding topic area (`400 VALIDATION_FAILED`; tab and newline allowed in multi-line text), and search drops them. Unit tests, plus e2e checks on the API.
  - **Long titles** are clamped on the thumbnail to fit its shape (6 lines on 9:16, 3 on 1:1, 2 on 16:9) and long unbroken words wrap; **Devanagari titles** are marked `lang="hi"` and use Noto Sans Devanagari.
  - **Focus:** back on the card's "More actions" button after Rename (save or cancel); on Undo after Move to Trash; on the next Restore, or "Back to your library", after Restore. Restore buttons are named "Restore <title>".
  - **Search** shows "1 video matches “upi”" (the chips keep counting the whole library, as in the design); a suggestion clears the prompt's error.
  - **Re-test follow-ups:** the "Moved to Trash" message no longer closes on its timer while it has keyboard focus or the pointer is on it (WCAG 2.2.1), and when it closes with focus inside, focus moves to the neighbouring card's "More actions" button (or the page heading) instead of the page body; e2e check waits past the 10 s timer with focus on Undo, then closes the message from the keyboard. Thumbnail titles wrap whole words (with hyphens) and only break overlong words; a gap keeps the title off the colour tiles on small 16:9 cards; a title made from a multi-line topic is one line; C1 control characters (U+0080 to U+009F) are refused too. The gap first squeezed two-line titles on 16:9 phone cards (a 97 px thumbnail) to 1.67 lines, cutting the second line; 16:9 titles now get one line under 768 px and two above, and the title never shrinks below whole lines. The shape test checks every title is a whole number of lines, at 1440 and 390 px (it failed with 1.67 before the fix).
  - **Card links read their title twice** (from F04's VideoCard): the thumbnail's headline was inside the link. The thumbnail is now hidden from assistive tech (it pictures the video), and the length moved into the caption as visually hidden text, so a card reads "How UPI moves money, Explainer, 0:58 long, Generating 62%". Render test on the accessible name, and an e2e check that every library card link has its title once (it found it twice without the fix).

### F08 Projects API · 12 Nov 2026

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (db 139, web 165, config 19, spec 14, integrations 5) and `pnpm build` pass; `pnpm test:e2e` 136 passed, 44 skipped. `pnpm db:migrate` on the local MongoDB added the `idempotency_keys` indexes; a second run changed nothing.
- Database tests (`packages/db/src/projects.test.ts`, `idempotency.test.ts`, on `mongodb-memory-server`):
  - **Ownership:** another workspace's project is `NOT_FOUND` for get, update, lease, takeover, draft save, duplicate, delete and restore; it doesn't appear in their list and is left unchanged.
  - **`REV_CONFLICT`:** an old `baseRev` is refused with the current rev.
  - **`LEASE_HELD`:** a lease held by another tab is refused (`heldBy: you_elsewhere`, `expiresAt`) until it expires or a takeover; a draft save without the lease is refused and saves nothing; only the holder can release; taking the lease doesn't move the video up the library.
  - **Idempotent create:** the same key runs once and replays (also with the body's keys in another order); a different body is `IDEMPOTENCY_MISMATCH`; a second request while the first runs is `IDEMPOTENCY_IN_PROGRESS`; a failure frees the key; keys are per workspace.
  - **Soft delete and restore:** Trash, scheduled posts cancelled (published ones untouched), deleting twice is not found, restore within 30 days only, cancelled posts stay cancelled.
  - **Every list filter:** stage (one or several), language, format (one or several), `q` on title and topic (case-insensitive, literal text), trash, sort by updated or created, cursor paging for both sorts, and `INVALID_CURSOR` for another sort's cursor or garbage.
  - **PATCH rules:** language locked once a script exists (`STAGE_INVALID`); palette and format update the draft spec, keep timing and bump the rev; a new voice clears every scene's timing; a script edit becomes `ai_edited` and marks the storyboard stale; a script edit before a script exists is `STAGE_INVALID`; `null` clears an idea field.
  - **Duplicate:** a new draft project with the idea, script and draft, without versions or counters.
  - **Draft timing:** stored timing is kept only where a scene's narration and the voice are unchanged, so forged timing is replaced; scenes that lose timing are returned as stale.
  - **Responses:** summary and detail mappers parse with the `@vidcosmos/spec/api` schemas and carry no internal fields.
- HTTP tests (`apps/web/e2e/projects-api.spec.ts`, desktop project), every body parsed with the shared schemas:
  - `201` with `Location` and `Idempotent-Replayed: true` on replay; the key is required; field paths on `400`;
  - list filters, paging and `INVALID_CURSOR`;
  - every route `404` for another user;
  - lease `423` and takeover, draft `409`/`423`, release by beacon body;
  - PATCH, `STAGE_INVALID`, duplicate, delete (`204` with `X-Cancelled-Posts`), Trash, restore;
  - `403 CSRF_ORIGIN` and `401` with `Cache-Control: private, no-store`.
- Unit tests for the route wrapper: repeated query parameters, the `X-Editor-Id` and `Idempotency-Key` headers.
- Fixed after manual QA (another session), including two F07 bugs already in commit `aac6cf4`:
  - **Open redirect (security, F06/F07 code).** `safeReturnTo` let control characters through: browsers drop a tab from `/<tab>/example.org`, so `/onboarding?next=%2F%09%2Fexample.org` and `/sign-in?next=…` sent a signed-in user to example.org (`%0A`/`%0D` gave a 500 instead). It now refuses control characters, spaces and backslashes, and resolves the value as a URL that must stay on this origin as a plain path; anything else falls back to `/library`. Covered by unit cases (tab, LF, CR, NUL, line separator, leading tab, `/%09/host`, `..`) and e2e checks that `/onboarding` and `/sign-in` with these stay on localhost.
  - **Dark theme lost on the in-app 404.** On a 404 inside the app the root layout renders again in the browser, where React doesn't run inline scripts, so `data-theme` disappeared. A small client effect (`components/theme-sync.tsx`) now puts the attribute back when it is missing. The theme script stays inline in `<head>`, so it still runs before the first paint. A first attempt moved it to `next/script` `beforeInteractive`, which only queues it until Next's async scripts load and gave dark-theme users a light first paint; QA caught that and it was reverted. Checked on `pnpm dev` and a production build. `e2e/theme.spec.ts` delays Next's scripts and checks `data-theme` when the HTML has loaded (stored dark, system dark, stored light over system dark; the script inline in `<head>`); it fails on the `beforeInteractive` version. Plus an e2e check for a stored dark choice on the 404.
  - **ETag:** `GET /projects/{id}` sends an ETag and `Cache-Control: private, no-cache`; a matching `If-None-Match` (or `*`) gets `304` with no body (API §1 "Caching"). e2e check: 304, then 200 with a new tag after a PATCH.
  - **Duplicate requires an `Idempotency-Key`**, like create, so a double click makes one copy (API §5 updated); e2e: 400 without it, replay with it.
  - **Drafts with more than 10 scenes** are `400 VALIDATION_FAILED` (`spec.scenes`) and nothing is saved; e2e check.
  - **Wizard step (decision D4):** PATCH refuses moving forward to a step whose input doesn't exist yet (`409 STAGE_INVALID`, `needs`); going back is always allowed, and a refused request changes nothing. Database tests for each step and its need; e2e check that a new project can't jump to `video`.

### F07 App shell and onboarding · 11 Nov 2026

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (web 151, db 102, config 19, spec 14, integrations 5) and `pnpm build` pass; `pnpm test:e2e` 113 passed, 35 skipped.
- `apps/web/e2e/shell.spec.ts` (desktop and phone):
  - every route in the route map loads its placeholder (`/library`, `/posts`, `/settings`, `/projects/new`, `/projects/[id]` and its `idea`, `script`, `storyboard`, `generating`, `export`);
  - an id that isn't an ObjectId is a 404; `/admin` is a 404 for non-admins;
  - desktop: the sidebar has New video, Library/Posts/Settings with `aria-current` following the page, the usage meter ("of 20 · resets …") and the profile; no tab bar;
  - phone: no sidebar; the tab bar has Library, New video, Posts, Settings, sits at the bottom of the screen and navigates;
  - project pages count as Library; axe finds no violations; no sideways scroll.
- `apps/web/e2e/onboarding.spec.ts`:
  - a new account is sent to `/onboarding` ("Hi Asha, let’s set up your studio");
  - saving persona, topic area, हिंदी and Male returns `Me` with the onboarding and workspace defaults `hi`/`male`, then lands in the library, and the screen doesn't come back;
  - "Skip for now" lands in the library and the screen doesn't come back;
  - arrow keys move the persona choice; axe finds no violations; no sideways scroll;
  - `PUT /api/v1/me/onboarding` returns 401 without a session, `403 CSRF_ORIGIN` from another origin, and `400 VALIDATION_FAILED` with field paths for a bad body or a `$` key; it sends `X-Request-Id` and `Cache-Control: private, no-store`.
- `auth.spec.ts` updated: after confirming the email, the first visit goes to onboarding, then the library; sign out is in Settings; later sign-ins go straight to the library.
- Unit tests: onboarding save, skip and workspace isolation against MongoDB (`packages/db/src/users.test.ts`); IST month and day resets (`packages/spec/src/time.test.ts`); the workspace and usage mappers, including counters from an earlier month reading as zero (`packages/spec/src/api/me.test.ts`); the API body reader: invalid JSON, field errors, operator keys, the 256 KB limit (`apps/web/lib/api.test.ts`); nav state and initials.
- Screenshots compared with Playwright, pixelmatch on a production build: sidebar at 2× against `AppSidebar.png` (both 496×1920) 1.6% different; tab bar at 2× against `MobileTabBar.png` (both 780×168) 1.8%; onboarding at 1440 against `Onboarding.png` (both 1440×957) 2.0%. What remains: Lucide icon shapes, the Posts count badge (no posts yet), the "Listen to samples" link (no voice samples yet), and the onboarding cards sitting 2 px lower and 3 px shorter in the design. Fixed from the comparison: the New video button's height (the `cn()` line-height issue), the tab bar's rounded pills (`rounded-2xl` isn't a design radius), section heading line heights and the footer spacing.
- Library and Settings placeholders checked at 1440 and 390 px.
- Fixed after manual QA (another session):
  - **404s:** a 404 inside the app (bad project id, `/projects/new/idea`, `/admin` for non-admins) shows an app-styled "Page not found" in the shell, with "Go to your library", the tab title "Page not found · Vidcosmos", and no section marked current. An address that matches no route gets the same page outside the shell.
  - **Deep links:** a link opened before onboarding now survives it. The proxy passes the requested path to the app layout, which sends the user to `/onboarding?next=…` (checked with the same safe-return-path rule as sign-in), and saving or skipping goes back there.
  - **Docs:** `onboardingSkippedAt` is in DB §3; `POST /me/onboarding/skip` and the `voiceGender` field are in API §4.
  - Covered by e2e checks (404 pages and titles; `/posts` and a project page coming back after skip and save; an off-site `next` ignored) and unit tests (`onboardingPath`, nav state on 404 paths).

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
| D2 | Captions burned into the video, a separate SRT, or both | F26 | Both: burned in by default (with a "None" caption style to turn off), SRT always available | Open |
| D3 | Default usage limit for beta (20 videos a month) | F36 | Keep 20; revisit after the first 2 beta weeks | Open |

## Decision log

Decisions already made, newest first. Details are in the docs.

| Date | Decision |
| --- | --- |
| 13 Nov 2026 | Storage (F12): signed links for preview playback last 1 hour (SDD §12), not the 15 minutes in DB §7; downloads stay 15 minutes. Keys follow DB §7 (`ws/{workspaceId}/narration/{hash}.mp3`, `ws/{workspaceId}/exports/{exportId}/video.mp4`, `audio.mp3`, `cover.jpg`, `captions.srt`, `ws/{workspaceId}/thumbs/{projectId}.jpg`) over SDD §12's layout, plus SDD's shared `music/{trackId}.mp3`. Keys are built from the hash or the export id, so when two steps record the same narration, the loser keeps the R2 object (it's the same file) instead of deleting it as DB §7 says. |
| 12 Nov 2026 | Jobs (F11): `POST /jobs/{id}/retry` on a job that isn't failed or partial with a retryable error returns `409 NOT_RETRYABLE` with `{ status }` (API §11 didn't name a code). The cancel event is `job/cancel.requested` (API §11) rather than SDD §5's `job/cancelled`. A queued job is cancelled at once. A start event's id is `job-<jobId>`, so sending it twice runs once. The demo job (`type: demo`) and `POST /api/dev/jobs/demo` exist only for development; both 404 in production. |
| 12 Nov 2026 | At the monthly limit, the Library's Generate video is turned off with the reset date (F10 scope, PRD FR-10.5), although creating a draft doesn't use a video; existing videos stay open to edit, export and post. Reserved videos count as taken. |
| 12 Nov 2026 | D5: a Hindi topic in the Library prompt box doesn't switch the narration language. New videos use the workspace's default language (English unless the user chose Hindi in onboarding or settings); step 1's Language control changes it per video. Found in manual QA of F09. |
| 12 Nov 2026 | D1: the video type chosen in step 1 is stored as `idea.videoType` (`explainer`, `product_ad`, `story`, `travel`, `quote`, `music_visual`; missing means `explainer`), sent on create and PATCH and returned on project summaries and details; `idea.goal` stays for explain/teach/summarise/promote. DB §5 and API §3, §5 updated. F14 uses it in the LLM prompts. |
| 12 Nov 2026 | D4: `PATCH /projects/{id}` may move `wizardStep` back freely, but forward only to a step whose input exists (angles: some angles; script: a script; storyboard: a draft spec; video: a saved version), else `409 STAGE_INVALID` with `details.needs` (`angles`, `script`, `storyboard` or `version`). Found in manual QA of F08. |
| 12 Nov 2026 | Idempotency keys for creates are stored in a new `idempotency_keys` collection (24 h TTL, unique per workspace and key); a replay returns the created resource as it is now. A second request while the first is running gets `409 IDEMPOTENCY_IN_PROGRESS` (new code). DB §9 and API §2 updated. |
| 12 Nov 2026 | The edit lease is held by session id + editor tab id (`X-Editor-Id`). A draft save without the lease is `423 LEASE_HELD` with `heldBy: null` when nobody holds it. PATCH doesn't need the lease, but changes it makes to the draft spec (theme, format, voice) bump `draft.rev`, so an open editor reloads. |
| 11 Nov 2026 | Every app page sends a user to `/onboarding` until it is completed or skipped, so "first sign-in goes to onboarding, later sign-ins go to the library" holds for email and Google alike. "Skip for now" stores `user.onboardingSkippedAt` through `POST /api/v1/me/onboarding/skip` (new endpoint); `Me.onboarding` stays null when skipped. |
| 11 Nov 2026 | `PUT /me/onboarding` also takes `voiceGender` (the default narrator on the onboarding screen), which API §4's type predates; it sets `workspace.defaults.voiceGender` beside `language`. |
| 11 Nov 2026 | "New video" goes to `/projects/new` (not in the route map) until F14 makes it create the project and open `/projects/[id]/idea`. Sign out lives in Settings, as in the MobileSettings design. |
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

- **Storage: still to do (F12).**
  - In the Cloudflare dashboard, set the bucket's CORS: GET and HEAD with Range from the app's origins.
  - Add the 120-day lifecycle rule on `exports/` (SDD §12).
  - Project thumbnails get signed URLs once something writes `thumbnailKey` (F26).
  - The narration step uses `findAsset`, `recordAsset` and `touchAssets` (F20).
  - The cleanup crons are F35.
  - The stub keeps files in `apps/web/.storage/` (git-ignored); delete the folder to clear them.
  - Stub responses have no `Content-Length`. Next.js streams every route-handler response and drops it, in dev and with `next start` (checked with plain string and byte bodies). `Content-Range` still carries the full size, so audio seeks. R2, which serves production files directly, sends `Content-Length`.
  - With R2 keys in `.env`, `pnpm test` runs the R2 integration test against the real bucket: a few requests per run, within the free tier. CI has no keys, so it skips there.

- **Jobs: parts waiting on later features (F11).**
  - `GET /jobs/{id}/events` (Server-Sent Events) isn't built; the client polls, as SDD §4 describes.
  - Polling is a small `useJob` hook rather than TanStack Query.
  - Per-type checks on retry (lease, `rev`, limits) and usage reservation arrive with each job type (F13 onwards).
  - The stuck-job sweeper is F35. Until then, a job whose start event never reached Inngest runs as soon as someone reads the job (polling, the active list, a replay) once Inngest is back. If nobody does, it waits.
  - Cancelling `publish` once uploading is refused only from F28.
  - `DELETE /projects/{id}/permanent` and cancel-on-delete still need doing.
  - `/dev/jobs` lists only running jobs, so after a reload a failed job and its Try again are gone. F20's generating screen must show the project's latest job when it failed or was cancelled, with Try again (found in QA of F11).
- **Run the Inngest Dev Server for jobs:** `pnpm inngest` (dashboard on http://127.0.0.1:8288, this machine only) next to `pnpm dev`. Without it, jobs stay queued. `pnpm test:e2e` starts it.

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
- **API groundwork landed early.** F07's endpoint needed the `/api/v1` wrapper (`apps/web/lib/api.ts`: session, Origin check, zod bodies, operator-key check, error envelope, request id) and the `Me`, `Workspace` and `Usage` mappers (`packages/spec/src/api/me.ts`). F08 adds idempotency and the rest of the error codes; F10 adds `GET /me` and the limit states.
- **Shell details waiting on later features.** The Posts count badge (F28), the notifications bell in the top bar (F31), and "Listen to samples" under Default narrator (voice previews, F20) are left out until their data exists.
- **Next.js dev tools button.** In `pnpm dev` it sits in a screen corner and can cover a tab-bar tab at phone width; production has no such button. The shell e2e tests hide it (`hideNextDevTools` in `e2e/helpers.ts`).
- **Restart `pnpm dev` after adding route folders.** The running dev server missed the new `app/(app)/projects/` folders (404 in dev, 200 in a production build) until it was restarted.
- **Projects API: parts waiting on later features.** `DELETE /projects/{id}/permanent` (returns a job) and cancelling a running job on delete come with jobs (F11). Draft `issues` and `narrationHash`-based timing checks come with the VideoSpec (F16, F20); until then the draft is checked at the top level and timing is kept by matching narration text. Moderation is a stub that allows everything (F13). Summary fields `thumbnail`, `lastExport`, `nextPost` and detail `audio` are empty until F12, F26 and F28. A voice change in PATCH updates gender and speed in the draft; the ElevenLabs `voiceId` follows with narration (F20).
- **Library search is a regex.** `q` matches title and topic with a case-insensitive regex, which scans the workspace's projects; fine for V1 sizes. Switch to the Atlas Search index `projects_search` on Atlas.
- **New indexes before new code.** Running the e2e tests before `pnpm db:migrate` created duplicate idempotency rows, which then blocked the unique index (16 local test rows were cleared). The deploy job must run `db:migrate` before the new app goes live (DB §13 already says so).
- **Dev-only warning on the in-app 404.** In `pnpm dev`, a 404 inside the app logs React's "Encountered a script tag while rendering React component" (the theme script, when Next renders the root layout again). The theme is correct and a production build doesn't log it.
- **No CSS fallback for the theme.** `tokens.css` (generated by the design export) defaults to light and has no `prefers-color-scheme` rule, so if the inline theme script were blocked, a dark-system user would see light. A fallback would have to repeat every dark token value in the app's CSS; better added to the design export itself.
- **Library: what waits for later features.** The notifications bell (F31) and the Scheduled chip and post badges (F28) are not shown; real thumbnails (F12) replace the themed placeholders. On phones "Start a new video" opens `/projects/new`, a placeholder until F14. "Show more videos" grows the page by 24 (up to 100) and isn't covered by an e2e test.
- **Sidebar stays in view.** The design's sidebar scrolls with the page (on a long library the usage meter is at the bottom of the page); ours stays fixed in view, with its column running the full height.
- **No designs for the card menu, rename dialog, Trash view or toasts.** Built from the design-system components; check them with the designer.
- **If MongoDB stops, restart `pnpm dev` too.** When the local MongoDB stopped (the disk filled up on 12 Nov), the dev server's cached client closed (`MongoTopologyClosedError`) and kept failing after MongoDB came back, until `pnpm dev` was restarted. Local MongoDB isn't a Homebrew service; `--fork` doesn't work on macOS, so start it with `nohup mongod --config /opt/homebrew/etc/mongod.conf > /dev/null 2>&1 &`. Production (Atlas) reconnects on its own; a reconnecting client for development can wait.
- **Turborepo cache: fixed on 12 Nov.** Each `pnpm build` used to save about 1.2 GB to `.turbo/cache`, because the build outputs in `turbo.json` included `.next/dev`, the running dev server's folder (Next.js 16). That filled the disk. `.next/dev` is now excluded, so a build saves about 7 MB and a cache restore no longer writes old files into the running dev server's folder. The cache can still be deleted at any time.
- **Usage: write side comes with generation.** Reserving, committing and releasing videos, the conditional month rollover in the database, the daily export counter and the stuck-job release arrive with F20 (and F26 for exports). Until then the counters only change by hand (as the usage e2e tests do).
- **Settings shows only Usage and Account.** The rest of the Settings design (account form, video defaults, Instagram, notifications, delete) is F30.
- **F14 must refuse at the limit.** The create step (`/projects/new`, step 1) has to keep refusing new videos at the monthly limit with the reset date, as the Library and the New video placeholder do now (found in QA of F10).
- **`PATCH /me` is F30.** API §4 lists it (name, time zone, UI language); it returns 405 until the Settings account form arrives.
