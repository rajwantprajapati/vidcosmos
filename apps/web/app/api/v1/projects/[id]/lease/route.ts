// POST /api/v1/projects/{id}/lease: take or renew the edit lease; `takeover` takes it from
// another tab after the user confirms (API §5).
import { leaseHolder, parseProjectId, takeLease, userName } from "@vidcosmos/db";
import { type LeaseDto, takeLeaseInput } from "@vidcosmos/spec/api";
import { apiRoute, editorId, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { ownerOf } from "@/lib/projects";

export const POST = apiRoute<{ id: string }>(async (context) => {
  const projectId = parseProjectId(context.params.id);
  const holder = leaseHolder(context.session.session.id, editorId(context.request));
  const input = await readJson(context.request, takeLeaseInput);
  const db = getDb();
  const project = await takeLease(db, ownerOf(context), projectId, holder, input);
  const lease = project.lease!;
  const body: LeaseDto = {
    heldByMe: true,
    holderName: (await userName(db, lease.userId)) ?? context.session.user.name,
    expiresAt: lease.expiresAt.toISOString(),
  };
  return body;
});
