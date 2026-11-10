Vidcosmos turns a prompt into a finished video: explainers, product ads, stories, travel reels, quotes and music visuals, narrated in English or Hindi and ready for Instagram. Tagline: **A universe of videos, made by AI.**

The interface is calm so the videos can be loud. Light mode is **Lagoon Classic**: white and pale mint-grey grounds, ink text, teal for the one thing to do next. Dark mode is **Lagoon Night**: a deep lagoon-night ground where the same teal glows. Coral appears in exactly one role: the word being spoken.

## Voice and content

- Write the way a helpful producer talks: short, plain, specific. "Recording narration (4 of 7 scenes)", not "Processing your request".
- Second person, sentence case everywhere: "Make your first video", "Save version". Never Title Case buttons.
- Buttons start with a verb and say what happens: "Generate video", "Apply changes", "Post to Instagram". The toast confirms with the past tense: "Version 4 saved".
- Errors say what went wrong and what to do: "Instagram didn't accept the video because it is longer than 90 seconds. Shorten it or export a 60-second version."
- Numbers: "60 s", "1080p", "12 of 20 videos", "0:58". Use tabular figures for timings and counters.
- Hindi UI copy is natural Hindi, not translated English. Keep product nouns in English where users say them in English ("वीडियो", "स्क्रिप्ट", "Instagram").
- No emoji in the interface. No exclamation marks except in a first-video celebration.

## Colour

Use semantic tokens in components, never primitives (`teal-500`, `slate-200`…) directly; primitives exist so the semantic tokens can alias them per theme.

- **Grounds.** `bg` is the page. Put content on `surface` (cards, panels, inputs). Menus and dialogs sit on `surface-raised` with `shadow-md` or `shadow-lg`. `surface-sunken` is for tracks, wells and empty states. Toasts use `surface-inverse` with `ink-inverse`.
- **Text.** `ink` for primary text, `ink-secondary` for long body copy that should recede, `ink-muted` for metadata and helper text. All three pass 4.5:1 on every ground in both themes. `ink-disabled` is only for disabled controls.
- **Brand teal.** `brand` fills the primary button, the selected state and progress. Its label is always `on-brand` (ink), never white: white on teal fails contrast. One primary button per view. Teal as text is `brand-text` (links, active tab). Selected rows sit on `brand-soft` with a `brand-soft-line` border.
- **Coral highlight.** `highlight` marks the spoken word in captions and, at most once per screen, one emphasised word in a marketing headline (on `highlight` with `on-highlight` text). Coral never means status: an edited scene is `warning`, a failure is `danger`.
- **Status.** `success` (Ready, Published), `warning` (Scheduled, Edited, Expiring), `danger` (Failed, Missed, errors), `info` (tips, neutral notices). Text tokens on their `-soft` grounds. Every status also carries a word or icon, never colour alone: success and danger differ in hue more than in lightness.
- **Lines.** `line` for hairlines and card borders. `line-strong` for input and secondary-button borders, which must stay visible (3:1).
- **The stage.** `stage` is the dark ground behind the video player and every thumbnail in both themes, so a video looks the same in light and dark mode.
- **Teal fill on white is 2.5:1.** That is fine for buttons and bars because they carry a label or a value; never use a teal fill alone to carry meaning.

## Typography

- Headings: **Plus Jakarta Sans** 600 to 800 (`display-xl`, `display`, `h1`, `h2`, `h3`). Tracking tightens with size, as set in each style.
- Everything people read or operate: **Inter** (`body-lg`, `body`, `body-sm`, `label`, `small`, `overline`).
- `display-xl` appears once, in the marketing hero. Each app screen has one `h1`.
- `overline` is set in uppercase for section eyebrows only, never for sentences.
- Scripts and chat use `body` at most `reading-max` (680px) wide.
- Use `font-variant-numeric: tabular-nums` for durations, timecodes, counters and usage.

### Hindi

- Devanagari uses **Noto Sans Devanagari** via the `deva` family: `hi-heading`, `hi-body`, `hi-label`.
- Hindi needs about 6% more size and 15% more line height than Latin to look the same weight; the `hi-` styles already include this. Never put Devanagari in `display` or `h1` styles with negative tracking.
- In mixed lines (Hindi with English product words) set the line in `deva`; it carries Latin glyphs from Inter in the stack.

## Spacing and layout

- A 4 px base: `space-1` to `space-24`. Lay out groups with flex or grid and `gap`; don't stack margins.
- Cards pad `space-6` (`space-4` on phones). Page sides pad `space-10` on desktop, `space-4` on phones.
- Marketing content and the library grid stop at `container-max`. Reading content stops at `reading-max`.
- App frame: `sidebar-width` navigation, `topbar-height` top bar. Below `breakpoint-md` the sidebar becomes a bottom bar; from `breakpoint-lg` the editor shows scenes, player and chat side by side.

## Shape and elevation

- Radii: `radius-md` for buttons and inputs, `radius-lg` for cards and thumbnails, `radius-xl` for dialogs and the player frame, `radius-full` for badges, chips and progress bars. Don't round everything the same: hierarchy comes from the difference.
- Borders separate things on the page; shadows only lift things that float: `shadow-sm` on hover or drag, `shadow-md` for menus, popovers and toasts, `shadow-lg` for dialogs with `scrim` behind.
- No gradients in the interface. No coloured left-border accents on cards.

## States

- **Hover:** brand buttons move to `brand-hover`; ghost buttons, rows and menu items take `surface-hover`.
- **Pressed:** scale to 0.98 for 80 ms; no colour change.
- **Focus:** every interactive element shows a solid 2 px `focus-ring` with a 2 px gap in `bg` (`box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--focus-ring)`), on keyboard focus only (`:focus-visible`).
- **Disabled:** 45% opacity on the whole control, `cursor: not-allowed`, no hover. Explain why nearby when it isn't obvious ("Add a script first").
- **Loading:** buttons keep their width and show a spinner in place of the leading icon, with the label changed to the progressive ("Generating…").
- **Selected:** `brand-soft` ground plus `brand-soft-line` border, or the white "pill" in a segmented control. Never colour alone.

## Motion

- Durations: 120 ms for hover and press, 200 ms for menus and toasts, 320 ms for dialogs and panel slides. Easing `cubic-bezier(0.2, 0, 0, 1)` in, `cubic-bezier(0.4, 0, 1, 1)` out.
- Progress moves smoothly and never goes backwards.
- With `prefers-reduced-motion: reduce`, replace movement with fades and stop looping animations (spinners slow to a pulse).
- The interface stays still; motion belongs to the videos.

## Iconography

- **Lucide** icons (`lucide-react`), outline style, 1.75 px stroke, at 16, 20 or 24 px, coloured with `currentColor`. They are the same icon set the video templates use.
- Icons sit beside a label; icon-only buttons need an `aria-label` and a tooltip.
- No emoji, no filled icon styles, no mixed icon sets. The bundle's `Icon` component carries the handful of glyphs the components need.

## Logo

- `vidcosmos-logo.svg` (wordmark in ink) on light grounds; `vidcosmos-logo-reversed.svg` on dark grounds and on `stage`. `vidcosmos-mark.svg` alone for app icons, favicons and small spaces.
- The mark is a teal disc with a coral orbit and an ink play symbol: one video inside its own universe. The wordmark is Plus Jakarta Sans 800, all lowercase: write the name as "Vidcosmos" in text, show it as "vidcosmos" only in the logo.
- Clear space around the logo: the height of the mark's disc on every side. Minimum size: mark 20 px, full logo 96 px wide.
- In product UI, render the `Logo` component so it follows the theme. Don't recolour, outline, stretch or add effects to the logo.

## Video themes

The colours inside rendered videos are separate from the app UI, so users get variety. Each video uses one theme: `video-midnight-*`, `video-paper-*`, `video-ocean-*` or `video-sunset-*`, with five roles: `bg`, `panel`, `text`, `accent` and `highlight`. Captions put the spoken word on the `highlight` colour with dark text. Never use video tokens in app UI, or app tokens inside videos.

## Accessibility

- Text meets 4.5:1 (3:1 at 24 px and larger) on its ground in both themes; control borders, focus rings and meaningful icons meet 3:1. The token notes name the grounds each text colour is safe on.
- Hit targets are at least 40 px tall on desktop and 44 px on touch.
- Status is never colour alone. Every icon-only control has a label.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`. The user's explicit theme choice wins over the system's.

## Components

Components are React 18 components in `components/bundle.js` under `window.Vidcosmos`, styled by `components/bundle.css` with the tokens above (class prefix `vc-`). Wrap nothing: they read the theme from the nearest `data-theme` attribute, so a section can switch to dark by setting `data-theme="dark"` on its wrapper.

To use the system on a page or a Design canvas, load in this order: `tokens.css` (tokens, type classes and `@font-face` for the files in `fonts/`), `components/bundle.css`, React 18 and ReactDOM 18, then `components/bundle.js`.

- **Actions:** `Button`, `Icon`.
- **Forms:** `TextField`, `SegmentedControl`, `Chip`.
- **Status:** `Badge`, `ProgressBar`, `Toast`.
- **Layout:** `Card`.
- **Brand:** `Logo`.
- **Product:** `PromptComposer`, `VideoCard`, `SceneRow`, `ChatMessage`, `ProposalCard`, `UsageMeter`.
