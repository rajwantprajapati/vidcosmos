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
