// POST /api/v1/projects/{id}/lease/release: give up the lease when the tab closes. Sent with
// navigator.sendBeacon, which can't set headers, so the editor id comes in the body (API §5).
// A closing tab's last unsaved change comes with it (`draft`) and is saved first, while the
// tab still holds the lease, so the release can never get in ahead of it (F22 QA). A draft
// that can't be saved (a conflict, a block) is left to the copy kept in the browser.
import { leaseHolder, parseProjectId, releaseLease } from "@vidcosmos/db";
import { releaseLeaseInput } from "@vidcosmos/spec/api";
import { apiRoute, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { saveDraftFor } from "@/lib/draft-save";
import { ownerOf } from "@/lib/projects";

export const POST = apiRoute<{ id: string }>(async (context) => {
  const projectId = parseProjectId(context.params.id);
  const { editorId, draft } = await readJson(context.request, releaseLeaseInput);
  const holder = leaseHolder(context.session.session.id, editorId);
  if (draft) {
    try {
      await saveDraftFor(context, projectId, holder, draft);
    } catch {
      // Kept in the browser; offered on the next visit.
    }
  }
  await releaseLease(getDb(), ownerOf(context), projectId, holder);
  return new Response(null, { status: 204 });
});
