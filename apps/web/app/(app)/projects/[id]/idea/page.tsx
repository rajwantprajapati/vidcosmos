// Step 1 of a video: the idea, its settings and the angles (F14).
import type { Metadata } from "next";
import { IdeaStep } from "@/components/create/idea-step";
import { findProject, loadProject, projectDto, stepJob } from "@/lib/create";
import { requireSession } from "@/lib/session";

/** The tab title; a missing video gets the 404's own title. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { workspace } = await requireSession(`/projects/${id}/idea`);
  const found = await findProject(workspace, id);
  return { title: found ? "New video · Vidcosmos" : "Page not found · Vidcosmos" };
}

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireSession(`/projects/${id}/idea`);
  const project = await loadProject(workspace, id);
  const detail = projectDto(project, workspace);
  return (
    <IdeaStep
      project={detail}
      defaults={workspace.defaults}
      ideasJob={await stepJob(workspace._id, project, "ideas")}
      generations={{
        used: detail.counters.generationsUsed,
        max: detail.counters.generationsMax,
      }}
    />
  );
}
