# Vidcosmos designs

Exported 10 Nov 2026 from the claude.ai design artifacts ([screens](https://claude.ai/artifact/1zw824yRx2C5bKhGyyu9UF), [design system](https://claude.ai/artifact/UNxK8B1jrxwaNzk3ALXWZC)). They were made in Claude's design canvas, not Figma.

## Screens

Desktop PNGs are 1440 px wide; mobile PNGs are 390 px wide at 2× (780 px files). Use them to check every UI feature (see the feature plan, step 5).

| Screen | Desktop | Mobile | Route |
| --- | --- | --- | --- |
| Home page (animated hero) | `screens/desktop/Main.png` | `screens/mobile/MobileHome.png` | `/` |
| Sign in / Create account | `SignIn.png` | `MobileSignIn.png` | `/sign-in`, `/sign-up` |
| Onboarding | `Onboarding.png` | (stacks like sign in) | `/onboarding` |
| Library (app home) | `Library.png` | `MobileLibrary.png` | `/library` |
| Step 1 · Idea and angles | `NewVideo.png` | `MobileNewVideo.png` | `/projects/[id]/idea` |
| Step 2 · Script | `Script.png` | `MobileScript.png` | `/projects/[id]/script` |
| Step 3 · Storyboard | `Storyboard.png` | `MobileStoryboard.png` | `/projects/[id]/storyboard` |
| Step 4 · Generating | `Generating.png` | (same layout, stacked) | `/projects/[id]/generating` |
| Editor: preview and revise | `Editor.png` | `MobileEditor.png`, `MobileEditorChat.png` | `/projects/[id]` |
| Export and post | `ExportPost.png` | `MobileExport.png` | `/projects/[id]/export` |
| Posts | `Posts.png` | `MobilePosts.png` | `/posts` |
| Settings | `Settings.png` | `MobileSettings.png` | `/settings` |
| Admin console (desktop only) | `Admin.png` | — | `/admin` |
| Parts: app sidebar, create steps, mobile tab bar | `AppSidebar.png`, `Stepper.png` | `MobileTabBar.png` | — |

`screens/source/` holds each screen's source (`*.dc.html`) and the canvas layout (`canvas.json`). They don't render on their own (they need the canvas runtime), but they are the exact reference for copy, spacing, sizes, states and animation: inline styles use the design tokens by name, and a `<script type="text/x-dc">` block at the end of each file holds the sample data and interactive states. Some screens have alternate states in the canvas ("tweaks"): the editor's chat or versions panel, the library's empty state and notifications, the admin's sample data. Read them in the source.

## Design system

`design-system/` is the source of truth for the look:

- `README.md`: the rules for colour, type, spacing, shape, states, motion and copy. Read it before any UI work.
- `tokens.json`: every token, light and dark; `tokens.css`: the same as CSS custom properties (`[data-theme="dark"]` switches theme).
- `fonts/`: Plus Jakarta Sans (600–800), Inter (400–700), Noto Sans Devanagari (400–700), self-hosted woff2.
- `logos/`: full logo, reversed logo and mark (SVG).
- `components/`: the 16 reference components. Each folder's `README.md` describes props, variants, states and accessibility; `index.d.ts` has the prop types; `bundle.js` and `bundle.css` are the reference implementation (React 18, `window.Vidcosmos`) to port into the app's own TSX components.
- `previews/`: each component rendered in light and dark.
