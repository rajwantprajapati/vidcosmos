# Vidcosmos

A universe of videos, made by AI. Describe a video; Vidcosmos writes the script, plans the scenes, records an Indian narrator in English or Hindi, animates every scene to the spoken word, and posts it to Instagram.

**Status:** building M0 Foundations (F01 and F02 done). See [`STATUS.md`](STATUS.md).

## Start here

- [`STATUS.md`](STATUS.md): where the build stands and what is next
- [`docs/05-feature-plan.md`](docs/05-feature-plan.md): the 36 features in build order
- [`docs/01-prd.md`](docs/01-prd.md): product requirements
- [`docs/02-system-design.md`](docs/02-system-design.md): architecture and stack
- [`docs/03-database-design.md`](docs/03-database-design.md): MongoDB collections and the video spec
- [`docs/04-api-design.md`](docs/04-api-design.md): the `/api/v1` API
- [`design/`](design/README.md): screen designs (desktop and mobile) and the design system
- [`CLAUDE.md`](CLAUDE.md): how Claude Code works in this repository

## First-time setup in Claude Code

1. Open this folder in Claude Code (`cd /Users/rajwant/Developer/namaste-ai/vidcosmos && claude`).
2. Ask Claude Code to install the two project commands: move `tools/claude-commands/*.md` to `.claude/commands/` and delete the empty `.claude/commands/x`. Then `/next-feature` builds the next feature and `/status` summarises progress.
3. Copy `.env.example` to `.env` (only `MONGODB_URI`, `BETTER_AUTH_SECRET` and `PROVIDERS=stub` are needed to start). For a local database run `docker compose up -d` (MongoDB 8 on port 27017; stop any other MongoDB on that port first).
4. Run `/next-feature` to start F01.

## Stack

Next.js on Vercel (Mumbai), MongoDB Atlas, Better Auth, Inngest, Remotion (Player for preview, Vercel Sandbox for export), ElevenLabs, Gemini or Claude, Cloudflare R2, Resend. One TypeScript monorepo with pnpm and Turborepo.

## Living versions of the docs

The Markdown files here are exports from 10 Nov 2026. The editable originals (with comments) are on claude.ai:
[PRD](https://claude.ai/artifact/ELnaGQtcDHkrZTfnAVH7km) ·
[System Design](https://claude.ai/artifact/SZ5aHmXe9VFYaaHMZi9K9J) ·
[Database Design](https://claude.ai/artifact/PoRFUsZ4eBRQxQ79Nk21Us) ·
[API Design](https://claude.ai/artifact/ERmNphEXFQCK7eiYZWVFs6) ·
[Screen designs](https://claude.ai/artifact/1zw824yRx2C5bKhGyyu9UF) ·
[Design system](https://claude.ai/artifact/UNxK8B1jrxwaNzk3ALXWZC)

When a doc changes, re-export it here in the same commit as the code that depends on it.
