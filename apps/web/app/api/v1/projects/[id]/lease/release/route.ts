// POST /api/v1/projects/{id}/lease/release: give up the lease when the tab closes. Sent with
// navigator.sendBeacon, which can't set headers, so the editor id comes in the body (API §5).
import { leaseHolder, parseProjectId, releaseLease } from "@vidcosmos/db";
import { releaseLeaseInput } from "@vidcosmos/spec/api";
import { apiRoute, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { ownerOf } from "@/lib/projects";

export const POST = apiRoute<{ id: string }>(async (context) => {
  const projectId = parseProjectId(context.params.id);
  const { editorId } = await readJson(context.request, releaseLeaseInput);
  const holder = leaseHolder(context.session.session.id, editorId);
  await releaseLease(getDb(), ownerOf(context), projectId, holder);
  return new Response(null, { status: 204 });
});
