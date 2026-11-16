// Step 2 of a video: the script (F15).
import type { Metadata } from "next";
import { ScriptStep } from "@/components/create/script-step";
import { findProject, loadProject, projectDto, stepJob, undoableRewrite } from "@/lib/create";
import { requireSession } from "@/lib/session";

/** The tab title; a missing video gets the 404's own title. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { workspace } = await requireSession(`/projects/${id}/script`);
  const found = await findProject(workspace, id);
  return { title: found ? "Script · Vidcosmos" : "Page not found · Vidcosmos" };
}

export default async function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireSession(`/projects/${id}/script`);
  const project = await loadProject(workspace, id);
  const [job, undo] = await Promise.all([
    stepJob(workspace._id, project, ["script", "script_rewrite"]),
    undoableRewrite(workspace._id, project),
  ]);
  return <ScriptStep project={projectDto(project, workspace)} job={job} undo={undo} />;
}
