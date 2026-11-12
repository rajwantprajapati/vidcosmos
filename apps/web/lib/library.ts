// What a library card shows for a project (Library design): where it opens, its status badge,
// its length and its thumbnail's look. Computed on the server from the project document.
import type { Job, Project } from "@vidcosmos/spec/collections";
import { videoTypeLabels } from "@vidcosmos/spec/collections";

export type LibraryCardData = {
  id: string;
  title: string;
  type: string;
  href: string;
  status: "draft" | "generating" | "ready" | "failed";
  statusLabel?: string;
  /** Under 768 px the generating badge shows only the percentage, as in the phone design. */
  shortStatusLabel?: string;
  progress?: number;
  duration?: string;
  theme: Project["settings"]["palette"];
  aspect: Project["settings"]["format"];
  /** Set in Trash: when it was deleted. */
  deletedAt?: string;
};

/** "0:58", "1:20". */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Total length once every scene has its timing. */
function durationMs(project: Project): number | null {
  const scenes = project.draft.spec?.scenes;
  if (!scenes?.length) return null;
  let total = 0;
  for (const scene of scenes) {
    const ms = (scene as { timing?: { durationMs?: unknown } | null }).timing?.durationMs;
    if (typeof ms !== "number") return null;
    total += ms;
  }
  return total;
}

const stepPaths: Record<Project["wizardStep"], string> = {
  idea: "/idea",
  angles: "/idea",
  script: "/script",
  storyboard: "/storyboard",
  video: "",
};

/** Where opening a card goes: the step a draft is at, the progress screen, or the editor. */
export function projectHref(project: Pick<Project, "_id" | "stage" | "wizardStep">): string {
  const base = `/projects/${project._id.toHexString()}`;
  if (project.stage === "generating") return `${base}/generating`;
  if (project.stage === "draft") return base + stepPaths[project.wizardStep];
  return base;
}

export function libraryCard(
  project: Project,
  activeJob?: Pick<Job, "progress"> | null,
): LibraryCardData {
  const ms = durationMs(project);
  const card: LibraryCardData = {
    id: project._id.toHexString(),
    title: project.title,
    type: videoTypeLabels[project.idea.videoType ?? "explainer"],
    href: projectHref(project),
    status: "draft",
    theme: project.settings.palette,
    aspect: project.settings.format,
    ...(ms !== null ? { duration: formatDuration(ms) } : {}),
  };
  if (project.deletedAt) {
    return { ...card, statusLabel: "In Trash", deletedAt: project.deletedAt.toISOString() };
  }
  switch (project.stage) {
    case "draft":
      return {
        ...card,
        status: "draft",
        statusLabel: `Draft · ${project.wizardStep === "angles" ? "idea" : project.wizardStep}`,
      };
    case "generating": {
      const progress = activeJob ? Math.round(activeJob.progress) : undefined;
      return {
        ...card,
        status: "generating",
        statusLabel: progress !== undefined ? `Generating ${progress}%` : "Generating",
        ...(progress !== undefined ? { shortStatusLabel: `${progress}%` } : {}),
        ...(progress !== undefined ? { progress } : {}),
      };
    }
    case "revising":
      return { ...card, status: "generating", statusLabel: "Updating" };
    case "ready":
      return { ...card, status: "ready" };
    case "failed":
      return { ...card, status: "failed", statusLabel: "Failed" };
  }
}
