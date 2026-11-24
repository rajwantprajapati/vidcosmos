// GET /api/v1/projects/{id}/audio?ids=a,b: fresh playback URLs for up to 20 narration assets
// the project's draft or versions use (API §7 "Audio URLs"). Without `ids`, every asset the
// draft plays. Ids the project doesn't use are left out. The Player calls it before its links
// expire, so a long editing session keeps playing.
import { getProject, parseProjectId } from "@vidcosmos/db";
import { ApiError, apiRoute } from "@/lib/api";
import { projectAudio } from "@/lib/audio";
import { getDb } from "@/lib/db";

export const GET = apiRoute<{ id: string }>(async (context) => {
  const project = await getProject(
    getDb(),
    context.workspace._id,
    parseProjectId(context.params.id),
  );
  const raw = new URL(context.request.url).searchParams.get("ids");
  const ids = raw
    ? [
        ...new Set(
          raw
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ]
    : undefined;
  if (ids && ids.length > 20) {
    throw new ApiError("VALIDATION_FAILED", "Ask for at most 20 recordings at a time.", {
      fields: [{ path: "ids", message: "At most 20 ids." }],
    });
  }
  const links = await projectAudio(project, ids);
  return Response.json(
    Object.fromEntries(
      Object.entries(links).map(([id, link]) => [
        id,
        { url: link.url, expiresAt: link.expiresAt.toISOString() },
      ]),
    ),
  );
});
