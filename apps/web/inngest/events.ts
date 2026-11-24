// Inngest event types, built from the zod schemas in `@vidcosmos/spec/events` (SDD §5). Each
// is a trigger and a typed way to create the event: `demoJobRequested.create(data, { id })`.
import { eventSchemas } from "@vidcosmos/spec/events";
import { eventType } from "inngest";

export const demoJobRequested = eventType("job/demo.requested", {
  schema: eventSchemas["job/demo.requested"],
});

export const jobCancelRequested = eventType("job/cancel.requested", {
  schema: eventSchemas["job/cancel.requested"],
});

export const ideasRequested = eventType("video/ideas.requested", {
  schema: eventSchemas["video/ideas.requested"],
});

export const scriptRequested = eventType("video/script.requested", {
  schema: eventSchemas["video/script.requested"],
});

export const scriptRewriteRequested = eventType("video/script.rewrite.requested", {
  schema: eventSchemas["video/script.rewrite.requested"],
});

export const storyboardRequested = eventType("video/storyboard.requested", {
  schema: eventSchemas["video/storyboard.requested"],
});

export const generateRequested = eventType("video/generate.requested", {
  schema: eventSchemas["video/generate.requested"],
});

export const sceneRetryRequested = eventType("video/scene.retry.requested", {
  schema: eventSchemas["video/scene.retry.requested"],
});
