# Vidcosmos — Development Status

Last updated: 24 Nov 2026 · Current focus: **F22 Autosave, edit lease and offline** (built, waiting for review)

This file is the single place that says where the build stands. Update it at the end of every feature, in the same commit. The plan for each feature, with its checks, is in [`docs/05-feature-plan.md`](docs/05-feature-plan.md).

**Status values:** `Not started` · `In progress` · `Blocked` · `Done` (all "Done when" checks pass and are listed under Verified).

## Progress

| Milestone | Done | Total |
| --- | --- | --- |
| M0 Foundations | 7 | 7 |
| M1 Projects and library | 3 | 3 |
| M2 Create flow | 7 | 7 |
| M3 Video | 5 | 7 |
| M4 Revisions | 0 | 1 |
| M5 Export and publish | 0 | 4 |
| M6 Account, home and admin | 0 | 4 |
| M7 Launch readiness | 0 | 3 |
| **Total** | **22** | **36** |

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
| F13 | LLM providers and moderation | M2 | F11 | Done | 14 Nov 2026 | `LlmProvider` (Gemini, Claude, stub) in `packages/pipeline/src/llm`; usage and moderation events; `pnpm check:llm` |
| F14 | New video: idea and angles | M2 | F09, F13 | Done | 15 Nov 2026 | Step 1 at `/projects/new` and `/projects/[id]/idea`; `POST /projects/{id}/ideas`; `suggestIdeas` |
| F15 | Script | M2 | F14 | Done | 16 Nov 2026 | Step 2 at `/projects/[id]/script`; `POST /projects/{id}/script` and `/script/rewrite`; `writeScript`, `rewriteScript` |
| F16 | Video spec schema and template contracts | M2 | F05 | Done | 16 Nov 2026 | `@vidcosmos/spec/video`: `videoSpec`, 12 templates, rules, hashes, `migrateSpec`, operations |
| F17 | Storyboard | M2 | F15, F16 | Done | 17 Nov 2026 | Step 3 at `/projects/[id]/storyboard`; `POST /projects/{id}/storyboard`; `buildStoryboard`; draft PUT takes a full `VideoSpec` |
| F18 | Remotion package and first 4 templates | M3 | F16 | Done | 18 Nov 2026 | `@vidcosmos/video`: `Explainer`, 4 templates, video themes, captions; `pnpm video:studio`, `pnpm video:stills` |
| F19 | The other 8 templates | M3 | F18 | Done | 23 Nov 2026 | All 12 templates; lakh and crore on charts; 351 approved stills |
| F20 | Narration and generate video | M3 | F12, F17, F18 | Done | 24 Nov 2026 | Generate, retry scenes, Generating screen; live run on ElevenLabs' free plan |
| F21 | Editor: live preview | M3 | F20 | Done | 24 Nov 2026 | Remotion Player with signed audio; scenes, strip, quick settings, format switch; phone editor |
| F22 | Autosave, edit lease and offline | M3 | F21 | Done | 24 Nov 2026 | Offline queue (IndexedDB), conflict recovery, "Take over editing", editor settings queued |
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

### F22 Autosave, edit lease and offline · 24 Nov 2026

- `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. Unit tests: spec 92, video 27, db 214, web 257 (4 new: the offline store, settings merging, what counts as offline, the status labels), pipeline 43, integrations 28, config 19.
- E2E (`e2e/autosave.spec.ts`, desktop, Playwright's `setOffline`), the three "Done when" checks and one more:
  - two template changes made offline show "Offline – changes kept locally" and are saved after reconnecting;
  - a second tab of the storyboard is read-only ("You have this video open in another tab", the controls disabled) with "Take over editing"; after it takes over, the first tab's next change is refused and it turns read-only, and nothing is overwritten;
  - a draft saved elsewhere first: this tab's change over the old rev shows "This video changed in another place…", isn't saved, and "Use my changes" saves it over the newer version;
  - an editor setting (Paper) changed offline stays on screen, shows "Offline – changes kept locally" and is saved on reconnecting.
  - Existing tests updated for "Take over editing". The full suite with 2 workers: 185 passed; the 13 that failed (navigation timeouts while the machine was loaded, 13 minutes for the run) all passed run again one at a time.
- **QA round (24 Nov, 3 findings, fixed):** (1) leaving within 1.5 s lost the edit: every change is now kept in the browser at once; closing the tab sends the last change inside the lease release, which saves it before letting go (the reloaded page then looks for it and shows it); an in-app link sends it with a keep-alive request. (2) a slow save let the next one go out over the same rev and conflict with itself: saves now run one at a time from refs holding the latest rev. (3) another tab's refused change was put back silently: kept drafts and settings carry the tab's editor id; only the same tab over the same rev restores silently, anything else is offered ("There are unsaved changes to this video…", Use them / Discard them). E2E added for all three (`autosave.spec`: 7 passed).
  - Retest: all three pass. One more, fixed: after leaving by a link (the keep-alive save can't drop the browser copy), coming back offered changes the server already had. A kept draft whose title and scenes match the server's draft (`sameDraft`, ignoring timing and `userEdited`) is now dropped silently; the e2e checks no offer appears. The offer for a kept draft says "Use them" (a conflict keeps "Use my changes"). After all the QA fixes: typecheck, lint and unit tests pass (web 258), and the full e2e suite with 2 workers passes (201 passed, 0 failed).
- No design shows these states; screenshots at 1440×900 and 390×844 checked by eye: the desktop status line in the storyboard header (now wide enough for "Offline – changes kept locally"), the conflict banner with "Use my changes" and "Discard them", and on phones (no status line there) an offline notice under the header.

### F21 Editor: live preview · 24 Nov 2026

- `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. Unit tests: spec 92, video 27, db 214 (2 new), web 253 (4 new), pipeline 43, integrations 28, config 19.
- E2E (`e2e/editor.spec.ts`, stub voice and AI, Inngest Dev Server):
  - desktop: a generated stub video opens in the editor with a signed link for every scene's narration; seeking to two words in scene 2 marks exactly that word in the captions (the "Done when"), and "Scene 2 of N" follows; picking scene 3 in the list jumps to it; Play and Pause work. 16:9, Paper and captions Off save with no new job and the same narration, the player re-lays out at 16:9 (and stays so after a reload), the version stays 1. A new narrator shows "N scenes have no narration" with "Record narration", which records every scene as version 2. Axe clean.
  - phone: the full-screen editor (no app sidebar, top bar or tab bar), no sideways scroll, axe clean; the scene strip jumps between scenes; the Style sheet switches the format to 1:1; the Scenes sheet lists every scene and picking one closes it.
  - The full suite with 2 workers: 191 passed; the 3 that failed passed after one fix (`shell.spec` checks the export page for the shell, since the editor is full screen) and a rerun (a 5 s navigation in `create-idea` under load).
- Screenshots at 1440×900 and 390×844, paused in scene 3, compared with `Editor.png` and `MobileEditor.png`: the header ("Saved · version 1 · Explainer · 1:06 · English", Export and post), the scene list with frame thumbnails and lengths, the dark stage with the 304 px player, the seek bar with scene marks, "0:24 / 1:06", "Scene 3 of 8", the quick settings; on phones the dark full-screen editor, player, play and progress, the thumbnail strip and the bottom bar. Differences are by choice: no Revise panel or Versions button (F24, F25), two phone tabs (Scenes, Style), and a Format control the designs don't show.
- `pnpm video:stills` not rerun: the captions only gained a `data-spoken` attribute, which changes no pixel.
- **QA round (24 Nov, 3 findings, all fixed):**
  - A refused save reset the preview to the page-load look: it now goes back to the last saved state (and keeps refreshed audio links). A save refused because another tab took over shows only the read-only notice, and "Edit here instead" clears the "Not saved" status.
  - "No narration" squeezed scene titles to a few letters when every scene had it: `SceneRow` takes `badgePlacement="below"`, which the editor uses; the design-system default stays at the end of the row (the gallery still matches its preview).
  - A video that was never generated opened in the editor with a "Record narration" that can't work: `/projects/[id]` now sends it to its storyboard (or the step it's at), as the library does.
  - E2E added: before generating, the editor link opens the storyboard; a takeover by another tab keeps Paper at 16:9 with one notice, and "Edit here instead" returns to "Saved". `editor.spec` and `dev-components` pass (41); lint and the web unit tests pass.

### F20 Narration and generate video · 24 Nov 2026

- `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. Unit tests: spec 92, video 27, db 211 (10 new), web 248 (11 new), pipeline 43 (5 new), integrations 28 (7 new), config 19.
- `@inngest/test` (`inngest/functions/narration-jobs.test.ts`): the happy path (every scene recorded, timed and saved; stages in order; progress only goes up), one scene failing three times while the others finish (`partial`, the version saved without it), an error that won't change tried once, cached scenes `skipped` at no cost, nothing recorded (`failed`, nothing saved), a cancel, a blocked narration, a retry of chosen scenes and of scenes without narration, and the stuck-job cron failing quiet jobs.
- Database (`packages/db/src/generate.test.ts`, MongoDB replica set in memory): 12 reservations at once against 3 left give exactly 3; the IST month rollover; a blocked workspace; the request checks in API order; a refused reservation leaves no job or claim; the save writes version 1, the draft with timing, `countedAt` and the video's commit together, and a repeated save finds the same version; an edit made meanwhile is kept with the recordings that still match; a failed generation gives its video back once and returns the project to `draft`.
- E2E (`e2e/create-generate.spec.ts`, stub voice and AI, Inngest Dev Server, Docker MongoDB replica set): Generate reaches the editor on desktop and phone with version 1, every scene timed and one video counted; a scene the stub voice refuses leaves the video partial ("Scene 2 · Failed", axe clean), and "Retry this scene" after fixing its narration saves version 2 without counting another video. `create-storyboard` and `shell` updated for the real step 4. The full suite: 170 passed, and the 22 that timed out on navigation while the machine was loaded (load average 14-19, disk 95% full) all passed when run again with 2 workers.
- Screenshots of the Generating screen mid-recording (a job set to "4 of 8 scenes" in the database) at 1440×900 and 390×844, compared with `Generating.png`: the header and stepper, the phone-shaped scene preview, the progress bar, the stage list with each scene's status, and the buttons match. On phones (no design) the scene statuses and the voice line now use the full width.
- Live run (24 Nov, `PROVIDERS_TTS=live`, ElevenLabs free plan, the rest stub): a 30-second English video "How UPI moves your money" with the narrator Matilda (`eleven_multilingual_v2`) through the app: sign up, write the script, build the storyboard, Generate.
  - The job succeeded in 3.2 s: 4 scenes recorded at once, all `done`, version 1 saved, the project `ready` and counted.
  - Every scene's timing is `provider`, with as many timed words as the narration has (22, 30, 5, 19), so every trigger finds its words; the video is 25.7 s.
  - 4 MP3 assets; each one's size matches its length at 128 kbit/s (107,458 bytes = 6,716 ms).
  - 4 usage events, 363 characters in all, which is exactly what the account shows as used (363 of 10,000). Priced at the table's $0.10 per 1,000 characters: $0.036; the free plan charges nothing.
  - Not checked by ear: the Player arrives with F21.
- **QA round (24 Nov, stub voice; 3 findings, all fixed):**
  - A stalled Inngest (accepting connections, not answering) held `POST /generate` open for minutes: every job route's start event now gives up after 4 s (`sendTimeoutMs`) and the job waits queued for `resendIfWaiting`, as when Inngest is down. Test added (`lib/jobs.test.ts`).
  - Generate on an unchanged video saved an identical version: a generation whose spec equals the current version's now keeps that version (`created: false`) and saves nothing. Summaries say what happened: "First version", "Generated again", "Scenes recorded again". Test added.
  - The Generating screen said "Indian female voice" for the default narrators: it now says "Female voice · English" until the Indian voices return.
  - Retest: all three pass. Two more on the Generating screen, fixed: a finished run's last stage named the next version ("Saving version 3" after saving 2); it now reads "Saved version N" from the job's result (the e2e checks "Saved version 1"). On phones a partial run now offers "Open the editor" under "Retry this scene", as desktop does.
  - Also: `.env.example` had the real ElevenLabs key and `PROVIDERS_TTS=live` pasted in (never committed); both are placeholders again and the key is in no tracked file.
  - QA passed the request checks in API order, the happy path, regenerating a counted video, partial and retry, an edit during a run, a voice change re-recording every scene, the monthly limit under parallel requests, and a cancel while queued. The Generating screen's rebuild loop QA saw in the browser didn't reproduce here (no file under `apps/web` changed in 20 s); its cause is unknown.
  - After the fixes: `pnpm typecheck` and `pnpm lint` pass; db 212 and web 249 unit tests pass; `create-generate` e2e passes (3, with 2 workers; the step after Generate now allows 30 s, as the machine's load reached 27).

### F19 The other 8 templates · 23 Nov 2026

- `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. Unit tests: spec 92, video 22 (7 new), db 201, web 237, pipeline 38, integrations 21, config 19. No app UI changed, so no e2e run.
- `pnpm video:stills` renders 936 stills: all 12 templates (and the flowchart's cycle) × 3 formats × 4 palettes, with the same cases as F18: in English the shortest, the longest, the longest in capitals and one long word per element; in Hindi the shortest and the longest.
  - All 936 pass the layout check (the "Done when").
  - 351 are kept as approved images (6.3 MB): every case in midnight, and the other palettes for the long English text. The 135 F18 images didn't change.
  - After approving, a second run matched all 351.
  - The first render found the recap's call to action pushing the heading 10 px out of its box (fixed). The other renders were looked at by eye in every format, and the long English case in paper and sunset as well. That review led to a smaller ring in 9:16 pie charts so the legend has room, more room for "100%", a darker fifth slice, and bar values that wrap rather than shrink.
- Built, in `packages/video/src/templates/` (one file each, the F18 style: accent fills, cards, the element being talked about lit, everything appearing as it's said):
  - key term: the term large with an accent underline, the definition in a card below;
  - timeline: a rail that draws from event to event, top to bottom in 9:16 and 1:1, left to right in 16:9 with dates above and labels below;
  - bar chart: bars growing from zero on one scale, values at their ends; across in 9:16 and 1:1, upright columns in 16:9; the source below;
  - pie chart: a ring whose slices sweep in, the current slice's share in the centre, and a legend with each slice's colour, label and whole percentage (adding up to 100), so colour is never the only key;
  - icon grid: icon cards popping in, two a row in 9:16, four or three in 16:9, two or three in 1:1, a short last row centred;
  - stat callout: the value in the accent, counting up to itself ("72%", "₹1,20,000"; text that isn't a number just appears), its label and source;
  - quiz: lettered options; on the reveal the right one fills with the accent and its letter becomes a tick, the others fade;
  - recap: points ticked off as they're said, and the call to action in an accent pill.
- Shared pieces:
  - `src/numbers.ts`: `formatNumber` and `formatValue` (lakh, crore and lakh crore, in English and Hindi, with "%", "₹" or a word as the unit), `percentages`, `countingText`.
  - `src/parts.tsx`: `Heading`, `headingFit`, `textHeight`, `sourceText` ("Source:" or "स्रोत:").
  - Templates now get the video's `language`. The F18 stand-in list (`fallback.tsx`) is gone.
- Tests added (`src/video.test.ts`): numbers in lakh and crore in both languages, where a unit goes, percentages adding up to 100, counting up, five distinct slice colours in every palette, icon grid columns per format, and the still cases covering every template.
- **QA rounds (21-23 Nov, 9 findings, all fixed):**
  - The stat value's pulse scaled its full-width block 5% past the safe area (reported "right by 24 px"). The value (and the key term's term) now sits in a box as wide as its text and is fitted with room for the pulse.
  - Stats that aren't amounts no longer count up: years ("1947", "1947 AD", "2024 elections"), names with numbers ("5G", "COVID-19", "24x7"), ranks ("#1") and ratios ("1 in 3") stay as written (`countsUp`). A sign counts ("+35%").
  - A unit that says its scale ("₹ crore", "lakh users") keeps the number in full instead of reading "crore crore".
  - The scale is picked after rounding: 99,999.6 reads "1 lakh", 99,99,999 "1 crore", 9,99,999 crore "1 lakh crore".
  - "Rs", "Rs.", "INR" and "US$" go before the number ("Rs 1,234").
  - A pie settles on its largest slice a second after the last is said, instead of showing the last (possibly 0%) slice.
  - A zero bar draws no bar, only its value, so it no longer looks like a small value.
  - Tests added: each of the above (video tests 22 → 27).
  - The stills command now allows 2 minutes per frame (was 30 s), so a busy machine slows a run down rather than failing it.
  - The fonts are loaded up to three times, and a render whose fonts still fail now stops with an error instead of drawing in a fallback font (one confirming run had a still drawn in a fallback font after a font file failed to load once).
  - After the fixes: `pnpm typecheck` and `pnpm test` pass (spec 92, video 27, db 201, web 237, pipeline 38, integrations 21, config 19). `pnpm lint` passes.
  - The QA session's retest passed: all 9 findings fixed, 84 adversarial renders with 0 layout problems (the stat value and key term checked every 3rd frame through the pulse), and its own `pnpm video:stills` run matched all 351. A plain "1500 users" now reads as a year and doesn't count up, an accepted trade-off.
  - `pnpm video:stills`: 936 stills, 0 layout problems. 76 approved images changed as expected (key term, stat callout, pie chart and bar chart), were checked by eye and approved; a second run matched all 351.

### F18 Remotion package and first 4 templates · 18 Nov 2026

- `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. Unit tests: spec 92, video 15, db 201, web 237, pipeline 38, integrations 21, config 19. No app UI changed, so no e2e run.
- `pnpm video:stills` renders 360 stills: title, bullets, flowchart (linear and cycle) and comparison × 3 formats × 4 palettes. In English: the shortest, the longest, the longest in capitals, and one long word per element. In Hindi: the shortest and the longest.
  - All 360 pass the layout check. 135 are kept as approved images in `packages/video/stills/approved/` (2.4 MB) and compared on every run: every case in midnight, and the other three palettes for the long English text (palettes change colours, not layout).
  - A second run matched all 135.
  - A deliberate change to the title template was reported as changed, with exit code 1.
  - The run takes about 3 minutes on this Mac.
- Built, in `packages/video` (Remotion 4.0.542, the prototype's version):
  - `Explainer` (`src/explainer.tsx`):
    - sized from `spec.format`, 30 fps;
    - scenes last their recording or the estimate from their words;
    - each scene's narration plays from `assets` (URLs by `narrationAssetId`; music as `music:<trackId>`), so the spec never holds a URL;
    - scene fades, a moving background, and music ducked to a quarter under the narrator.
  - Video themes (`src/theme.ts`): each palette's five colours from the design tokens (`video-<palette>-bg|panel|text|accent|highlight`); softer shades are `color-mix`es of them, so no colour is written in code.
  - The stage (`src/format.ts`): the canvas, DB §6's safe area, and the box a scene lays out in. That box is the safe area less a band at its bottom for captions, so captions never cover a scene.
  - The templates, ported from the prototype with a layout per format:
    - title;
    - bullets;
    - flowchart: top to bottom in 9:16 and 1:1, left to right in 16:9; a cycle sits on an ellipse that fills the box, with cards as large as fits;
    - comparison: stacked in 9:16, side by side in 16:9 and 1:1.
    - Text is sized to fit its box (`fitBox`).
    - The other eight templates show their headline and elements as a list until F19.
  - Captions (`src/captions.tsx`):
    - pages of at most two lines of 32 characters, with a new page after each sentence;
    - "highlight" marks the word being said;
    - "classic" shows plain lines;
    - "none" shows nothing.
  - Fonts: the design system's own files (Plus Jakarta Sans, Inter, Noto Sans Devanagari). Rendering waits until they've loaded.
  - The layout check (`src/layout-check.tsx`):
    - holds each frame until the fonts are ready, then measures every text box;
    - a scene's text must stay in its box and captions in their band, and no text may be wider than its own box;
    - problems go to the browser console, where the stills command collects them.
  - `@vidcosmos/spec/video` `timing.ts`: element times worked out from the narration's words (the prototype's `applyTiming`), or from words spaced at the speaking rate before any recording. A trigger that isn't found is placed between its neighbours, and a list's items stay in order.
  - Commands:
    - `pnpm video:studio`: Remotion Studio with a sample video in each format. Its compositions were listed with `remotion compositions`.
    - `pnpm video:stills`: options `--approve`, `--only=a,b` and `--full` (full-size PNGs to look at).
- Tests added:
  - video `video.test.ts`:
    - the themes come from the tokens;
    - DB §6's safe areas, with the content box and captions band filling the safe area;
    - every one of the 102 icon names is a Lucide icon;
    - the font files exist;
    - text fitting, caption pages and the layout rule;
    - the cycle's cards never touch, for 3 to 6 steps in every format;
    - the still cases are valid scenes.
  - spec `timing.test.ts`: word spacing by language and speed, trigger times, a missing trigger, a list kept in order, every template.
- Manual QA (18 Nov): 6 findings, all fixed or noted:
  - **Capitals and long words.** Text width is now estimated per character (capitals and M/W wider, narrow letters narrower) and wrapped word by word. Every text is sized so its longest word fits whole (`fitBox`), and bullets drop to a smaller size before taking a third line. This fixes the all-caps bullets overflowing at the top and bottom in 9:16 and 16:9, the square comparison running into the captions, side titles breaking mid-word, and flowchart labels spilling out of their cards.
  - **Text keeps to its card.** Text in a centred card is limited to the card's width, so a word that still can't fit breaks inside it as a last resort.
  - **The layout check covers cards.** Cards and tiles are marked `data-box`, and text must stay inside its card as well as its area. Proved by oversizing the cycle labels: "leaves its card" was reported for each.
  - **New still cases**: capitals at every limit, and one long word per element, in every template, format and palette (English).
  - **Emoji** on screen use the render host's emoji font: noted for F26 (Known issues).
  - After the fixes: typecheck, lint and unit tests pass (video 15). 360 stills: 0 layout problems, approved, and a second run matched them all.
  - **Fewer approved images** (your choice, to keep the repository small): 135 of the 360 are kept and compared, 2.4 MB instead of 5.8 MB; all 360 are still layout-checked. Run after the change: 360 stills, 0 layout problems, 135 compared, 0 changed. The video package's typecheck and lint pass.
- Checked by eye at full size: every template in the midnight theme, plus paper, ocean and sunset samples. That review found the stacked comparison running into the captions, square bullets overflowing at the top, and overlapping cycle cards; all were fixed. It also found the first layout check measuring nothing, which led to the hold-and-measure check described above.

### F17 Storyboard · 17 Nov 2026

- `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. Unit tests: spec 83, pipeline 38, db 200, web 237, integrations 21, config 19, video 1.
- `pnpm test:e2e`: 189 passed, 73 skipped (each test runs at one of the two sizes), with `pnpm dev` restarted and the Inngest Dev Server running.
- Built:
  - `@vidcosmos/spec/video`:
    - `scenes.ts`: template names, a scene's headline and elements, length estimates and `convertScene`, which switches template by hand with no AI. It keeps what fits and fills the rest from words the narrator says.
    - `form.ts`: the edit panel's fields for each template.
    - `text.ts`: `wordSpans` and `triggerRanges`, used to highlight trigger words.
  - `packages/pipeline/src/storyboard.ts`: `buildStoryboard`.
    - The prototype's prompt, widened to 12 templates; the script goes to the model as JSON data.
    - The schema, then `specIssues` with the script and a 15 s per-scene check; problems go back to the model, up to 3 attempts.
    - The stub `submit_storyboard` splits any script into 2-10 valid scenes: a title first, a recap last.
  - `packages/db/src/storyboard.ts`:
    - `checkStoryboardRequest`: needs a script, and `overwrite` to replace a storyboard.
    - `saveStoryboard`: saves only while the job holds the project and the script and draft rev are unchanged. It records `stageHashes.script` and moves `wizardStep` to storyboard.
  - `saveDraft` takes a full spec:
    - each scene keeps the server's own timing, cleared when its `narrationHash` no longer matches;
    - scenes the person changed are marked `userEdited`;
    - edited narration becomes the script (PRD FR-3.5) unless the script changed after the storyboard;
    - it returns `specIssues`.
  - A narrator change by PATCH now also sets the draft's `voiceId`.
  - `POST /projects/{id}/storyboard` and the `build-storyboard` Inngest function: moderate the script, build, moderate the on-screen text, save.
  - Step 3 (`components/create/storyboard-step.tsx`, `scene-card.tsx`, `scene-editor.tsx`):
    - cards with highlighted trigger words, the template picker and element chips;
    - the "Scene N needs a fix" banner, with the scene marked;
    - Generate turned off while there are issues;
    - "Rebuild storyboard" asks first;
    - the stale-script banner;
    - autosave with `rev` every 1.5 s at most;
    - the footer with the scene count, length and usage line;
    - "Edit scene": a dialog on desktop, a full screen on phones.
  - Step 2's "Build the storyboard" starts the first storyboard.
- Tests added:
  - spec `scenes.test.ts`: highlights, element labels, estimates, paths, all 144 template switches without issues, form fields;
  - pipeline `storyboard.test.ts`: the stub at every length in both languages, problems fed back, long scenes;
  - db `storyboard.test.ts`;
  - new draft tests in `projects.test.ts`: forged timing ignored, `narrationHash`, `userEdited`, script sync and its stale exception, the 1,800-character limit, issues;
  - `storyboard-jobs.test.ts` (`@inngest/test`);
  - `e2e/create-storyboard.spec.ts`:
    - build from step 2;
    - a template change saved and still there after a reload;
    - a bad trigger shows the banner and blocks Generate;
    - fixing it by narration updates the script;
    - rebuild with confirm, and Generate;
    - the stale banner;
    - the API checks;
    - the phone layout with the full-screen editor;
    - axe on both sizes.
  - `projects-api.spec.ts` and `shell.spec.ts` updated: full draft specs, and step 3 is a 404 for a missing video.
- Manual QA (18 Nov): 2 server gaps and 3 smaller issues, all fixed:
  - **Draft saves are moderated.** `PUT /draft` checks what the edit adds: changed narration, which becomes the script, and on-screen text not shown before (`addedTexts`). A refusal is 422 CONTENT_BLOCKED and nothing is saved.
  - **The settings own the spec's language, narrator (with its voice id), format, theme and music.** `saveDraft` takes them from the settings (`specSettings`), whatever the client sends, so a save can't get round the language rule or pick a voice id. The storyboard job uses the same helper.
  - **The estimated length is checked before recording** (your choice): an estimate over 110 s or under 20 s is a DURATION_OUT_OF_RANGE issue, which shows the banner and blocks Generate. A scene over 15 s shows "Long scene" on its card without blocking.
  - The job now moderates every on-screen text, including a quiz's question and a timeline's dates (`sceneTexts`).
  - The rule messages use curly quotes, like the rest of the app.
  - Retest (18 Nov): all five fixes pass. Two wording nits were fixed after it:
    - the footer and the length banner now show the same figure (`estimatedVideoMs`; the footer had added up seconds rounded per scene);
    - with only a whole-video issue, the line under Generate says "Fix the issue above to generate the video." instead of naming marked scenes.
  - After the fixes: `pnpm typecheck`, `pnpm lint` and `pnpm test` pass (spec 86, db 201, pipeline 38, web 237). `pnpm test:e2e`: 189 passed, 73 skipped. New e2e checks cover a blocked draft save, forged settings fields and the length issue.
- Screenshots at 1440×900 and 390×844 compared with `Storyboard.png` and `MobileStoryboard.png`:
  - the layout, cards, highlights, amber banner and border, footer, phone rows and the bottom bar match;
  - element chips were made one line, as in the design;
  - the edit panel has no design; it follows the dialog and full-screen patterns.

### F16 Video spec schema and template contracts · 16 Nov 2026

- `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. Unit tests: spec 70, db 189, web 232, pipeline 33, integrations 21, config 19, video 1. No UI, so no e2e run or screenshots.
- Built, in `packages/spec/src/video/` (`@vidcosmos/spec/video`):
  - `icons.ts`: the prototype's closed list of 102 Lucide icon names.
  - `templates.ts`: content schemas for all 12 templates, with DB §6's limits. Element objects carry `trigger` and `atMs?`; single fields carry `<field>Trigger` and `<field>AtMs`, as in the prototype. `triggersOf` lists them in a fixed on-screen order, whatever order the fields were written in.
  - `schema.ts`:
    - `videoSpec`: version, format, title, language, voice (`eleven_multilingual_v2`, speed 0.85-1.15), theme, music or null, and 2-10 scenes;
    - scenes are a union on `template`, with `content`, `userEdited` (default false) and `timing` (default null);
    - timing holds the asset id as hex, never a URL, and its `narrationHash`;
    - `formats`: the canvases and safe areas; `videoTiming`: 30 fps, 300 ms lead-in, 400 ms tail, 20-100 s in total.
  - `checks.ts`:
    - `specIssues`: triggers spoken in their scene, in order; unique scene ids; length once timed; narration against the script (≥95% covered, ≤5% extra) on generation;
    - `reconcileTiming` clears timing whose hash no longer matches.
  - `hash.ts`: `narrationHash` (narration, language, voice id, model and speed, but not the format), `canonicalJson`, `specHash`. Both use `@noble/hashes` 2.4.0, so they also work in the browser.
  - `migrate.ts`: `migrateSpec` reads the prototype's finished spec and its storyboards. A missing format becomes 9:16; language and voice come from defaults, or it says which is missing; audio file paths are dropped, so those scenes get new audio.
  - `operations.ts`: the 9 operations as a zod union (`updateScene`, `addScene`, `removeScene`, `moveScene`, `setFormat`, `setTheme`, `setVoice`, `setMusic`, `rewriteAll`). `applyOperations` works on a copy, refuses unknown scenes and invalid results (`SpecOperationError`, with the operation's index), and returns `affectedSceneIds`, `needsNarration` and the rule `issues`.
  - `text.ts`: word helpers ported from the prototype. `examples.ts`: one valid scene per template, for tests and later previews. `testing.ts`: test specs, with matching timing.
  - The prototype's three samples are in `src/video/fixtures/`.
- Tests added:
  - `templates.test.ts` (5): each template's example is valid; 33 limit breaks are refused and the edges allowed; the closed icon list; content from another template, or an unknown template, is refused; trigger order is independent of field order.
  - `checks.test.ts` (15): the spec's own limits (scene count, format, voice model, speed, narration length, no URL in timing); triggers missing or out of order; Hindi and case-insensitive matching; duplicate ids; 20-100 s only once timed; narration against the script; `narrationHash` inputs, but not the format; `specHash` ignores key order and changes with format or theme; `reconcileTiming`; all three prototype samples migrate and pass every rule; a current spec migrates unchanged; missing defaults are named.
  - `operations.test.ts` (11):
    - `setFormat` keeps every scene's `narrationHash` and audio;
    - `updateScene`: new narration needs new audio, new content alone doesn't; a template change needs its content;
    - `addScene`, first or after another, with a fresh `sc_` id;
    - `removeScene` keeps 2 scenes at least; `moveScene` either way;
    - `setTheme` and `setMusic`; `setVoice` needs new audio for every scene;
    - `rewriteAll` names each scene once and re-records only the changed ones;
    - unknown scenes are refused and the original stays untouched; issues are reported without refusing; only the nine operations are accepted.
- Fixed after manual QA (another session, 16 Nov):
  - **Text:** on-screen text and triggers are trimmed, can't be blank, and refuse control characters and line breaks (`lineText`). The title does the same. Narration may have line breaks but no control characters.
  - **Trigger matching:** curly and straight apostrophes are the same (apostrophes are dropped on both sides), and hyphens and dashes split words, so "It’s" matches "It's" and "step-by-step" matches "step by step".
  - **`setVoice`:** a new gender without a voice id is refused ("A new narrator needs its voice id."); the voice id is what the audio was made with.
  - **Trigger order (your choice, 16 Nov):** only each list's items (items, steps, a side's points, events, bars, slices, options) must follow the narration's order. Headings, titles and other single fields may be said anywhere, so "Cash versus UPI…" passes.
  - **Timing:** `durationMs` must be at least lead-in + audio, and words must end after they start and come in spoken order.
  - **Smaller:** `specHash` leaves out `userEdited` (it changes no frame); `migrateSpec` refuses versions other than 1; the operations refuse fields they don't know (strict objects, since they come from the LLM); the icon count is 102.
  - **On retest:** a quiz's reveal and a recap's call to action are no longer "said anywhere": each must come after the last option or point it closes (`TRIGGER_OUT_OF_ORDER` otherwise), so the answer can't show before the choices.
  - **Tests (+7):** the reveal and call to action after their lists; blank text, control characters and trimming; apostrophes and hyphens; titles anywhere but lists in order; inconsistent timing; `setVoice` without a voice id; unknown version; `userEdited` not in `specHash`; unknown operation fields.

### F15 Script · 16 Nov 2026

- `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. Unit tests: db 189, web 232, pipeline 33, spec 32, integrations 21, config 19, video 1. `pnpm test:e2e`: 185 passed, 69 skipped (each test runs at the screen size it's written for).
- Built:
  - `@vidcosmos/spec/api` `script.ts`: `countWords` (a dash or a danda standing alone isn't a word), `scriptStats`, `targetWords`, `scriptFit` (within 15% either way, PRD FR-2.4), `firstSentence` (the hook), `requestScriptInput`, `rewriteScriptInput`. `scriptStats` moved here from `projects.ts`.
  - `@vidcosmos/pipeline` `script.ts`: `writeScript`, with the prototype's rules and the request as a JSON line, a ±10% length check and one retry (SDD §8); `rewriteScript` for all of the script or a selected part, checking that "shorter" and "longer" went the right way. Stub answers `submit_script` (sized to the target, English or Hindi, from the angle's hook) and `submit_rewrite`. The pipeline now depends on `@vidcosmos/spec`.
  - `@vidcosmos/db` `script.ts`:
    - `checkScriptRequest`: an unknown angle is refused, and so is a new script over an edited one without `overwrite` (`409 STAGE_INVALID`, `needs: 'overwrite'`);
    - `checkRewriteRequest`: there must be a script, and the selection must be inside it;
    - `saveScript`: saves only while the job holds the project. It records `stageHashes.idea`, moves the wizard to `script`, and takes the script's title unless the video was renamed. A rewrite is saved only over the text it started from.
    - Editing the script by PATCH now moves the hook with the text.
  - Events `video/script.requested` and `video/script.rewrite.requested` carry ids only; the functions read the job's input (API §15).
  - Functions `write-script` and `rewrite-script`:
    - they moderate what was typed, then the AI's script;
    - the rewrite keeps the script it started from in the job's input, for "Undo last rewrite";
    - a script edited while a rewrite ran keeps the edit: the job ends cancelled and gives its request back.
  - Routes `POST /projects/{id}/script` and `/script/rewrite`: edit lease, Idempotency-Key, AI request reserved and given back on failure, one job per video.
  - The step 2 page:
    - the editor saves as you type and shows the word count, the estimated length and a fit badge;
    - over the target it offers "Trim to fit" and "Use 90 s";
    - rewrite chips, a "Custom…" dialog, a selection rewrites only that part, and "Undo last rewrite";
    - the overwrite question, and the stale banner with "Write a new script";
    - a read-only second tab, the settings and angle cards, and "Build the storyboard";
    - on phones, its own header, scrolling chips and a bottom button.
  - Step 1's "Write the script" / "Write the script from the topic" now start the script job and open step 2. A video that already has a script just opens it.
- Tests added:
  - `packages/spec/src/api/script.test.ts` (7): word counts in English, Hindi and Hinglish; 2.5 and 2.2 words a second; targets of 75/150/225 and 66/132/198 words; the 15% fit edges; the hook in both languages; the rewrite request's checks.
  - `packages/pipeline/src/script.test.ts` (8): the length check and its message; the request stays data; one retry with the length fed back, and the second try is kept even if still off; the stub fits every length within 10% in both languages and starts from the angle's hook; a rewritten part goes back in place; "shorter" and "longer" are checked; the stub's rewrites.
  - `packages/db/src/script.test.ts` (7): saving with the idea hash, the title and the wizard step; a renamed video keeps its title; nothing is saved once the job has lost the project; a rewrite isn't saved over an edit made meanwhile; an edit becomes `ai_edited` and moves the hook; overwrite, angle and selection checks; editing the notes marks the script stale and a settings change doesn't.
  - `apps/web/inngest/functions/script-jobs.test.ts` (6): a full write, with the script sized, checked and saved; a blocked topic; an LLM failure, with "The AI couldn't write the script this time"; a rewrite of the selected part; a rewrite whose script was edited ends cancelled; a blocked custom instruction.
  - `e2e/create-script.spec.ts`:
    - **Desktop:** step 1 starts the script, and step 2 shows "N words · about N s with an Indian female voice" and "Fits your 60 s target". An edit autosaves ("Saved just now") and survives a reload as `ai_edited`. "Longer", then "Undo last rewrite". A selected sentence changes alone. "Custom…" refuses empty text, then rewrites. That makes 4 AI requests, axe is clean, and "Build the storyboard" opens step 3.
    - **Stale:** an edited script, then a notes change on step 1. Going back to step 2 shows the stale banner and spends nothing. "Write a new script" asks first; "Keep my script" keeps it; confirming writes a fresh `ai` script, which clears the banner.
    - **Too long:** a long script shows "Longer than your 60 s target" and "Trim to fit"; "Use 90 s" changes the length.
    - **API:** 400 without `X-Editor-Id`; a rewrite with no script is 409 `needs: 'script'`; a custom rewrite with no words is 400; an unknown angle is 409; a write is 202 and uses 1 request.
    - **Phone:** "Step 2 of 4", no tab bar, the chip toolbar, "N words · about N s", "Fits 60 s"; no sideways scroll; axe clean; the bottom button opens step 3.
  - Updated:
    - `e2e/create-idea.spec.ts`: "Write the script from the topic" now uses 1 AI request and starts one `script` job.
    - `e2e/shell.spec.ts`: step 2 of a missing video is a 404 too.
    - `e2e/auth.spec.ts`: the sign-in return test uses a real video's step 2.
- Screenshots at 1440×900 and 390×844 compared with `Script.png` and `MobileScript.png`. The header (← Idea, title, stepper, save status), the chips, the editor card, the stats line and badge, the three side cards and the phone header, bars, chips, stats row and bottom button match.
  - Fixed on the way: the editor card was 66 px narrower than the design (its 760 px limit doesn't count padding there); the save status was empty until the first save.
  - Differences kept: the sidebar marks Library (F07's rule); the phone chips don't wrap "More engaging" onto two lines.
- Fixed after manual QA (another session, 16 Nov):
  - **A tab that lost editing saved over the other tab.** A script PATCH now needs the editor tab's id (`X-Editor-Id`) and its lease (`423 LEASE_HELD` otherwise). Any PATCH that sends the id is checked the same way, and both steps now send it. A refused save turns the tab read-only with "Another tab took over editing, so your last change wasn't saved here." "Edit here instead" reloads the saved script, and the box stays read-only until it has. On retest: when the lease renewal finds the takeover before a save is sent, the status said "Saving…" for good. It now says "Not saved" with the same message (e2e with Playwright's clock). The truncated title has its full text as a tooltip.
  - **An edit made while a new script was written was lost.** The write job now keeps the script it started from (`previousText` in its input), like the rewrite does. It saves only over that; otherwise the edit stays and the job ends cancelled, giving its request back.
  - **The header jumped 37 px on each save with a long title.** The status now has a fixed width, the title truncates, and the status reads "Saving…" as soon as there's something unsaved.
  - **"Keep this script" only hid the banner** until a reload. It's now "Dismiss", with focus back in the script.
  - **Undo of a rewrite of the AI's own script left it `ai_edited`**, so a new script asked about overwriting. The PATCH puts back the earlier source when the text is exactly what the latest rewrite replaced, and the script hasn't changed since.
  - **An empty script could be rewritten.** A script with no words is refused (`409`, `needs: 'script'`), and the chips are disabled. Separately, the stub read the whole retry prompt as JSON, so any stub retry became `INTERNAL`; it now reads only the request line (moderation, ideas and script).
  - **A script written from an angle other than the picked one** was stale at once; that angle now becomes the picked one.
  - **Focus:** it goes back to the script after "Use 90 s" and "Dismiss", and the Custom… dialog's error clears as you type.
  - **Phone chips** are at least 44 px tall.
  - **Tests:**
    - db (+5): the write guard; the angle used; an empty script refused; an update from a tab without the lease refused; the undo source.
    - pipeline (+1): the stub answers a retry prompt.
    - jobs (+1): a write whose script was edited meanwhile ends cancelled.
    - e2e (+2 tests, more checks):
      - a tab that lost editing goes read-only and the other tab's script stays;
      - the editor doesn't move while saving;
      - an empty script disables the chips;
      - Dismiss comes back after a reload;
      - phone chips are 44 px or taller;
      - `projects-api` expects 400 for a script PATCH without a tab id.

### F14 New video: idea and angles · 15 Nov 2026

- `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` pass. Unit tests: db 177, web 225, pipeline 24, spec 25, integrations 21, config 19. `pnpm test:e2e`: 174 passed, 58 skipped. The library filters test failed once under full parallel load and passes on its own.
- Tests added:
  - `packages/db/src/ideas.test.ts` (6):
    - AI requests per video stop at the limit even with 5 parallel reservations against 3;
    - `LIMIT_REACHED` carries `{ limit: "generationsPerVideo", used, max }`;
    - finishing gives a failed or cancelled job's request back once, even if repeated, and a succeeded job keeps it;
    - another workspace gets 404;
    - angles replace the old ones, clear the pick and move the wizard to `angles`, but a job that no longer holds the project saves nothing;
    - a picked angle must exist, and null clears it.
  - `packages/pipeline/src/ideas.test.ts` (4): the request goes in as one JSON line; the count and distinct titles are checked; a wrong count is fed back, then the extra angles are cut; the stub gives 3 to 5 angles from the topic.
  - `apps/web/inngest/functions/suggest-ideas.test.ts` (4, `@inngest/test`):
    - a full run (moderation, angles, save, result with the angle ids, usage for both calls);
    - a blocked topic fails with `CONTENT_BLOCKED`, is recorded and saves no angles;
    - an LLM rate limit fails with its code and a retryable message;
    - a cancelled job doesn't run, and a missing project stops it.
  - `lib/jobs.test.ts` (+2): the ideas start event is built from the job's input; a start that can't be built leaves the job queued instead of returning 500.
  - `e2e/create-idea.spec.ts`:
    - **Desktop:** New video fills the topic, notes, type, length, narrator, format, tone and audience, then suggests angles, which creates the project and opens step 1. 4 angles arrive with "AI requests for this video: 1 of 50". After picking one and reloading, everything has persisted and axe is clean. "Suggest new angles" works again (2 of 50, the pick cleared), and "Write the script" opens step 2.
    - **Second tab:** it opens read-only with "Edit here instead", and taking over works.
    - **API:** 400 without `X-Editor-Id` or with `count: 7`, 423 `LEASE_HELD` from another tab, 202 with the lease, 409 `JOB_IN_PROGRESS` on a second start, `generationsUsed` 1.
    - **Phone:** no tab bar; "Step 1 of 4 · Idea"; a settings row opens in place; the bottom button suggests, then writes the script; no sideways scroll; axe clean.
  - `e2e/shell.spec.ts` updated: step 1 of a missing video is a 404 titled "Page not found", and the phone tab bar is checked on the editor page, because create steps hide it.
- Screenshots at 1440×900 (with angles) and 390×844 compared with `NewVideo.png` and `MobileNewVideo.png`. The header, stepper, form, chips, settings, angle cards, buttons and phone bottom bar match.
  - Fixed on the way: after new angles arrived, "Suggest new angles" stayed disabled (the page still held the starting job); the phone grid was 453 px wide because the chip row widened it; stub hooks ended in "….".
  - Fixed after manual QA (another session):
    - **Write from the topic.** Before any angles exist, "Write the script from the topic" (desktop) and "Write from the topic" (phone) open step 2. On New video it first creates the project, with no AI request used. It's off at the monthly limit.
    - **Refused edits.** Suggest and Write the script wait for the autosave. A field holding a refused or unsaved edit stops them, with focus on that field and nothing spent; before, the job ran on the old text and used an AI request.
    - **Read-only tab.** "Skip angles" and "Write the script" open step 2 without saving anything, instead of doing nothing.
    - **Feature plan.** It now says 3-5 angles, 4 by default.
    - **Tests** (e2e): New video "Write the script from the topic" makes the project with `generationsUsed` 0 and no jobs; a refused notes edit then Suggest starts no job and spends nothing; a read-only tab reaches step 2. Afterwards `pnpm test:e2e`: 177 passed, 61 skipped.
  - Differences kept: on phones the topic is labelled "Topic", not "What is the video about?"; Notes comes before Video type on phones too, so the order is the same for keyboards at every width; the sidebar marks Library on create steps (F07's rule), where the design marks nothing.

### F13 LLM providers and moderation · 14 Nov 2026

- `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` pass. Unit tests: pipeline 18, db 171, web 219, integrations 21 (with live R2), spec 25, config 19. `pnpm test:e2e`: 167 passed, 53 skipped.
- `pnpm check:llm` without keys: "skipped: LLM_PROVIDER=gemini needs GEMINI_API_KEY", exit 0. With `LLM_PROVIDER=claude` it names `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`, exit 0. **The live check hasn't run**: `.env` has no Gemini or Claude key.
- Tests added:
  - `packages/pipeline/src/llm/gemini.test.ts` (5, mocked HTTP):
    - the `generateContent` request: JSON mime type, a schema with `const`/`oneOf` rewritten, the system instruction, the thinking level;
    - thinking tokens counted as output;
    - a retry with the previous answer and its problems;
    - semantic problems fed back, and `LLM_INVALID_OUTPUT` after 3 attempts;
    - 429 and 503 waits, then `LLM_RATE_LIMITED`;
    - a safety stop becomes `CONTENT_BLOCKED`.
  - `anthropic.test.ts` (5, mocked HTTP):
    - JSON-schema output (no tools, no forced `tool_choice`), with limits removed and every object closed;
    - effort in `output_config`, and the bearer key;
    - the `server-side-fallback-2026-07-01` beta with `fallbacks: "default"` on Sonnet 5.5, and none on Haiku 5.5;
    - zod problems fed back;
    - a refusal recorded, then `CONTENT_BLOCKED`;
    - 429 becomes `LLM_RATE_LIMITED`;
    - cost per attempt.
  - `moderation.test.ts` (7):
    - the stub's allow and block, naming the refused input;
    - the model's category, with the reason cut to 200 characters;
    - a model refusal counts as a block;
    - texts sent as tagged data;
    - prices (micro-dollars, Haiku's long-prompt rate, unpriced models);
    - schema conversion.
  - `packages/db/src/llm-events.test.ts` (4): a usage event with cost and attempt; blocks kept with a 200-character excerpt and allows only when sampled; the third block in 24 hours flags the workspace once; older blocks don't count.
  - `apps/web/lib/moderation.test.ts` (5): a block is 422 with its category and is recorded; empty text skipped; moderation errors and timeouts let the request through; it still blocks if recording fails.
  - `lib/llm.test.ts` (3): a live call becomes a priced usage event; the stub records nothing; a failed write doesn't fail the request.
  - `e2e/moderation.spec.ts` (desktop): a blocked topic is 422 `CONTENT_BLOCKED` (category `illegal`) and saves nothing; a blocked edit to notes is 422 (category `sexual`) and leaves the video unchanged; the Library's prompt box shows the reason and keeps focus.
- No UI screens in this feature.
- Fixed after manual QA (another session):
  - **Prompt escape.** The moderation prompt wrapped each text in `<text>` tags without escaping, so a topic could close its own tag and leave a blocked word outside every text (QA's repro was saved as a project). The texts now go to the model as one line of JSON, which keeps each text inside its own string; the stub reads the same JSON. Tests: the repro is blocked (unit and e2e), a text containing `</text>` stays one text, and no raw newline or quote from a text reaches the prompt.
  - **Onboarding topic area.** It's now moderated on save, your choice on 14 Nov: `PUT /me/onboarding` returns 422 `CONTENT_BLOCKED`, and the field shows the reason, keeps the text and takes focus. Covered by an e2e test.
  - After `pnpm dev` was restarted: `pnpm test:e2e` 168 passed, 54 skipped. Before the restart, the dev server was serving stale pipeline code and let every topic through.

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

- Fixed 14 Nov after CI failed on the F12 pull request: two parallel starts on one video could both succeed. One request claimed the video before inserting its job; the other saw the claim, didn't find the job yet, took it for a left-over claim and cleared it. `createJob` now inserts the job before claiming, deletes it if the claim is refused, and frees the video before deleting a job. The parallel-start test now runs 25 pairs and fails on the old code locally (round 2); it passes on the fix.
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
| 24 Nov 2026 | Autosave (F22): offline, the editor's quick settings are kept and sent on reconnecting like draft edits (your choice). Unsaved drafts and settings are kept in IndexedDB per video (memory when it's blocked) and resent with their old `rev`, on reconnecting, every 10 s while offline, and on the next visit (a kept draft over an older rev is offered back as a conflict). A `409` never discards anything: the page shows the server's version and a banner offers this tab's draft ("Use my changes", which saves it over, or "Discard them"); before, the storyboard dropped it. Closing a tab sends a keep-alive `PUT` rather than SDD §4's `sendBeacon`, which can't send `PUT` or `X-Editor-Id`. The read-only notice's button says "Take over editing" (feature plan, SDD §4) everywhere, not API §5's "Edit here instead". |
| 24 Nov 2026 | Editor (F21, your choices): the Revise panel and Versions button stay out until F25 and F24; phones show Scenes and Style only; a narrator change offers "Record narration" at once (`POST /narration`, no revision counted yet). Also: the editor is full screen (no app sidebar, top bar or tab bar), as the design shows; one layout is picked in the browser at 768 px so there's one Player; the quick settings add Format (9:16, 16:9, 1:1), which the designs don't show, for the `setFormat` scope; scenes without narration show "No narration" (the scene row's own badge) and play silently for their estimated length; the project detail's `audio` carries signed links (1 hour) for the draft's recordings, and `GET /projects/{id}/audio` answers only for recordings the draft or a version uses. |
| 24 Nov 2026 | Narrators on the free plan (your choice): ElevenLabs' free API can't use Voice Library voices, which include the Indian narrators Ani and Rishika, so the default narrators are ElevenLabs default voices: Matilda (female, "Knowledgeable, Professional", American) and Daniel (male, "Steady Broadcaster", British). Both use the multilingual model, so Hindi works, with a non-Indian accent. The Indian narrators return with a paid plan (Starter, $6 a month); their ids are kept in `.env.example`. The free plan is for development: it's non-commercial and needs attribution. |
| 24 Nov 2026 | Generate (F20): local MongoDB runs in Docker as replica set `rs0` (`docker compose up -d`), because saving a version is a transaction (your choice); the Homebrew `mongod` is stopped. The thumbnail from the title scene waits for F26's render setup (your choice). Each batch of up to 4 scenes is one Inngest step (scenes in it run at once; a retried batch finds its finished scenes in the cache), and a scene is tried 3 times inside it, not again for errors that won't change (a refused key or text). A partial generation saves a version and counts the video (API §7); retrying failed scenes (`POST /narration`) uses no video and no revision. The stub voice's recordings have their own cache key, so turning the live voice on never replays silent audio. The stub refuses narration containing "Narration fails here", to try a failing scene. Speech text isn't rewritten for pronunciation yet (SDD §8 step 3), so on-screen words and spoken words stay the same for triggers. Errors: `WORKSPACE_BLOCKED` (403) for a blocked workspace; a narration request with nothing to record is `400 VALIDATION_FAILED`. |
| 20 Nov 2026 | Templates (F19): icons stay the closed list of Lucide icons bundled with `lucide-react` (DB §6), so nothing is fetched or cached at render time; the feature plan's "Iconify or Lucide, resolved and cached" isn't needed for V1. Chart values are written the Indian way: in full up to 99,999, then lakh, crore and lakh crore ("लाख", "करोड़" in Hindi, Latin digits). A unit of "%" follows the number, "₹" (or another currency sign) goes in front, and any other unit follows after a space. A pie shows whole percentages that add up to 100. Bars run across in 9:16 and 1:1 (labels need the width) and stand up in 16:9. A chart's or stat's source reads "Source: …" ("स्रोत: …" in Hindi). The quiz marks the answer with a tick as well as the accent; video themes have no success colour. No design screen shows these templates, so they follow the F18 templates' look. |
| 18 Nov 2026 | Video rendering (F18): the video themes use the design system's five colours per palette (`video-*` tokens), not the prototype's 11 hex values, since the design wins and colour literals aren't allowed. Other shades are mixed from those five, a comparison's right side is outlined rather than given a second accent, and paper (the light theme) puts white on its accent. The spoken word in captions uses the theme's highlight with dark text. Headings use Plus Jakarta Sans (the design rule), not the prototype's Inter 800. A scene's content box sits above a fixed captions band, so captions never cover a scene. A linear flowchart runs top to bottom in 1:1 as in 9:16 (DB §6 names only 9:16 and 16:9); a cycle is an ellipse. Element times are worked out when playing (SDD §7), in `@vidcosmos/spec/video`; stored `atMs` fields are ignored. Approved stills are quarter-size JPEGs committed in `packages/video/stills/approved` (2.4 MB: 135 of the 360 cases, every case in midnight and the other palettes only for the long English text; all 360 are still layout-checked), and CI doesn't render them (your choice); run `pnpm video:stills` before merging template changes. |
| 18 Nov 2026 | Storyboard checks (F17 QA): a draft save is moderated like a script edit, checking only what it adds. The settings own the spec's language, narrator, voice id, format, theme and music; a draft save keeps only the client's scenes and title. Before narration is recorded, the length is estimated from the words, and an estimate over 110 s (100 s plus a 10 s margin for the estimate) or under 20 s blocks Generate (your choice). A scene over 15 s is flagged on its card but doesn't block, since splitting scenes comes with F23. |
| 17 Nov 2026 | Storyboard (F17): a scene is edited in an "Edit scene" panel, a dialog on desktop and a full screen on phones (the designs show none). It edits the narration and each element's text, trigger words, icon and numbers. Adding, removing and reordering scenes wait for F23 (your choice). A new template is filled by hand, with no AI request: what fits is kept and missing elements come from words the narrator says, and a chart made from text gets the numbers its labels mention, or 1 each (your choice). Narration edited in the storyboard becomes the script (PRD FR-3.5), one paragraph a scene, unless the script changed after the storyboard. The draft's issue codes are `specIssues`'s (adds TRIGGER_OUT_OF_ORDER, DUPLICATE_SCENE_ID, NARRATION_MISMATCH and `path`). Text over its limit is a shape error (400), so there is no TEXT_TOO_LONG. Step 2's "Build the storyboard" builds the first storyboard (1 AI request), like step 1's script. The storyboard job moderates the script and the on-screen text. The narrator's ElevenLabs voice id comes from `.env` and goes in the draft's voice. On phones the storyboard is editable (MobileStoryboard), not read-only as SDD §4 says. |
| 16 Nov 2026 | Trigger order (F16 QA, your choice): each list's items (items, steps, a side's points, events, bars, slices, options) must follow the narration's order; headings, titles and other single fields only need to be said somewhere in the scene, except a quiz's reveal and a recap's call to action, which come after the list they close. DB §6 says "in order across the scene"; the prototype only checked that each trigger was said. |
| 16 Nov 2026 | VideoSpec (F16): template fields sit under `scene.content`, as in the prototype and SDD §7 (DB §6's type is ambiguous about it). `userEdited` is a boolean (DB §6), not SDD's list of edited paths. The total length is 20-100 s (DB §6), not SDD §10's 30-90 s. A comparison side has 1-4 points, not DB's 2-4, so the prototype's Hindi UPI sample (one point on a side) validates, as the feature plan asks. A heading on a non-title template may have no trigger, and then it's on screen from the start, as in the prototype. Where DB §6 gives no limit, the prototype's or a nearby one is used (`limits` in `templates.ts`). The asset id in `timing` is stored as hex text, so the spec stays plain JSON. |
| 16 Nov 2026 | Edit lease on PATCH (F15 QA): a `PATCH /projects/{id}` that changes the script needs `X-Editor-Id` and the lease (`423 LEASE_HELD`); any PATCH that sends `X-Editor-Id` is checked the same way. A PATCH without it, such as the library's rename, works as before. API §5 says only one editor tab may change a project. |
| 16 Nov 2026 | Script (F15): step 1's "Write the script" (and "… from the topic") starts the first script and opens step 2, so it uses 1 AI request; a video that has a script just opens it (your choice, 15 Nov). The fit badge allows 15% either way (PRD FR-2.4). The hook is the script's first sentence, kept in step with the text. Rewrite chips follow the design: Shorter, Longer, Simpler, More engaging, Custom… (`more_formal` is in the API only). A rewrite whose script was edited while it ran ends cancelled, so the edit stays. Script events carry ids only (API §15). |
| 15 Nov 2026 | Angles (F14): "Suggest angles" asks for 4 (3-5 allowed), following API §6 and the NewVideo design, not the 5-10 in PRD FR-1.2, SDD §8 and the feature plan. Each AI step's request is settled by `finishJob`: failed or cancelled jobs give it back, succeeded jobs keep it; retrying a job that used one uses another. On phones, create steps (`/projects/new`, `…/idea`, `…/script`, `…/storyboard`) hide the top bar and tab bar and show their own header and bottom button. |
| 14 Nov 2026 | LLM (F13): the Claude provider asks for JSON-schema structured output (`output_config.format`) instead of the prototype's forced tool call, which current Claude models (Sonnet 5.5, Opus 5.5) reject with a 400. On Claude models that support it, Claude's server-side fallback is on (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`): a declined request is re-run on another model within the same call; a refusal that stands is `CONTENT_BLOCKED`. Three moderation blocks in 24 hours flag a workspace for review (DB §4; SDD §15 says 5 a day). The onboarding topic area is moderated on save like a topic (user's choice, after QA). Texts reach the moderation model as escaped JSON, never inside tags. Moderation lets the request through when it errors or takes over 5 s (API §5). The stub blocks "bomb"/"explosive(s)" (illegal) and "porn"/"nsfw"/"nude" (sexual), so the blocked path works without keys. |
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

- **Autosave: what waits (F22).**
  - The script step (F15) still saves on its own (no offline queue); F23's scene editing in the editor will use `useDraftAutosave`.
  - A keep-alive request on closing the tab carries at most 64 KB; a bigger draft relies on the copy kept in the browser for the next visit.

- **Editor: what waits (F21).**
  - The Revise chat (F25), Versions (F24), scene editing and "Add a scene" (F23), and autosave states beyond "Saving…/Saved" (F22) join the editor later.
  - Thumbnails are drawn by the composition (one Remotion thumbnail per scene, in the list and the phone strip); fine for 10 scenes, but worth checking on slow phones.
  - Fonts in the Player come from the page; a font still loading on first paint can show a fallback for a moment.

- **Generate: what waits (F20).**
  - The narrators are ElevenLabs default voices (Matilda, Daniel) until a paid plan brings back the Indian ones (Ani, Rishika); none has been heard in Hindi yet. The free plan isn't for launch: non-commercial, attribution, 10,000 characters a month.
  - ElevenLabs lists Multilingual v2 at $0.08 per 1,000 characters on every plan; the price table (`narrationCost`) uses the SDD's estimate of $0.10, so usage events overstate narration by 25% until it's updated.
  - The live R2 test (`packages/integrations/src/storage/r2.test.ts`, run only with R2 keys in `.env`) failed twice during `pnpm test` while every package tested at once, and passed both times on its own: a timeout against Cloudflare under load, not an F20 change.
  - With `PROVIDERS_TTS=live` the e2e tests use real characters, and the failing-scene test fails (only the stub refuses its phrase): run them with the stub voice.
  - Speech text isn't rewritten for pronunciation (SDD §8 step 3: "2x" → "two times", ₹ amounts); ElevenLabs reads the narration as written.
  - ElevenLabs calls have no account-wide concurrency limit yet (SDD §8 "Rate limits"); each run records 4 scenes at a time.
  - The editor's Player and `GET /projects/{id}/audio` (playback URLs) come with F21; until then the editor is a placeholder that Generate opens.
  - Re-recording after narration or voice edits uses a revision (API §7); counting it arrives with the editor's edits (F22). Retrying failed scenes uses none.
  - "We'll let you know when it's ready" needs notifications (F31); the thumbnail waits for F26.
  - The full e2e suite with the default workers timed out on navigation in 22 tests while this machine was loaded (load 14-19, disk 95% full); they pass with `--workers=2`.

- **Video: what waits (F18).**
  - CI doesn't render the stills (your choice): run `pnpm video:stills` before merging a template change, and `--approve` once the new look is right. The first run downloads Remotion's headless Chrome (about 140 MB).
  - Text is fitted from an estimate of its width (`fitBox`), not measured; the layout check catches what the estimate gets wrong, but only in the still cases. Real content is checked in F21's preview.
  - The still cases' text is made-up words cut to each limit, not real sentences, so line breaks fall mid-word at the longest lengths.
  - Hindi scenes in an English video aren't a case (the language is per video).
  - Not built yet: the app's Player and its font loading (F21), the prebuilt Remotion bundle for exports and its `tooling/remotion-bundle` step (F26), and music files (`music:<trackId>` in `assets`).
  - Emoji are allowed in on-screen text and render with the machine's emoji font. The export host (F26) may have none, which would show empty boxes: bundle an emoji font there, or remove emoji from on-screen text (a decision for F26).
  - Caption pages break after sentences and at 32 characters, but not at commas; long Hindi words can make a line wrap inside the caption box. The layout check covers the box's edges, not the line count.

- **Step 3: what waits (F17).**
  - Video 6afc8410a97835d9464138a9 (QA account) has a blocked sentence in its script, saved before draft saves were moderated. Remove the sentence in step 2, or delete the video.
  - Adding, removing, duplicating and reordering scenes, and adding or removing elements within a scene, come with F23. A scene over 15 s isn't offered a split yet (PRD edge case).
  - Generate starts the generation (since F20).
  - The cards' preview is the headline and theme colours, not a rendered frame (F18-F21).
  - Changing the narration in step 3 rewrites the script as one paragraph a scene, so the script's own paragraph breaks are lost.
  - Text in an icon picker is the icon's name; there's no search or preview of the icons yet (PRD FR-4.4).
  - The storyboard prompt hasn't been tried against Gemini or Claude yet (`pnpm check:llm` covers ideas and the script only). The 12-template schema is large; check it with real keys before F20.
  - A fourth time (17 Nov, the stub storyboard), the running `pnpm dev` served old workspace-package code until it was restarted.

- **Video spec: what waits (F16).**
  - Since F17 the draft PUT and the project DTO use `videoSpec`; the MongoDB validator still checks only the top level (DB §13). A stored draft that doesn't parse (written before F17) shows as no storyboard (`draftSpec`); `migrateSpec` isn't run on read, since no prototype specs are stored.
  - `atMs` fields are allowed but not used: SDD §7 derives element times from `timing.words` when playing (F18-F21).
  - The icon list is the prototype's (102 names, PascalCase). Remotion maps them to Lucide components in F18.

- **Step 2: what waits (F15).**
  - The editor is a plain text box, not rich text (PRD FR-2.4); nothing in the script needs formatting yet.
  - "Undo last rewrite" lasts until the next edit, and isn't offered after a reload during a running rewrite.
  - "Trim to fit" is a "shorter" rewrite: one try, not a loop to the exact length. "Use 30 s" isn't offered for a short script.
  - Hindi narration with an English script (PRD edge case "language doesn't match") isn't detected yet.
  - A third time (16 Nov, the stub LLM), the running `pnpm dev` served old workspace-package code until it was restarted.
  - The stale banner's "Dismiss" isn't remembered: the banner returns on reload while the script is stale. Accepting a stale script for good would need an API field.
  - Step 1's "Edit here instead" doesn't reload the fields the other tab may have changed (step 2's does).

- **Step 1: what waits (F14).**
  - "More like this" and the history of earlier angle sets (PRD FR-1.3) aren't in the API or the design; for later.
  - A failed or cancelled ideas job gives its AI request back, but the page's count only updates when the job is watched to the end; a reload shows the true number.
  - `POST /jobs/{id}/retry` doesn't check the edit lease (the progress card doesn't send `X-Editor-Id`); the ideas screen retries through `POST /projects/{id}/ideas`, which does.
  - Twice, after code changes, the running `pnpm dev` kept serving old code (a pipeline file on 14 Nov, `lib/jobs.ts` on 15 Nov) until it was restarted. If it happens again, look at Turbopack's watch root for the workspace packages.

- **LLM: still to do (F13).**
  - Run `pnpm check:llm` once a `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY` with `ANTHROPIC_MODEL`) is in `.env`; nothing has called a real model yet.
  - Gemini's paid prices aren't in `pricing.ts`: on the free tier, events record tokens with `costMicroUsd: 0` (DB §4).
  - The nightly eval on both providers (SDD §8) and the admin cost and moderation views (F34) are later.
  - The AI steps moderate again when they run (F14 onwards), which catches what was let through while moderation was unavailable.

- **Storage: still to do (F12).**
  - In the Cloudflare dashboard, set the bucket's CORS: GET and HEAD with Range from the app's origins.
  - Add the 120-day lifecycle rule on `exports/` (SDD §12).
  - Project thumbnails get signed URLs once something writes `thumbnailKey` (F26).
  - The narration step uses `findAsset`, `recordAsset` and `touchAssets` (since F20).
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
  - `/dev/jobs` lists only running jobs, so after a reload a failed job and its Try again are gone. The Generating screen (F20) shows the project's latest generation when it failed or was cancelled, with Try again (found in QA of F11).
- **Run the Inngest Dev Server for jobs:** `pnpm inngest` (dashboard on http://127.0.0.1:8288, this machine only) next to `pnpm dev`. Without it, jobs stay queued. `pnpm test:e2e` starts it.

- **TypeScript 6.0, not 7.** `typescript-eslint` 8.72 supports TypeScript `<6.1`, so the repo pins `typescript@6.0.3`. Move to 7 when typescript-eslint supports it.
- **ESLint 9.** ESLint 9.39 is marked deprecated in favour of 10; kept on 9 because `eslint-config-next` 16 pulls in React plugins that are tested on 9. Revisit with the next Next.js upgrade.
- **First CI run not confirmed.** `main` is pushed to `github.com/rajwantprajapati/vidcosmos`, but no Actions run had appeared when last checked, and the GitHub CLI is not signed in on this machine. Check the Actions tab, and run `gh auth login` so pull requests can be opened from here.
- **Prototype folder is empty.** `/Users/rajwant/Developer/namaste-ai/season-2/vidcosmos-prototype` has no files, but F13, F16, F18 and F20 are meant to port from it. Restore it before F13.
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
- **Usage: what waits.** Videos are reserved, committed and released with generation (F20), and the stuck-job cron gives back what dead jobs held. The daily export counter arrives with F26.
- **Settings shows only Usage and Account.** The rest of the Settings design (account form, video defaults, Instagram, notifications, delete) is F30.
- **`PATCH /me` is F30.** API §4 lists it (name, time zone, UI language); it returns 405 until the Settings account form arrives.
