// New video: step 1 before the project exists (F14). The first "Suggest angles" creates the
// project and opens its own step 1. At the monthly limit it says so, with the reset date, and
// won't start (PRD FR-10.5).
import { toUsageDto } from "@vidcosmos/spec/api";
import type { Metadata } from "next";
import { IdeaStep } from "@/components/create/idea-step";
import { requireSession } from "@/lib/session";
import { usageView } from "@/lib/usage";

export const metadata: Metadata = { title: "New video · Vidcosmos" };

export default async function NewVideoPage() {
  const { user, workspace } = await requireSession("/projects/new");
  const { usage, resetsOn, allowance } = usageView(
    toUsageDto(workspace, new Date()),
    user.timeZone,
  );
  return (
    <IdeaStep
      project={null}
      defaults={workspace.defaults}
      ideasJob={null}
      generations={{ used: 0, max: workspace.limits.generationsPerVideo }}
      limit={allowance.reached ? { max: usage.videos.max, resetsOn } : undefined}
    />
  );
}
