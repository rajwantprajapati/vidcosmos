// Step 3 of a video: the storyboard (F17).
import { toUsageDto } from "@vidcosmos/spec/api";
import type { Metadata } from "next";
import { StoryboardStep } from "@/components/create/storyboard-step";
import { findProject, loadProject, projectDto, stepJob } from "@/lib/create";
import { requireSession } from "@/lib/session";
import { usageView } from "@/lib/usage";

/** The tab title; a missing video gets the 404's own title. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { workspace } = await requireSession(`/projects/${id}/storyboard`);
  const found = await findProject(workspace, id);
  return { title: found ? "Storyboard · Vidcosmos" : "Page not found · Vidcosmos" };
}

export default async function StoryboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, workspace } = await requireSession(`/projects/${id}/storyboard`);
  const project = await loadProject(workspace, id);
  const job = await stepJob(workspace._id, project, "storyboard");
  const usage = toUsageDto(workspace, new Date());
  const { allowance, resetsOn } = usageView(usage, user.timeZone);
  return (
    <StoryboardStep
      project={projectDto(project, workspace)}
      job={job}
      usage={{
        max: usage.videos.max,
        remaining: allowance.remaining,
        reached: allowance.reached,
        counted: project.countedAt !== null,
        resetsOn,
      }}
    />
  );
}
