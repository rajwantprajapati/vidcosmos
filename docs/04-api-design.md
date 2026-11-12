# Vidcosmos — API Design (V1)

Nov 10, 2026 · @Rajwant Prajapati

## 1. Overview and conventions

This document defines every HTTP endpoint of Vidcosmos V1: the public API the web app calls, the routes Better Auth serves, and the internal routes for Inngest, cron and webhooks. It follows the PRD's features one for one and stores data as described in the DB Design doc. Request and response bodies are written as TypeScript types; each is a zod schema in `packages/spec/api`, and the OpenAPI file is generated from those schemas (Section 17).

The API serves the Vidcosmos web app only. There are no public API keys in V1, but the API is designed as if there were: versioned, consistent, and documented.

### Basics

| Item | Convention |
| --- | --- |
| Base URL | `https://app.vidcosmos.com/api/v1` (domain not final; Next.js route handlers on Vercel, region `bom1`) |
| Auth | Better Auth session cookie (`__Secure-better-auth.session_token`), `HttpOnly`, `SameSite=Lax`. Every `/api/v1` route requires a session unless marked public |
| CSRF | Cookie auth plus `SameSite=Lax`, and every state-changing request must send `Origin` matching the app's origin; anything else gets `403 CSRF_ORIGIN` |
| Format | JSON in and out, `Content-Type: application/json; charset=utf-8`. Request bodies up to 256 KB (the VideoSpec is the largest, about 30 KB) |
| Field names | `camelCase`, matching the database |
| Ids | 24-character hex strings (MongoDB ObjectIds). Scene ids are `sc_` + 8 characters |
| Times | ISO 8601 in UTC with milliseconds, e.g. `2026-11-10T09:30:00.000Z`. The client shows them in the user's `timeZone` |
| Durations | Integer milliseconds, named `...Ms` |
| Money | Not exposed to users in V1. Admin endpoints use integer micro-USD |
| Nulls | A field that has no value is `null`, not missing. Optional request fields can be left out |
| Tenancy | The workspace comes from the session. No endpoint takes a `workspaceId` from the client; ids of another workspace return `404` |

### Methods and status codes

| Use | Method | Success |
| --- | --- | --- |
| Read | `GET` | `200` |
| Create a resource | `POST` | `201` with the resource and a `Location` header |
| Start background work | `POST` | `202` with a `Job` (Section 3) |
| Partial update | `PATCH` | `200` with the updated resource |
| Replace a whole sub-document (the draft spec) | `PUT` | `200` |
| Delete | `DELETE` | `204`, or `202` when deletion is a job |
| Action on a resource | `POST /resource/{id}/{verb}` | `200`, or `202` if it starts a job |

### Long-running work

Everything that calls an AI provider, renders or posts runs in the background. The endpoint validates, checks limits, creates a `jobs` row, sends an Inngest event and returns `202 Accepted` with the job. The client then follows the job:

1. `GET /jobs/{id}` every 2 seconds while the job is visible (with `ETag`, so unchanged polls cost a `304`), or
2. `GET /jobs/{id}/events`, a Server-Sent Events stream that pushes the job on every change and closes when it finishes. The client falls back to polling if the stream drops.

The job's `result` names what changed (for example `{ versionNumber: 4 }`), and the client then fetches it. Nothing is returned in the `202` that could go stale.

### Idempotency

Every `POST` that creates something or starts a job accepts an `Idempotency-Key` header (a UUID the client generates per user action). The same key within 24 hours returns the original response, with `Idempotent-Replayed: true`. The same key with a different body returns `422 IDEMPOTENCY_MISMATCH`. The web app sends one on every such request, so a double click or a retried request never creates two jobs.

### Optimistic concurrency

The draft spec carries a `rev`. Writes that change it send the `rev` they were based on (`If-Match: "rev-12"` or `baseRev` in the body). If someone else wrote first, the API returns `409 REV_CONFLICT` with the current `rev`, and the client reloads. Editing also requires holding the project's edit lease (Section 5); without it, writes return `423 LEASE_HELD`.

### Pagination

Lists use cursors, never page numbers:

```http
GET /api/v1/projects?limit=24&cursor=eyJ1IjoiMjAyNi0xMS0xMFQwOTozMDowMC4wMDBaIiwiaSI6IjY3MzAuLi4ifQ
```

`limit` defaults to 24 and is capped at 100. The response is a `Page<T>` with `nextCursor` (`null` on the last page). Cursors are opaque, base64url-encoded, and tied to the sort; a cursor used with a different sort returns `400 INVALID_CURSOR`.

### Files and URLs

The API never streams video or audio itself. Responses that need a file include a presigned Cloudflare R2 URL with its expiry: `{ url, expiresAt }`. Playback and download URLs last 15 minutes; the client asks again when one expires. Stored data never holds URLs, only keys, so a URL in a response is always fresh.

### Request ids and logs

Every response carries `X-Request-Id` (also in error bodies as `requestId`). The same id goes into Sentry, the logs, and the Inngest event, so one id traces a click through to the background job.

### Caching

`/api/v1` responses send `Cache-Control: private, no-store`, except `GET /jobs/{id}` and `GET /projects/{id}` which send an `ETag` for conditional requests.

## 2. Errors

Every error has the same body, whatever the status:

```ts
type ErrorBody = {
  error: {
    code: string;                      // stable, SCREAMING_SNAKE; the client switches on this, never on message
    message: string;                   // plain English for the user; safe to show
    retryable: boolean;                // true if the same request may succeed later
    details?: Record<string, unknown>; // machine-readable extras, listed per code below
    fields?: Array<{ path: string; message: string }>;  // VALIDATION_FAILED only, e.g. path 'idea.topic'
    requestId: string;
  };
};
```

Messages never contain stack traces, provider names, internal ids or other users' data. Provider errors are logged with full detail and returned as one of the codes below.

### Request errors

| Status | Code | When | `details` |
| --- | --- | --- | --- |
| 400 | `VALIDATION_FAILED` | Body, query or params fail the zod schema | `fields` is set |
| 400 | `INVALID_CURSOR` | Cursor is malformed or from another sort |  |
| 401 | `UNAUTHENTICATED` | No session, or it expired |  |
| 403 | `CSRF_ORIGIN` | State-changing request with a missing or foreign `Origin` |  |
| 403 | `EMAIL_NOT_VERIFIED` | Email/password user hasn't verified; AI work and posting refused |  |
| 403 | `WORKSPACE_BLOCKED` | An admin blocked the workspace |  |
| 403 | `FORBIDDEN` | Signed in, but this action isn't allowed (e.g. admin route) |  |
| 403 | `LIMIT_REACHED` | A usage limit is used up | `{ limit: 'videosPerMonth' or 'revisionsPerVideo' or 'generationsPerVideo' or 'exportsPerDay' or 'concurrentJobs', used, max, resetsAt }` |
| 404 | `NOT_FOUND` | No such resource in this workspace (also for other workspaces' ids) |  |
| 409 | `REV_CONFLICT` | `baseRev` is not the draft's current `rev` | `{ currentRev }` |
| 409 | `JOB_IN_PROGRESS` | Another job is already changing this project | `{ jobId }` |
| 409 | `STAGE_INVALID` | The project isn't at a step where this is allowed (e.g. generate without a storyboard) | `{ stage, wizardStep, needs }` |
| 409 | `PROPOSAL_STALE` | The video changed since the proposal was made, and the change conflicts | `{ conflictingSceneIds }` |
| 409 | `PROPOSAL_CLOSED` | The proposal was already applied, dismissed or failed | `{ status }` |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | A request with the same `Idempotency-Key` is still being handled (retryable) |  |
| 409 | `NOT_CANCELLABLE` | The job or post is past the point where it can be stopped | `{ status }` |
| 409 | `ACCOUNT_ALREADY_CONNECTED` | The workspace already has an Instagram account |  |
| 409 | `INSTAGRAM_NOT_CONNECTED` | Posting without a connected account, or the account needs reconnecting | `{ status }` |
| 409 | `EXPORT_NOT_READY` | Posting or downloading an export that isn't `ready` | `{ status }` |
| 410 | `EXPORT_EXPIRED` | The export's files were deleted after 30 days |  |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 256 KB |  |
| 422 | `IDEMPOTENCY_MISMATCH` | `Idempotency-Key` reused with a different body |  |
| 422 | `CONTENT_BLOCKED` | Moderation refused the topic, notes, script, chat message or caption | `{ category }` |
| 422 | `SPEC_INVALID` | The spec passes the schema but fails a semantic rule (Section 6 of the DB doc) | `{ issues: Array<{ sceneId?, message }> }` |
| 422 | `SCHEDULE_INVALID` | Time is in the past, under 10 minutes away, or over 75 days away | `{ earliest, latest }` |
| 423 | `LEASE_HELD` | Someone else (another tab or device) is editing | `{ heldBy: 'you_elsewhere' or 'other', expiresAt }` |
| 429 | `RATE_LIMITED` | Too many requests (Section 16) | `Retry-After` header, `{ retryAfterMs }` |
| 500 | `INTERNAL` | A bug. Sentry has the details |  |
| 503 | `SERVICE_UNAVAILABLE` | Maintenance, or a provider is down and the request can't be queued | `Retry-After` header |

`LIMIT_REACHED` is a `403`, not a `429`: waiting a few seconds won't help, and the client shows the limit and when it resets instead of retrying.

Two more request errors, used by specific endpoints:

- `403 REAUTH_REQUIRED`: the action needs a recent sign-in (account deletion for Google users, admin routes). The app sends the user through sign-in again.
- `426 UPGRADE_REQUIRED`: the tab runs app code older than the API supports (`X-App-Version`, Section 17). The app saves the draft and reloads.

### Job errors

Background failures don't come back as HTTP errors: the job ends `failed` (or `partial`) with an `error` in the same shape, minus `requestId`. The client shows `message` and offers "Try again" when `retryable` is true.

| Code | Retryable | Meaning | What the user sees |
| --- | --- | --- | --- |
| `LLM_INVALID_OUTPUT` | yes | The model's answer failed validation 3 times | "The AI couldn't build a valid storyboard. Try again, or simplify the script." |
| `LLM_RATE_LIMITED` | yes | Provider quota hit and retries ran out (the Gemini free tier) | "The AI service is busy. Try again in a minute." |
| `LLM_UNAVAILABLE` | yes | Provider 5xx or timeout after retries | "The AI service is having trouble. Try again shortly." |
| `CONTENT_BLOCKED` | no | Moderation refused generated or input text | Which rule, and that the topic can't be made |
| `TTS_FAILED` | yes | ElevenLabs error after retries | Scenes affected; retry those scenes |
| `TTS_VOICE_UNAVAILABLE` | no | The configured voice was removed | "This voice is no longer available. Pick another." |
| `TTS_QUOTA` | no | ElevenLabs character quota used up (operator problem) | "Narration is unavailable right now." Admin alerted |
| `RENDER_FAILED` | yes | Remotion error in the sandbox | "Export failed. Try again." |
| `RENDER_TIMEOUT` | yes | Render exceeded 15 minutes | Same |
| `STORAGE_FAILED` | yes | R2 upload or copy failed | Same |
| `IG_TOKEN_INVALID` | no | Instagram token revoked or expired | "Reconnect Instagram to post." |
| `IG_MEDIA_REJECTED` | no | Container `ERROR`: Instagram refused the video | Instagram's reason when it gives one |
| `IG_CONTAINER_EXPIRED` | yes | Container wasn't published within 24 hours | "Posting timed out. Try again." |
| `IG_PUBLISH_LIMIT` | yes | Account hit Instagram's 100 posts per 24 hours | When it can post again |
| `IG_UNAVAILABLE` | yes | Instagram 5xx after retries | "Instagram isn't responding. We'll keep the post; try again." |
| `CANCELLED` | no | The user cancelled | Nothing (not shown as an error) |
| `INTERNAL` | yes | A bug | "Something went wrong. Try again." |

## 3. Common objects

These shapes appear in many responses. The API never returns database documents directly: each response type is built by a mapper in `packages/spec/api`, which drops internal fields (`workspaceId`, lease session ids, Inngest ids, R2 keys, encrypted tokens).

```ts
type Id = string;                      // 24 hex chars
type Iso = string;                     // ISO 8601 UTC

type SignedUrl = { url: string; expiresAt: Iso };

type Page<T> = { items: T[]; nextCursor: string | null };
```

### Job

```ts
type Job = {
  id: Id;
  type: 'ideas' | 'script' | 'script_rewrite' | 'storyboard' | 'generate' | 'scene_retry'
      | 'revise_propose' | 'revise_apply' | 'export' | 'caption' | 'publish' | 'account_delete';
  status: 'queued' | 'running' | 'succeeded' | 'partial' | 'failed' | 'cancelled';
  stage: string | null;                // e.g. 'narration'
  progress: number;                    // 0-100, never goes down
  message: string | null;              // "Recording narration (4 of 7 scenes)"
  projectId: Id | null;
  scenes: Array<{ sceneId: string; status: 'pending' | 'running' | 'done' | 'failed' | 'skipped' }> | null;
  result: JobResult | null;
  error: { code: string; message: string; retryable: boolean } | null;
  cancellable: boolean;
  createdAt: Iso;
  startedAt: Iso | null;
  finishedAt: Iso | null;
};

type JobResult =                       // by job type
  | { type: 'ideas'; angleIds: string[] }
  | { type: 'script' | 'script_rewrite' }                    // read the project's script
  | { type: 'storyboard'; draftRev: number }
  | { type: 'generate' | 'scene_retry' | 'revise_apply'; versionNumber: number; failedSceneIds: string[] }
  | { type: 'revise_propose'; messageId: Id }
  | { type: 'export'; exportId: Id }
  | { type: 'caption'; caption: string }
  | { type: 'publish'; postId: Id; permalink: string | null }
  | { type: 'account_delete' };
```

### Project

```ts
type ProjectSummary = {                // library cards
  id: Id;
  title: string;
  videoType: VideoType;                // 'explainer' | 'product_ad' | 'story' | 'travel' | 'quote' | 'music_visual' (D1)
  stage: 'draft' | 'generating' | 'ready' | 'revising' | 'failed';
  wizardStep: 'idea' | 'angles' | 'script' | 'storyboard' | 'video';
  language: 'en' | 'hi';
  lengthSec: 30 | 60 | 90;
  format: VideoFormat;                 // card shape and the library filter
  durationMs: number | null;           // actual length once generated
  thumbnail: SignedUrl | null;
  currentVersion: number | null;
  activeJob: Pick<Job, 'id' | 'type' | 'status' | 'progress'> | null;
  lastExport: { id: Id; status: ExportStatus; readyAt: Iso | null } | null;
  nextPost: { id: Id; status: PostStatus; scheduledFor: Iso | null } | null;
  deletedAt: Iso | null;               // set only in Trash
  createdAt: Iso;
  updatedAt: Iso;
};

type ProjectDetail = ProjectSummary & {  // the editor
  settings: ProjectSettings;
  idea: {
    topic: string;
    videoType: VideoType;
    notes: string | null;
    goal: 'explain' | 'teach' | 'summarise' | 'promote' | null;
    angles: Array<{ id: string; title: string; hook: string; outline: string[] }>;
    selectedAngleId: string | null;
  };
  script: { title: string; hook: string; text: string; wordCount: number; estDurationSec: number;
            source: 'ai' | 'user' | 'ai_edited'; updatedAt: Iso } | null;
  draft: { spec: VideoSpec | null; rev: number; updatedAt: Iso };
  audio: Record<Id, SignedUrl>;        // narration asset id -> URL, for the Player
  stale: { script: boolean; storyboard: boolean };  // an upstream step changed
  lease: { heldByMe: boolean; holderName: string; expiresAt: Iso } | null;
  counters: { revisionsUsed: number; revisionsMax: number; generationsUsed: number; generationsMax: number };
};

type VideoFormat = '9:16' | '16:9' | '1:1';   // from packages/spec

type ProjectSettings = {
  format: VideoFormat;                 // default '9:16'
  language: 'en' | 'hi';
  voiceGender: 'female' | 'male';
  voiceSpeed: number;                  // 0.85-1.15
  tone: 'friendly' | 'professional' | 'energetic' | 'calm';
  audienceLevel: 'kids' | 'beginner' | 'intermediate' | 'expert';
  lengthSec: 30 | 60 | 90;
  palette: 'midnight' | 'paper' | 'ocean' | 'sunset';
  captionStyle: 'highlight' | 'classic' | 'none';
  musicTrackId: string | null;
};
```

`VideoSpec` is exactly the type in Section 6 of the DB Design doc. In API responses its `timing.narrationAssetId` values are keys into `audio`, so the Player can resolve each scene's audio without a second request.

### Usage

```ts
type Usage = {
  period: { key: string; startsAt: Iso; resetsAt: Iso };   // calendar month in IST
  videos: { used: number; reserved: number; max: number };
  exportsToday: { used: number; max: number; resetsAt: Iso };
  concurrentJobs: { active: number; max: number };
  perVideo: { revisionsMax: number; generationsMax: number };
};
```

## 4. Auth and account

### Better Auth routes

Better Auth serves its own routes at `/api/auth/*` from one catch-all route handler. They are not versioned with `/api/v1`, and their shapes are Better Auth's. The web app calls them through the Better Auth client, not by hand. Route names below follow the Better Auth version pinned in `package.json`; check them against its docs when upgrading.

| Method and path | Purpose | Notes |
| --- | --- | --- |
| `POST /api/auth/sign-up/email` | Create an account with email and password | Password 10-128 chars; sends a verification email |
| `POST /api/auth/sign-in/email` | Sign in with email and password | Rate-limited: 5 per minute per IP |
| `POST /api/auth/sign-in/social` | Start Google sign-in (`provider: 'google'`) | Returns the Google URL |
| `GET /api/auth/callback/google` | Google returns here | Creates the user and workspace on first sign-in |
| `POST /api/auth/sign-out` | End this session |  |
| `GET /api/auth/get-session` | Current session and user | Used by the app shell |
| `POST /api/auth/send-verification-email`, `GET /api/auth/verify-email` | Email verification | Link valid 24 hours |
| `POST /api/auth/request-password-reset`, `POST /api/auth/reset-password` | Password reset | Link valid 1 hour; all sessions revoked after a reset |
| `POST /api/auth/change-password` | Change password while signed in | Option to sign out other sessions |
| `GET /api/auth/list-sessions`, `POST /api/auth/revoke-session`, `POST /api/auth/revoke-other-sessions` | Sessions list in Settings |  |

Sign-up hooks create the workspace with default limits in the same request (DB doc Section 4). A user whose `status` is `deleting` cannot sign in.

### Account endpoints

| Method and path | Purpose | Success |
| --- | --- | --- |
| `GET /me` | User, workspace, onboarding state and usage in one call | `200 Me` |
| `PATCH /me` | Change name, time zone or UI language | `200 Me` |
| `PUT /me/onboarding` | Save onboarding answers | `200 Me` |
| `POST /me/onboarding/skip` | "Skip for now": save no answers, stop showing onboarding (sets `user.onboardingSkippedAt`) | `200 Me` |
| `GET /workspace` | Workspace name and defaults | `200 Workspace` |
| `PATCH /workspace` | Change name or defaults for new videos | `200 Workspace` |
| `GET /usage` | Usage against limits | `200 Usage` |
| `GET /voices` | The narrator voices on offer, with preview audio | `200` |
| `GET /music-tracks` | Licensed background tracks (empty until tracks are added) | `200` |
| `POST /me/delete` | Delete the account and all its data | `202 Job` (`account_delete`) |

```ts
type Me = {
  user: { id: Id; name: string; email: string; emailVerified: boolean; image: string | null;
          role: 'user' | 'admin'; timeZone: string; locale: 'en' | 'hi'; createdAt: Iso };
  onboarding: { persona: 'creator' | 'educator' | 'brand' | 'other'; topicArea: string | null;
                language: 'en' | 'hi'; completedAt: Iso | null } | null;   // null = not completed (shown unless skipped)
  workspace: Workspace;
  usage: Usage;
  instagram: { status: 'connected' | 'expiring' | 'revoked'; username: string } | null;
};

// PATCH /me
type UpdateMe = { name?: string; timeZone?: string; locale?: 'en' | 'hi' };   // timeZone must be a valid IANA name

// PUT /me/onboarding
type Onboarding = { persona: 'creator' | 'educator' | 'brand' | 'other'; topicArea?: string;   // topicArea up to 80 chars
                    language: 'en' | 'hi'; voiceGender: 'female' | 'male' };
// also sets workspace.defaults.language and workspace.defaults.voiceGender (the default narrator)

type Workspace = {
  id: Id;
  name: string;
  defaults: ProjectSettings;           // Section 3, minus voiceSpeed which defaults to 1
  blocked: boolean;
};

// PATCH /workspace
type UpdateWorkspace = { name?: string; defaults?: Partial<ProjectSettings> };

// GET /voices
type Voice = { gender: 'female' | 'male'; name: string; languages: Array<'en' | 'hi'>;
               previews: { en: SignedUrl; hi: SignedUrl } };

// GET /music-tracks
type MusicTrack = { id: string; name: string; mood: string; durationMs: number; preview: SignedUrl };

// POST /me/delete
type DeleteAccount = { confirm: 'DELETE'; password?: string };
// Email/password users send their password. Google users must have signed in within the last
// 5 minutes, otherwise 403 REAUTH_REQUIRED and the app sends them through Google sign-in again.
```

Account deletion signs the user out at once; the job finishes in the background and sends a confirmation email (DB doc Section 12).

## 5. Projects, draft and lease

| Method and path | Purpose | Success |
| --- | --- | --- |
| `GET /projects` | Library list, search and filter | `200 Page<ProjectSummary>` |
| `POST /projects` | Start a new video from a topic | `201 ProjectDetail` |
| `GET /projects/{id}` | Everything the editor needs | `200 ProjectDetail` |
| `PATCH /projects/{id}` | Title, settings, idea fields, wizard step | `200 ProjectDetail` |
| `PUT /projects/{id}/draft` | Autosave the whole draft spec | `200 DraftSaved` |
| `POST /projects/{id}/lease` | Take or renew the edit lease | `200 Lease` |
| `POST /projects/{id}/lease/release` | Give up the lease (tab closed) | `204` |
| `POST /projects/{id}/duplicate` | Copy as a new project (idea, script, draft; no history). `Idempotency-Key` required | `201 ProjectDetail` |
| `DELETE /projects/{id}` | Move to Trash | `204` |
| `POST /projects/{id}/restore` | Bring back from Trash | `200 ProjectDetail` |
| `DELETE /projects/{id}/permanent` | Delete from Trash now | `202 Job` |

### List

```http
GET /api/v1/projects?stage=ready&q=photosynthesis&sort=updated&limit=24&cursor=...
GET /api/v1/projects?trash=true
```

| Parameter | Values | Default |
| --- | --- | --- |
| `stage` | `draft`, `generating`, `ready`, `revising`, `failed`; repeatable | all |
| `q` | 2-100 chars, searches title and topic |  |
| `language` | `en`, `hi` | all |
| `format` | `9:16`, `16:9`, `1:1`; repeatable | all |
| `sort` | `updated`, `created` | `updated` |
| `trash` | `true` lists deleted projects only | `false` |
| `limit`, `cursor` | See Section 1 | 24 |

### Create

```ts
// POST /projects   (Idempotency-Key required)
type CreateProject = {
  topic: string;                       // 3-500 chars
  videoType?: VideoType;               // default 'explainer'; the type chips in the prompt box
  notes?: string;                      // up to 5,000 chars
  goal?: 'explain' | 'teach' | 'summarise' | 'promote';
  settings?: Partial<ProjectSettings>; // missing fields come from workspace defaults
};
```

The topic and notes are moderated before the project is created (a fast call to the configured LLM's small model, 5-second timeout). A refusal is `422 CONTENT_BLOCKED` and nothing is saved. If moderation is unavailable, the project is created and the first AI step moderates instead. Creating a project does not use a video from the monthly limit; the first successful generation does.

### Update

```ts
// PATCH /projects/{id}
type UpdateProject = {
  title?: string;                      // 1-100 chars
  wizardStep?: 'idea' | 'angles' | 'script' | 'storyboard' | 'video';
  settings?: Partial<ProjectSettings>;
  idea?: { topic?: string; videoType?: VideoType; notes?: string | null; goal?: string | null; selectedAngleId?: string | null };
  script?: { title?: string; hook?: string; text?: string };   // the user's own edits; source becomes 'user' or 'ai_edited'
};
```

Rules that keep later steps honest:

- `wizardStep` can move back to any earlier step, but forward only to a step whose input exists: `angles` needs angles, `script` a script, `storyboard` a draft spec, `video` a saved version. Otherwise `409 STAGE_INVALID` with `details.needs` (`angles`, `script`, `storyboard` or `version`), and nothing in the request is saved.
- `settings.language` can't change once a script exists (`409 STAGE_INVALID`); the user starts a new project or rewrites the script.
- Changing `palette` or `captionStyle` after generation also updates `draft.spec.theme` (no new audio needed).
- Changing `settings.format` after a storyboard exists also writes `draft.spec.format` (the `setFormat` operation): layouts switch, narration and audio are kept, and it does not count as a revision.
- Changing `voiceGender` or `voiceSpeed` after generation updates the draft's voice and clears every scene's timing; the response lists those scenes in `stale`, and the editor offers "Update narration" (Section 7).
- Editing the script after a storyboard exists sets `stale.storyboard`; nothing is regenerated without the user asking.
- Text fields are moderated like on create.

### Draft autosave

The editor saves the whole spec, debounced to at most one save every 1.5 seconds while the user edits on-screen text, reorders scenes or changes templates by hand.

```ts
// PUT /projects/{id}/draft     headers: X-Editor-Id: <tab id>
type SaveDraft = { baseRev: number; spec: VideoSpec };

type DraftSaved = {
  rev: number;
  updatedAt: Iso;
  staleSceneIds: string[];             // scenes whose narration or voice changed; their timing was cleared
  issues: Array<{ sceneId: string | null; code: 'TRIGGER_NOT_IN_NARRATION' | 'TEXT_TOO_LONG' | 'DURATION_OUT_OF_RANGE'; message: string }>;
};
```

- Shape errors (wrong types, missing fields, more than 10 scenes) are `400 VALIDATION_FAILED` and nothing is saved.
- Semantic problems are saved and returned in `issues`, so the user can keep typing; saving a version or exporting refuses until `issues` is empty.
- The server keeps `timing` from the stored draft for scenes whose `narrationHash` still matches, so a client can't forge timing.
- `409 REV_CONFLICT` and `423 LEASE_HELD` are described in Section 1. On `409`, the editor reloads the project and shows "This video changed in another place".

### Edit lease

Only one editor tab may change a project at a time. Each tab generates an editor id and sends it as `X-Editor-Id`; the lease is held by session id plus editor id.

```ts
// POST /projects/{id}/lease
type TakeLease = { takeover?: boolean };    // true after the user confirms "Edit here instead"
type Lease = { heldByMe: boolean; holderName: string; expiresAt: Iso };
```

The editor calls it on open and every 30 seconds (the lease lasts 60). Without `takeover`, a lease held elsewhere returns `423 LEASE_HELD`, and the editor opens read-only with the Player still working. On tab close the editor calls `POST /projects/{id}/lease/release` with `navigator.sendBeacon`. A beacon can only be a `POST` without custom headers, so the editor id goes in the body (`{ editorId }`). The lease is then freed at once instead of after 60 seconds.

### Delete and restore

`DELETE /projects/{id}` cancels the project's scheduled posts and any running job, then moves it to Trash. The response header `X-Cancelled-Posts` gives the number of posts cancelled; the confirm dialog warns about them beforehand using `nextPost`. Trash keeps it for 30 days. `POST /restore` brings it back but does not reschedule posts.

## 6. Ideation, script and storyboard

The guided flow: topic, then angles, then a script, then a storyboard. Each AI step is a job, uses one of the project's `generationsPerVideo`, and writes its result onto the project. Nothing downstream changes until the user asks for the next step.

| Method and path | Purpose | Success |
| --- | --- | --- |
| `POST /projects/{id}/ideas` | Suggest 3-5 angles for the topic | `202 Job` (`ideas`) |
| `POST /projects/{id}/script` | Write the script from the chosen angle | `202 Job` (`script`) |
| `POST /projects/{id}/script/rewrite` | Shorter, longer, simpler, or a custom rewrite of all or part of the script | `202 Job` (`script_rewrite`) |
| `POST /projects/{id}/storyboard` | Split the script into scenes and pick templates and visuals | `202 Job` (`storyboard`) |

All four require the edit lease and an `Idempotency-Key`, refuse with `409 JOB_IN_PROGRESS` if the project has a running job, and with `403 LIMIT_REACHED` when `generationsUsed` is at the limit. A job that fails gives the generation back.

### Ideas

```ts
// POST /projects/{id}/ideas
type RequestIdeas = {
  count?: 3 | 4 | 5;                   // default 4
  steer?: string;                      // up to 200 chars, e.g. "focus on exam questions"
};
// Job result: { type: 'ideas', angleIds }. The angles replace project.idea.angles;
// the previous selection is cleared. Re-running gives fresh angles.
```

The user picks one with `PATCH /projects/{id}` (`idea.selectedAngleId`). Skipping angles is allowed: the script step then writes from the topic alone.

### Script

```ts
// POST /projects/{id}/script
type RequestScript = {
  angleId?: string;                    // default: idea.selectedAngleId
  instructions?: string;               // up to 500 chars
  overwrite?: boolean;                 // required if a script exists that the user edited
};
```

The script is written for `settings.lengthSec` at the language's speaking rate (English 2.5, Hindi 2.2 words per second), in the project's tone and audience level. If a script the user edited exists and `overwrite` is not `true`, the API returns `409 STAGE_INVALID` with `needs: 'overwrite'`, so the user is asked first.

```ts
// POST /projects/{id}/script/rewrite
type RewriteScript = {
  instruction: 'shorter' | 'longer' | 'simpler' | 'more_engaging' | 'more_formal' | 'custom';
  custom?: string;                     // required for 'custom', up to 500 chars
  selection?: { start: number; end: number };   // character offsets; rewrites only that part
};
```

Both jobs moderate the output and save it to `project.script` with `source: 'ai'`, or `'ai_edited'` when the user had edited it before. The previous script is kept in the job's `input` snapshot for 180 days, so "Undo rewrite" can restore it with a `PATCH`.

### Storyboard

```ts
// POST /projects/{id}/storyboard
type RequestStoryboard = { overwrite?: boolean };   // required if a draft spec exists
// Job result: { type: 'storyboard', draftRev }.
```

The job writes `draft.spec`: 2-10 scenes, each with a template, its content, its narration (the script split word for word) and a trigger for every visual element, but no `timing` yet. It runs the validation and retry loop from the prototype (schema, then script coverage and triggers, up to 3 attempts). The project moves to `wizardStep: 'storyboard'`.

The user edits the storyboard with `PUT /projects/{id}/draft`: change a scene's template or text, reorder, add or remove scenes. AI help on a single scene goes through chat (Section 9).

## 7. Generation and narration

| Method and path | Purpose | Success |
| --- | --- | --- |
| `POST /projects/{id}/generate` | Record narration for every scene, time the visuals to it, and save version 1 (or the next version) | `202 Job` (`generate`) |
| `POST /projects/{id}/narration` | Record narration again for some scenes: after text or voice edits, or to retry failed scenes | `202 Job` (`scene_retry`) |
| `GET /projects/{id}/audio` | Fresh playback URLs for narration assets | `200 Record<Id, SignedUrl>` |

### Generate

```ts
// POST /projects/{id}/generate      (Idempotency-Key required)
type Generate = { baseRev: number };
// Job result: { type: 'generate', versionNumber, failedSceneIds }
```

Before the job is created, the API checks, in this order: the lease, `rev`, that `draft.spec` exists and has no `issues` (`409 STAGE_INVALID` with `needs: 'storyboard'` or `'fix_issues'`), no running job, concurrent jobs, and the monthly video limit. If the project hasn't counted yet, one video is reserved (DB doc Section 4).

The job's stages, as shown in `stage` and `message`:

| Stage | What happens | Progress |
| --- | --- | --- |
| `narration` | Each scene's narration is recorded, 4 at a time. Scenes whose audio is in the cache are `skipped` and cost nothing | 5-80 |
| `timing` | Word timestamps are matched to each element's trigger; scene lengths are set | 80-90 |
| `save` | A new version is saved, the draft updated, a thumbnail rendered from the title scene | 90-100 |

Outcomes:

- **`succeeded`**: every scene has narration. The project becomes `ready`; the editor reloads and the Player plays the new version.
- **`partial`**: some scenes failed after 3 attempts each. The version is saved anyway; failed scenes have no `timing` and play silently for their estimated length with a "Narration missing" badge. `failedSceneIds` lists them, and "Retry these scenes" calls `POST /narration`. A partial generation still counts as a video, because the user has one.
- **`failed`**: nothing usable (for example, every scene failed or the provider is down). The reservation is released; the project goes back to `draft` (first generation) or stays `ready` on its previous version.

There is no draft render and no preview endpoint. The editor plays `draft.spec` in the Remotion Player with the `audio` URLs from `GET /projects/{id}`, so preview is instant and free.

### Narration for some scenes

```ts
// POST /projects/{id}/narration     (Idempotency-Key required)
type UpdateNarration = {
  baseRev: number;
  sceneIds?: string[];                 // default: every scene without valid timing
};
// Job result: { type: 'scene_retry', versionNumber, failedSceneIds }
```

Used after the user edits a scene's narration or changes the voice (`staleSceneIds` from autosave), and for retrying failed scenes. Only the listed scenes are recorded; the others keep their audio. Re-recording because the user changed something uses one revision (`revisionsPerVideo`); retrying scenes that failed does not.

### Audio URLs

```http
GET /api/v1/projects/{id}/audio?ids=6730a1...,6730a2...
```

Returns fresh 15-minute URLs for up to 20 narration assets used by the project's draft or versions. The Player calls it when a URL is about to expire, so a long editing session keeps playing.

## 8. Versions

| Method and path | Purpose | Success |
| --- | --- | --- |
| `GET /projects/{id}/versions` | Version history, newest first | `200 Page<VersionSummary>` |
| `GET /projects/{id}/versions/{number}` | One version's full spec, to preview it | `200 VersionDetail` |
| `POST /projects/{id}/versions` | Save the current draft as a version by hand | `201 VersionSummary` |
| `POST /projects/{id}/versions/{number}/restore` | Make an old version current | `201 VersionSummary` |

```ts
type VersionSummary = {
  number: number;
  reason: 'generate' | 'apply' | 'manual' | 'restore';
  summary: string;                     // "Shorter intro; scene 3 now a timeline"
  restoredFrom: number | null;
  durationMs: number;
  sceneCount: number;
  isCurrent: boolean;
  hasExport: boolean;                  // an active export exists for its specHash
  createdBy: { id: Id; name: string };
  createdAt: Iso;
};

type VersionDetail = VersionSummary & {
  spec: VideoSpec;
  audio: Record<Id, SignedUrl>;
};

// POST /projects/{id}/versions
type SaveVersion = { baseRev: number; summary?: string };   // up to 200 chars; default "Manual edits"

// POST /projects/{id}/versions/{number}/restore
type RestoreVersion = { baseRev: number };
```

The history lists summaries only; the full spec is fetched when the user opens a version to preview it in the Player. A manual save needs every scene to have valid timing and no `issues` (`409 STAGE_INVALID` with `needs: 'narration'` or `'fix_issues'`).

Restoring never deletes anything: it copies the old spec into a new version, makes it current, and replaces the draft. It needs no new audio, because assets used by any kept version are kept. Only the latest 50 versions are kept; older ones are not listed.

## 9. Chat revisions

The user asks for a change in plain words, for the whole video or one scene. The assistant answers with a proposal: what it will change, which scenes, whether new narration is needed, and the new length. Nothing changes until the user applies it.

| Method and path | Purpose | Success |
| --- | --- | --- |
| `GET /projects/{id}/chat` | Conversation, newest first | `200 Page<ChatMessage>` |
| `POST /projects/{id}/chat` | Send a request; the assistant prepares a proposal | `202 { message: ChatMessage; job: Job }` (`revise_propose`) |
| `POST /projects/{id}/chat/{messageId}/apply` | Apply a proposal | `202 Job` (`revise_apply`) |
| `POST /projects/{id}/chat/{messageId}/dismiss` | Dismiss a proposal | `200 ChatMessage` |

### Send a request

```ts
// POST /projects/{id}/chat      (Idempotency-Key required)
type SendChat = {
  content: string;                     // 1-2,000 chars
  scope: { kind: 'video' } | { kind: 'scene'; sceneId: string };
  baseRev: number;                     // the draft the user is looking at
};
```

The user's message is saved and returned at once, so it appears in the chat immediately. The `revise_propose` job then moderates it, sends the current spec plus the request to the LLM, validates the operations it returns against the spec, and saves the assistant's reply. `result.messageId` is that reply. Proposing uses one of the project's generations; applying uses one revision.

The reply's `kind` says what happened:

| `kind` | Meaning | The UI shows |
| --- | --- | --- |
| `proposal` | A change is ready to apply | Summary, affected scenes highlighted, "Apply" and "Dismiss" |
| `clarify` | The request was ambiguous | The assistant's question; the user answers in a new message |
| `unsupported` | Not possible in V1 (e.g. "use my own photo", "make it 3 minutes") | Why, and what it can do instead |
| `message` | An answer with no change (e.g. "what font is this?") | The text |
| `error` | The job failed | The error and "Try again" |

```ts
type ChatMessage = {
  id: Id;
  role: 'user' | 'assistant';
  content: string;
  scope: { kind: 'video' } | { kind: 'scene'; sceneId: string };
  kind: 'message' | 'proposal' | 'clarify' | 'unsupported' | 'error';
  proposal: {
    summary: string;
    operations: RevisionOperation[];   // DB doc Section 5
    affectedSceneIds: string[];
    regeneratesVoice: boolean;
    estDurationSec: number;
    warnings: string[];
    baseRev: number;
  } | null;
  status: 'proposed' | 'applied' | 'dismissed' | 'stale' | 'failed' | null;
  appliedVersion: number | null;
  createdAt: Iso;
};
```

Showing `operations` lets the editor preview a proposal before applying it: the client applies them to a copy of the draft with the same function the server uses (`applyOperations` in `packages/spec`) and plays it in the Player, with the changed scenes' new narration shown as text.

### Apply

```ts
// POST /projects/{id}/chat/{messageId}/apply     (Idempotency-Key required)
type ApplyProposal = { baseRev: number };
// Job result: { type: 'revise_apply', versionNumber, failedSceneIds }
```

The job applies the operations to the current draft, records narration only for scenes whose `narrationHash` changed, re-times those scenes, and saves a version with the proposal's summary. A proposal that changes only visuals or the theme finishes in about a second.

If the draft moved on since the proposal (`draft.rev` differs from `proposal.baseRev`), the server re-checks each operation (DB doc Section 5). If they still apply cleanly, they go ahead; if not, the API returns `409 PROPOSAL_STALE` with the conflicting scenes, and the message becomes `stale`. A proposal can be applied once (`409 PROPOSAL_CLOSED` after that).

## 10. Exports and downloads

An export renders a saved version to MP4 on Vercel Sandbox, uploads it to R2, and keeps it for 30 days. Exporting the same spec at the same resolution again returns the existing export instead of rendering twice.

| Method and path | Purpose | Success |
| --- | --- | --- |
| `POST /projects/{id}/exports` | Export a version | `202 ExportStarted`, or `200 ExportStarted` when an identical export is already ready |
| `GET /projects/{id}/exports` | Exports of a project, newest first | `200 Page<Export>` |
| `GET /exports/{id}` | One export, with its cover image | `200 Export` |
| `GET /exports/{id}/download?file=mp4` | Download a file (`mp4`, `mp3`, `srt`, `cover`) | `302` to a presigned URL |
| `POST /exports/{id}/caption` | Write an Instagram caption for it | `202 Job` (`caption`) |
| `DELETE /exports/{id}` | Delete the files now | `204` |

### Start an export

```ts
// POST /projects/{id}/exports      (Idempotency-Key required)
type StartExport = {
  versionNumber?: number;              // default: the current version
  resolution?: '1080p' | '720p';       // default 1080p: short side 1080 px in the spec's format
                                       // (9:16 1080 x 1920, 16:9 1920 x 1080, 1:1 1080 x 1080), 30 fps, H.264, AAC
  include?: { mp3?: boolean; srt?: boolean };   // extra files; default both true
};

type ExportStarted = { export: Export; job: Job | null };   // job is null on a cache hit that is ready
```

Checks: the version exists and every scene has timing (`409 STAGE_INVALID` with `needs: 'narration'` for a partial version), the daily export limit (a cache hit doesn't count), and concurrent jobs. An export doesn't need the edit lease, so a read-only tab can export.

Exports are always of a saved version, never of the unsaved draft. If the draft has changes since the current version, the editor asks "Save as a new version and export?" and calls `POST /versions` first.

The `export` job's stages: `render` (sandbox start, then frames; `progress` follows Remotion's progress) and `upload` (MP4, MP3, captions and cover to R2). A 60-second video takes about 2-3 minutes.

```ts
type Export = {
  id: Id;
  projectId: Id;
  versionNumber: number;
  format: VideoFormat;                 // from the version's spec
  resolution: '1080p' | '720p';
  width: number;                       // pixels, e.g. 1920 for 16:9 at 1080p
  height: number;
  status: 'queued' | 'rendering' | 'uploading' | 'ready' | 'failed' | 'expired';
  durationMs: number;
  files: { mp4: { bytes: number } | null; mp3: { bytes: number } | null; srt: boolean };
  cover: SignedUrl | null;
  captionDraft: string | null;
  usedByPosts: number;                 // scheduled or published posts using it
  error: { code: string; message: string; retryable: boolean } | null;
  readyAt: Iso | null;
  expiresAt: Iso | null;
  createdAt: Iso;
};
```

### Download

`GET /exports/{id}/download?file=mp4` answers with `302 Found` to a 15-minute R2 URL that sets `Content-Disposition: attachment; filename="<title>.mp4"`. The redirect means the browser downloads straight from R2. Not ready is `409 EXPORT_NOT_READY`; expired is `410 EXPORT_EXPIRED`, and the editor offers to export again.

### Caption

```ts
// POST /exports/{id}/caption
type WriteCaption = {
  style?: 'informative' | 'casual' | 'question_hook';   // default informative
  hashtags?: number;                   // 0-30, default 8
  language?: 'en' | 'hi';              // default: the video's language
};
// Job result: { type: 'caption', caption }. Also saved as export.captionDraft.
```

The caption is written from the script, kept under Instagram's 2,200 characters and 30 hashtags, and moderated. It uses one of the project's generations.

### Delete

`DELETE /exports/{id}` deletes the files at once. It is refused with `409 NOT_CANCELLABLE` while a scheduled post uses the export; cancel the post first.

## 11. Jobs

| Method and path | Purpose | Success |
| --- | --- | --- |
| `GET /jobs/{id}` | Current state of a job | `200 Job` (`304` if unchanged) |
| `GET /jobs/{id}/events` | Live updates as Server-Sent Events | `200 text/event-stream` |
| `GET /jobs` | Recent and running jobs (activity panel) | `200 Page<Job>` |
| `POST /jobs/{id}/cancel` | Ask a job to stop | `202 Job` |
| `POST /jobs/{id}/retry` | Run a failed job again with the same input | `202 Job` (a new job) |

### Polling

```http
GET /api/v1/jobs/6730b2...
If-None-Match: "j-6730b2-41"
```

The `ETag` changes whenever the job document does. The editor polls every 2 seconds while the job is on screen, every 10 seconds when the tab is in the background, and stops when the job finishes.

### Live updates

```http
GET /api/v1/jobs/6730b2.../events
Accept: text/event-stream
```

```text
event: job
id: 41
data: {"id":"6730b2...","status":"running","stage":"narration","progress":42,"message":"Recording narration (3 of 7 scenes)", ...}

: keep-alive

event: job
id: 47
data: {"id":"6730b2...","status":"succeeded","progress":100,"result":{"type":"generate","versionNumber":1,"failedSceneIds":[]}, ...}

event: end
data: {}
```

Each `job` event carries the whole `Job`. The server reads the job once a second and sends it when it changes, sends a keep-alive comment every 15 seconds, and closes the stream when the job finishes or after 5 minutes (the function's time limit). The browser's `EventSource` reconnects on its own with `Last-Event-ID`; if streaming fails twice, the client switches to polling.

### List

```http
GET /api/v1/jobs?active=true
GET /api/v1/jobs?projectId=6730a1...&limit=10
```

`active=true` returns queued and running jobs of the workspace; the app shell uses it to show a "2 jobs running" indicator and to resume progress after a page reload.

### Cancel

`POST /jobs/{id}/cancel` records the request and sends `job/cancel.requested` to Inngest, which stops the run at the next step boundary. The response is the job with `cancellable: false` and its status unchanged; the status becomes `cancelled` once the run has stopped (usually within a few seconds). Cancelling releases any reserved video, and narration already recorded stays in the cache, so trying again later is cheaper.

Not cancellable (`409 NOT_CANCELLABLE`): finished jobs, `publish` jobs once the post is `uploading`, and `account_delete`.

### Retry

`POST /jobs/{id}/retry` works on `failed` and `partial` jobs whose error is retryable. It creates a new job with the same input against the project's current state, so the same checks as the original endpoint apply (lease, limits, `rev`). For a partial generation, prefer `POST /projects/{id}/narration`, which retries only the failed scenes.

## 12. Instagram connection and posts

Publishing uses Instagram API with Instagram Login: the user signs in to their Instagram professional (Business or Creator) account and grants `instagram_business_basic` and `instagram_business_content_publish`. No Facebook Page is needed. Until Meta grants Advanced Access after App Review, only accounts added as testers of the Meta app can connect.

| Method and path | Purpose | Success |
| --- | --- | --- |
| `GET /integrations/instagram` | The connected account, if any | `200 InstagramAccount or null` |
| `POST /integrations/instagram/connect` | Get the Instagram authorise URL | `200 { authorizeUrl }` |
| `GET /integrations/instagram/callback` | Instagram redirects the browser here | `302` back to the app |
| `DELETE /integrations/instagram` | Disconnect | `204` |
| `GET /posts` | Posts, for the calendar and lists | `200 Page<Post>` |
| `POST /posts` | Post now or schedule | `201 { post: Post; job: Job or null }` |
| `GET /posts/{id}` | One post | `200 Post` |
| `PATCH /posts/{id}` | Edit caption, cover or time | `200 Post` |
| `POST /posts/{id}/cancel` | Cancel a scheduled post | `200 Post` |
| `POST /posts/{id}/publish-now` | Post a scheduled, missed or failed post now | `202 Job` (`publish`) |

### Connect

```ts
// POST /integrations/instagram/connect
type Connect = { returnTo?: string };  // app path; default '/settings/integrations'
// -> { authorizeUrl: 'https://www.instagram.com/oauth/authorize?client_id=...&redirect_uri=...
//      &response_type=code&scope=instagram_business_basic,instagram_business_content_publish&state=...' }
```

The server stores a hash of a random `state` (10 minutes, one use) and returns the URL; the browser goes there. `409 ACCOUNT_ALREADY_CONNECTED` if the workspace has one; disconnect first.

### Callback

`GET /api/v1/integrations/instagram/callback?code=...&state=...` is a browser redirect. The session cookie comes with it (`SameSite=Lax` allows top-level navigations). The server:

1. Consumes the `state` (missing, used or expired: error `state_invalid`).
2. Strips the `#_` Instagram appends to `code`, and exchanges it: `POST https://api.instagram.com/oauth/access_token` gives a short-lived token and the user id.
3. Exchanges that for a long-lived token (about 60 days): `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token`.
4. Reads the profile (`/me?fields=user_id,username,account_type,profile_picture_url`) and checks both permissions were granted.
5. Encrypts the token and saves the `social_accounts` row.
6. Redirects to `returnTo?instagram=connected`, or `returnTo?instagram=error&reason=...` with `denied`, `state_invalid`, `missing_permissions`, `not_professional`, `already_connected` or `failed`.

The callback never returns JSON and never shows Instagram's raw error to the user; details go to the logs.

```ts
type InstagramAccount = {
  id: Id;
  username: string;
  accountType: 'BUSINESS' | 'MEDIA_CREATOR';
  profilePictureUrl: string | null;
  status: 'connected' | 'expiring' | 'revoked';
  tokenExpiresAt: Iso;
  publishQuota: { used: number; max: 100; checkedAt: Iso } | null;   // last 24 hours
  connectedAt: Iso;
};
```

`DELETE /integrations/instagram` deletes the token and marks the account disconnected. Scheduled posts become `needs_reconnect`; the response header `X-Affected-Posts` gives how many, and the confirm dialog warns first.

### Create a post

```ts
// POST /posts      (Idempotency-Key required)
type CreatePost = {
  exportId: Id;
  caption: string;                     // up to 2,200 chars and 30 hashtags
  coverAtMs?: number;                  // frame for the cover; default the export's cover
  shareToFeed?: boolean;               // also show in the profile grid; default true
  scheduledFor: Iso | null;            // null = post now
};
```

Checks, in order: Instagram is connected (`409 INSTAGRAM_NOT_CONNECTED` if not, or if `revoked`); the export is `ready` (`409 EXPORT_NOT_READY`); the caption passes moderation (`422 CONTENT_BLOCKED`); for a scheduled post, the time is at least 10 minutes and at most 75 days ahead (`422 SCHEDULE_INVALID`). The export's expiry is pushed to at least 7 days after the scheduled time.

- **Post now:** the `publish` job starts at once; `job` is returned.
- **Schedule:** the post is saved as `scheduled` and an Inngest run sleeps until the time; `job` is `null`. The reconciliation cron (every 15 minutes) starts any scheduled post whose time has passed without a run, so a lost sleep never loses a post.

The `publish` job's stages follow Instagram's flow: `ig_container` (create a Reels container with the export's presigned URL, `media_type=REELS`, caption, `cover_url`, `share_to_feed`), `ig_processing` (poll the container's `status_code` every 15 seconds until `FINISHED`, up to 10 minutes), then `ig_publish` (`media_publish`, then read the permalink). Before creating the container it checks `content_publishing_limit`; at the limit the post fails with `IG_PUBLISH_LIMIT` and when it can try again.

Exports of any format can be posted. Instagram accepts Reels from 0.01:1 to 10:1 but recommends 9:16, so 16:9 and 1:1 Reels show with blank space; the Export screen reads `export.format` and warns before a non-9:16 post is scheduled.

```ts
type Post = {
  id: Id;
  projectId: Id;
  projectTitle: string;
  exportId: Id;
  account: { username: string };
  caption: string;
  cover: SignedUrl | null;
  shareToFeed: boolean;
  scheduledFor: Iso | null;
  status: 'scheduled' | 'uploading' | 'processing' | 'published' | 'failed'
        | 'missed' | 'needs_reconnect' | 'cancelled';
  permalink: string | null;
  error: { code: string; message: string; retryable: boolean } | null;
  jobId: Id | null;                    // the latest publish job
  publishedAt: Iso | null;
  createdAt: Iso;
  updatedAt: Iso;
};
```

### List, edit and cancel

```http
GET /api/v1/posts?from=2026-11-01T00:00:00Z&to=2026-12-01T00:00:00Z     (calendar month)
GET /api/v1/posts?status=failed&status=missed
GET /api/v1/posts?projectId=6730a1...
```

`PATCH /posts/{id}` takes `caption`, `coverAtMs`, `shareToFeed` and `scheduledFor`, and works while the post is `scheduled`, `missed`, `failed` or `needs_reconnect`; changing the time reschedules the run. `POST /cancel` works while `scheduled` or `needs_reconnect`; once `uploading` it is `409 NOT_CANCELLABLE`, because Instagram may already be publishing it.

## 13. Notifications

| Method and path | Purpose | Success |
| --- | --- | --- |
| `GET /notifications` | Bell list, newest first | `200 Page<Notification>` |
| `GET /notifications/unread-count` | Badge number | `200 { count }` |
| `POST /notifications/read` | Mark some or all as read | `204` |
| `GET /me/notification-preferences` | Which events also send email | `200 NotificationPrefs` |
| `PUT /me/notification-preferences` | Change them | `200 NotificationPrefs` |

```ts
type Notification = {
  id: Id;
  type: 'video_ready' | 'generation_failed' | 'export_ready' | 'export_failed'
      | 'post_published' | 'post_failed' | 'post_missed' | 'account_expiring'
      | 'account_revoked' | 'limit_near' | 'limit_reached';
  title: string;
  body: string;
  link: string;                        // app path to open
  readAt: Iso | null;
  createdAt: Iso;
};

// POST /notifications/read
type MarkRead = { ids: Id[] } | { all: true };

type NotificationPrefs = {
  email: {
    videoReady: boolean;               // generation and export finished; sent only if no editor tab was open; default true
    posts: boolean;                    // published, failed, missed; default true
    account: boolean;                  // Instagram expiring or revoked, limits; default true
  };
};
```

`GET /notifications?unread=true` lists unread ones only. The app shell polls `unread-count` every 60 seconds and when the tab regains focus. Security emails (verification, password reset, account deletion) are always sent and have no setting.

## 14. Admin

Admin routes live under `/api/v1/admin` and need `user.role = 'admin'` (`403 FORBIDDEN` otherwise) and a sign-in within the last 12 hours. Every write takes a `reason` (1-500 characters) and adds an `admin_audit` row with the before and after values. Admin responses may include internal fields (job stages, provider error text, costs) that user routes never return.

| Method and path | Purpose |
| --- | --- |
| `GET /admin/overview` | Users, active users (7 days), videos this month, jobs running and failed (24 hours), cost this month by provider, provider error rates |
| `GET /admin/users?q=` | Find users by email or name |
| `GET /admin/workspaces/{id}` | Workspace, usage, limits, flags, recent projects and jobs, moderation events |
| `PATCH /admin/workspaces/{id}/limits` | Change a workspace's limits |
| `POST /admin/workspaces/{id}/block`, `/unblock` | Block or unblock AI work and posting |
| `POST /admin/workspaces/{id}/clear-review` | Clear a moderation review flag |
| `GET /admin/jobs?status=&type=&since=` | Jobs across workspaces, with full error detail and a link to the Inngest run |
| `POST /admin/jobs/{id}/retry`, `/cancel` | Retry or cancel any job |
| `GET /admin/posts?status=` | Posts across workspaces, e.g. all `failed` today |
| `GET /admin/moderation?decision=` | Moderation decisions, newest first |
| `GET /admin/usage?from=&to=&groupBy=` | Cost by `provider`, `operation`, `day` or `workspace`, from `usage_events` |
| `POST /admin/users/{id}/delete` | Delete an account (abuse, or a request by email) |
| `GET /admin/audit?targetId=&actorId=` | The audit log |

```ts
// PATCH /admin/workspaces/{id}/limits
type UpdateLimits = {
  limits: Partial<{ videosPerMonth: number; revisionsPerVideo: number; generationsPerVideo: number;
                    exportsPerDay: number; concurrentJobs: number }>;   // each 0-10,000
  reason: string;
};

// GET /admin/usage?from=2026-11-01&to=2026-12-01&groupBy=provider
type UsageReport = {
  from: Iso; to: Iso;
  rows: Array<{ key: string; calls: number; cachedCalls: number; costMicroUsd: number;
                inputTokens: number; outputTokens: number; characters: number; sandboxSeconds: number }>;
  totalMicroUsd: number;
  priceVersions: string[];
};
```

The admin console is a separate area of the same Next.js app (`/admin`), so it uses the same session and API conventions.

## 15. Internal endpoints and events

These routes are not called by the web app. None uses the session cookie; each has its own proof of the caller.

| Route | Caller | Proof |
| --- | --- | --- |
| `GET, POST, PUT /api/inngest` | Inngest (function discovery and step calls) | Request signature with `INNGEST_SIGNING_KEY`, checked by the Inngest SDK |
| `POST /api/v1/integrations/instagram/deauthorize` | Meta, when a user removes the app from Instagram | `signed_request` HMAC-SHA256 with the app secret |
| `POST /api/v1/integrations/instagram/data-deletion` | Meta, when a user asks for their data to be deleted | Same; returns `{ url, confirmation_code }` as Meta requires |
| `GET /api/v1/integrations/instagram/data-deletion/{code}` | The user, following Meta's link | Public; shows the deletion status only |
| `POST /api/webhooks/resend` | Resend (bounces, complaints) | Svix signature with `RESEND_WEBHOOK_SECRET` |
| `GET /api/health` | Uptime monitor | Public; returns `{ status, version, checks: { mongo } }`, no data |

Deauthorize marks the matching `social_accounts` row revoked and its posts `needs_reconnect`. Data deletion deletes the row, the token and the user's Instagram post records' Instagram ids. Resend bounces turn email notifications off for that user, so we stop mailing a dead address.

### Inngest events

The API sends one event per job. Event ids are derived from the job id, so Inngest drops a duplicate send.

```ts
type JobEvent = {
  name: `job/${JobType}.requested`;    // e.g. 'job/generate.requested'
  id: `${JobType}:${jobId}`;           // Inngest dedupes on this
  data: { jobId: Id; workspaceId: Id; projectId: Id | null; userId: Id; requestId: string };
};

type OtherEvents =
  | { name: 'job/cancel.requested'; data: { jobId: Id } }
  | { name: 'post/scheduled'; data: { postId: Id; scheduledFor: Iso } }
  | { name: 'post/rescheduled'; data: { postId: Id; scheduledFor: Iso } }   // cancels the old sleep
  | { name: 'post/cancelled'; data: { postId: Id } };
```

The event carries ids only. Each function reads the job's `input` from MongoDB, so a payload can't go stale and no content passes through Inngest.

### Functions

| Function | Trigger | Concurrency | Retries | Stops on |
| --- | --- | --- | --- | --- |
| `ideas`, `script`, `script-rewrite`, `storyboard`, `caption`, `revise-propose` | `job/*.requested` | 2 per workspace; 10 across all (LLM rate limits) | 3 per step | `job/cancel.requested` with the same `jobId` |
| `generate`, `scene-retry`, `revise-apply` | `job/*.requested` | 1 per project, 2 per workspace | 3 per step, per scene | same |
| `export` | `job/export.requested` | 1 per workspace; 4 across all (sandbox cost) | 2 | same |
| `publish` | `job/publish.requested`, `post/scheduled` | 1 per Instagram account | 4, with backoff | `post/cancelled`, `post/rescheduled` |
| `account-delete` | `job/account_delete.requested` | 1 per workspace | 10 | nothing |

### Scheduled functions

Run as Inngest cron functions, so they get the same retries, logs and alerting as everything else. Times are IST.

| Function | Schedule | Does |
| --- | --- | --- |
| `posts-reconcile` | Every 15 minutes | Starts scheduled posts whose time passed without a run; marks posts over 6 hours late `missed` |
| `jobs-sweep` | Every 5 minutes | Fails jobs with no heartbeat for 10 minutes, releases their reservations and project claims |
| `tokens-refresh` | Daily 03:10 | Refreshes Instagram tokens expiring within 10 days |
| `exports-expire` | Daily 03:40 | Deletes expired export files |
| `projects-purge` | Daily 04:10 | Purges projects 30 days in Trash |
| `assets-sweep` | Sundays 04:40 | Deletes unused narration audio |
| `usage-check` | Hourly | Sends `limit_near` at 80% of the monthly video limit, and alerts the admin when daily cost or provider errors pass a threshold |

## 16. Rate limits and quotas

Two different things protect the service. **Rate limits** stop bursts (a stuck loop, a script, abuse) and reset within a minute or an hour. **Quotas** are the usage limits from the PRD and reset monthly or daily.

### Rate limits

Fixed windows per user (per IP for unauthenticated routes), counted in the `rateLimit` collection (DB doc Section 3).

| Group | Endpoints | Limit |
| --- | --- | --- |
| Sign-in | `POST /api/auth/sign-in/*` | 5 per minute per IP |
| Sign-up | `POST /api/auth/sign-up/email` | 3 per minute per IP |
| Password reset | `POST /api/auth/request-password-reset` | 3 per hour per email |
| Reads | `GET /api/v1/*` | 300 per minute |
| Job status | `GET /jobs/{id}` | 120 per minute |
| Live streams | `GET /jobs/{id}/events` | 5 open at once |
| Edits | `PATCH`, `PUT`, `DELETE` | 120 per minute (autosave uses up to 40) |
| Lease | `POST /projects/{id}/lease` | 10 per minute per tab |
| AI requests | ideas, script, rewrite, storyboard, chat, caption | 10 per minute, 60 per hour |
| Narration | generate, narration, apply | 6 per minute |
| Exports | `POST /projects/{id}/exports` | 6 per minute |
| Posts | `POST /posts`, `publish-now` | 10 per minute |
| Instagram connect | `POST /integrations/instagram/connect` | 5 per hour |
| Admin | `/admin/*` | 120 per minute |

Every `/api/v1` response carries the current window:

```http
RateLimit-Limit: 10
RateLimit-Remaining: 7
RateLimit-Reset: 42
```

Over the limit, the response is `429 RATE_LIMITED` with `Retry-After` in seconds. The web app spaces its own requests (debounced autosave, polling intervals) so a normal user never sees one.

### Quotas

Workspace limits (DB doc Section 4). An endpoint that would go over one returns `403 LIMIT_REACHED` with which limit, how much is used, and when it resets.

| Quota | Default | Used by | Given back when |
| --- | --- | --- | --- |
| `videosPerMonth` | 20 | The first successful (or partial) generation of a project | The generation fails or is cancelled |
| `revisionsPerVideo` | 30 | Applying a proposal; re-recording narration after edits | The job fails |
| `generationsPerVideo` | 50 | Ideas, script, rewrite, storyboard, chat proposal, caption | The job fails |
| `exportsPerDay` | 20 | Each export that renders (not cache hits) | The render fails |
| `concurrentJobs` | 2 | Any queued or running job | The job finishes |

`GET /usage` returns all of them. The editor shows the per-video counters from `ProjectDetail.counters`, and warns at 80%.

### Provider limits

The Gemini free tier has low per-minute and per-day limits. Inngest's concurrency (10 LLM calls at a time across all users) and the client's retry with backoff (5, 15, 30, 60 seconds) absorb short bursts. When retries run out the job fails with `LLM_RATE_LIMITED`, which is retryable and shown as "busy, try again in a minute". The same pattern applies to ElevenLabs and Instagram.

## 17. Versioning, OpenAPI and testing

### Versioning

- The version is in the path: `/api/v1`. Within v1, changes are additive only: new endpoints, new optional request fields, new response fields.
- Clients must ignore response fields they don't know, and treat an enum value they don't know as a safe default (for example, show an unknown job `stage` as "Working").
- A breaking change ships as `/api/v2` next to v1; v1 stays until no client uses it.
- The web app is the only client, but an open tab can run old code for hours. Each request sends `X-App-Version`. If it is older than the minimum the server supports, the API returns `426 UPGRADE_REQUIRED` and the app reloads itself after saving the draft.

### Schemas and OpenAPI

Every route is declared once in a registry in `packages/spec/api`: method, path, request schema (params, query, body), response schemas per status, auth, rate-limit group and idempotency. From that one declaration:

- The route handler gets parsed, typed input, and its output is checked against the response schema in development and tests.
- A typed client for the web app (`api.projects.get(id)`) is generated, so the front end can't call an endpoint with the wrong shape.
- An OpenAPI 3.1 document is generated at build time and served at `/api/v1/openapi.json` (admins only in production), with a rendered reference in development.

### Testing the contract

| Test | What it checks |
| --- | --- |
| Schema tests | Every example in this doc parses with its zod schema |
| Route tests | Each handler, against an in-memory MongoDB, for success, every listed error code, and another workspace's ids (`404`) |
| Concurrency tests | Two parallel autosaves (one `409`), two parallel generates (one `409 JOB_IN_PROGRESS`), month rollover during a reservation |
| Idempotency tests | Same key twice returns the same job; same key, different body returns `422` |
| Job tests | Inngest functions run with the Inngest test engine against mocked Gemini, Claude, ElevenLabs, Vercel Sandbox and Instagram (the prototype's `check:llm` is the pattern) |
| End-to-end | Playwright: sign up, create, generate with mocked providers, revise, export, schedule, cancel |
| Breaking-change check | CI compares the generated OpenAPI with the last release and fails on a removed field, a new required field, or a changed type |

### Endpoint index

All paths are under `/api/v1` unless they start with `/api/`.

| Area | Method and path | Returns |
| --- | --- | --- |
| Account | `GET /me`, `PATCH /me` | `Me` |
| Account | `PUT /me/onboarding` | `Me` |
| Account | `GET /me/notification-preferences`, `PUT` | `NotificationPrefs` |
| Account | `POST /me/delete` | `202 Job` |
| Account | `GET /workspace`, `PATCH /workspace` | `Workspace` |
| Account | `GET /usage` | `Usage` |
| Account | `GET /voices`, `GET /music-tracks` | lists |
| Projects | `GET /projects`, `POST /projects` | `Page<ProjectSummary>`, `201 ProjectDetail` |
| Projects | `GET /projects/{id}`, `PATCH /projects/{id}` | `ProjectDetail` |
| Projects | `PUT /projects/{id}/draft` | `DraftSaved` |
| Projects | `POST /projects/{id}/lease`, `POST /projects/{id}/lease/release` | `Lease`, `204` |
| Projects | `POST /projects/{id}/duplicate` | `201 ProjectDetail` |
| Projects | `DELETE /projects/{id}`, `POST /projects/{id}/restore`, `DELETE /projects/{id}/permanent` | `204`, `ProjectDetail`, `202 Job` |
| Creation | `POST /projects/{id}/ideas`, `/script`, `/script/rewrite`, `/storyboard` | `202 Job` |
| Generation | `POST /projects/{id}/generate`, `POST /projects/{id}/narration` | `202 Job` |
| Generation | `GET /projects/{id}/audio` | `Record<Id, SignedUrl>` |
| Versions | `GET /projects/{id}/versions`, `POST /projects/{id}/versions` | `Page<VersionSummary>`, `201` |
| Versions | `GET /projects/{id}/versions/{n}`, `POST /projects/{id}/versions/{n}/restore` | `VersionDetail`, `201` |
| Chat | `GET /projects/{id}/chat`, `POST /projects/{id}/chat` | `Page<ChatMessage>`, `202` |
| Chat | `POST /projects/{id}/chat/{messageId}/apply`, `/dismiss` | `202 Job`, `ChatMessage` |
| Exports | `POST /projects/{id}/exports`, `GET /projects/{id}/exports` | `ExportStarted`, `Page<Export>` |
| Exports | `GET /exports/{id}`, `DELETE /exports/{id}` | `Export`, `204` |
| Exports | `GET /exports/{id}/download`, `POST /exports/{id}/caption` | `302`, `202 Job` |
| Jobs | `GET /jobs`, `GET /jobs/{id}`, `GET /jobs/{id}/events` | `Page<Job>`, `Job`, SSE |
| Jobs | `POST /jobs/{id}/cancel`, `POST /jobs/{id}/retry` | `202 Job` |
| Instagram | `GET /integrations/instagram`, `DELETE /integrations/instagram` | `InstagramAccount`, `204` |
| Instagram | `POST /integrations/instagram/connect`, `GET /integrations/instagram/callback` | `{ authorizeUrl }`, `302` |
| Posts | `GET /posts`, `POST /posts` | `Page<Post>`, `201` |
| Posts | `GET /posts/{id}`, `PATCH /posts/{id}` | `Post` |
| Posts | `POST /posts/{id}/cancel`, `POST /posts/{id}/publish-now` | `Post`, `202 Job` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/read` | `Page`, `{ count }`, `204` |
| Admin | `/admin/*` (Section 14) | various |
| Internal | `/api/inngest`, `/api/webhooks/resend`, `/api/health`, Instagram deauthorize and data deletion | Section 15 |
| Better Auth | `/api/auth/*` | Section 4 |
